// LLM Gateway · 核心调度
// 负责：选 provider → 熔断/配额过滤 → 调 provider → 记录用量 + 调用日志 →
//        失败自动切兜底 → 全失败抛错
import crypto from 'node:crypto';
import type { LlmProviderConfig, LlmScenarioConfig } from '@prisma/client';
import { NotFound, UpstreamError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isCircuitOpen, recordFailure, recordSuccess } from './circuit.js';
import type { ChatMessage, ChatResponse } from './providers/index.js';
import { getProvider } from './providers/index.js';
import { checkQuota } from './quota.js';
import { incrementUsage } from './usage.js';

export interface ChatContext {
  userId?: string;
  coachId?: string;
  /** 幂等键；不传则自动生成 uuid */
  requestId?: string;
  temperature?: number;
  maxTokens?: number;
}

interface Candidate {
  cfg: LlmProviderConfig;
  model: string;
}

export async function chat(
  scenario: string,
  messages: ChatMessage[],
  ctx: ChatContext = {},
): Promise<ChatResponse> {
  const requestId = ctx.requestId ?? crypto.randomUUID();
  const scenarioCfg = await loadScenario(scenario);
  const candidates = await loadCandidates(scenarioCfg);

  const tried: string[] = [];
  const skipReasons: string[] = [];
  let lastError: Error | null = null;
  const startedAt = Date.now();

  for (const { cfg, model } of candidates) {
    tried.push(cfg.name);

    const skip = await pickSkipReason(cfg);
    if (skip) {
      skipReasons.push(`${cfg.name}:${skip}`);
      continue;
    }

    try {
      const provider = getProvider(cfg.name);
      const resp = await provider.chat({
        model,
        messages,
        temperature: ctx.temperature ?? scenarioCfg.temperature,
        maxTokens: ctx.maxTokens ?? scenarioCfg.maxTokens,
        requestId,
      });
      const cost = computeCost(cfg, resp);
      await Promise.all([
        recordSuccess(cfg.id),
        incrementUsage(cfg.id, {
          inputTokens: resp.inputTokens,
          outputTokens: resp.outputTokens,
          cost,
        }),
        writeLog({
          requestId, scenario, ctx, cfg, resp, cost,
          tried, switched: tried.length > 1,
          switchReason: joinOrNull(skipReasons),
          success: true,
        }),
      ]);
      return resp;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;
      skipReasons.push(`${cfg.name}:${err.message}`);
      await Promise.all([
        recordFailure(cfg.id),
        incrementUsage(cfg.id, {
          inputTokens: 0, outputTokens: 0, cost: 0, isError: true,
        }),
      ]);
    }
  }

  await writeLog({
    requestId, scenario, ctx,
    cfg: null, resp: null, cost: 0,
    tried,
    switched: tried.length > 1,
    switchReason: joinOrNull(skipReasons),
    success: false,
    errorMessage: lastError?.message ?? '所有 provider 都不可用',
    latencyMs: Date.now() - startedAt,
  });

  throw UpstreamError('所有 LLM provider 均不可用', { tried, reasons: skipReasons });
}

// ───────── helpers ─────────

async function loadScenario(scenario: string): Promise<LlmScenarioConfig> {
  const cfg = await prisma.llmScenarioConfig.findUnique({ where: { scenario } });
  if (!cfg) throw NotFound(`LLM 场景配置未找到: ${scenario}`);
  return cfg;
}

async function loadCandidates(s: LlmScenarioConfig): Promise<Candidate[]> {
  const ids = [s.primaryProviderId, s.fallbackProviderId].filter(
    (x): x is string => !!x,
  );
  const providers = await prisma.llmProviderConfig.findMany({
    where: { id: { in: ids } },
  });
  const byId = new Map(providers.map((p) => [p.id, p]));
  const out: Candidate[] = [];
  const primary = byId.get(s.primaryProviderId);
  if (primary) out.push({ cfg: primary, model: s.primaryModel });
  if (s.fallbackProviderId && s.fallbackModel) {
    const fb = byId.get(s.fallbackProviderId);
    if (fb) out.push({ cfg: fb, model: s.fallbackModel });
  }
  return out;
}

async function pickSkipReason(cfg: LlmProviderConfig): Promise<string | null> {
  const provider = getProvider(cfg.name);
  if (!provider.isConfigured()) return 'no_api_key';
  if (isCircuitOpen(cfg)) return 'circuit_open';
  const quota = await checkQuota(cfg);
  if (!quota.allowed) return quota.dimension ?? 'quota';
  return null;
}

function computeCost(cfg: LlmProviderConfig, resp: ChatResponse): number {
  const inCost = (resp.inputTokens / 1000) * cfg.inputCostPer1k;
  const outCost = (resp.outputTokens / 1000) * cfg.outputCostPer1k;
  return Number((inCost + outCost).toFixed(6));
}

function joinOrNull(xs: string[]): string | null {
  return xs.length > 0 ? xs.join(';') : null;
}

interface LogArgs {
  requestId: string;
  scenario: string;
  ctx: ChatContext;
  cfg: LlmProviderConfig | null;
  resp: ChatResponse | null;
  cost: number;
  tried: string[];
  switched: boolean;
  switchReason: string | null;
  success: boolean;
  errorMessage?: string;
  latencyMs?: number;
}

async function writeLog(a: LogArgs): Promise<void> {
  await prisma.llmCallLog.create({
    data: {
      requestId: a.requestId,
      scenario: a.scenario,
      userId: a.ctx.userId ?? null,
      coachId: a.ctx.coachId ?? null,
      providerUsed: a.cfg?.name ?? a.tried[a.tried.length - 1] ?? '',
      providerTried: a.tried,
      switched: a.switched,
      switchReason: a.switchReason,
      model: a.resp?.model ?? '',
      inputTokens: a.resp?.inputTokens ?? 0,
      outputTokens: a.resp?.outputTokens ?? 0,
      cost: a.cost.toFixed(6),
      latencyMs: a.resp?.latencyMs ?? a.latencyMs ?? 0,
      success: a.success,
      errorMessage: a.errorMessage ?? null,
    },
  });
}
