// Gateway 辅助函数：场景加载 / 候选解析 / 跳过判断 / 成本计算 / 日志写入
// 从 gateway.ts 抽出，保持主调度逻辑在 150 行以内。
import type { LlmProviderConfig, LlmScenarioConfig } from '@prisma/client';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { isCircuitOpen } from './circuit.js';
import type { ChatResponse } from './providers/index.js';
import { getProvider } from './providers/index.js';
import { checkQuota } from './quota.js';

export interface Candidate {
  cfg: LlmProviderConfig;
  model: string;
}

export async function loadScenario(scenario: string): Promise<LlmScenarioConfig> {
  const cfg = await prisma.llmScenarioConfig.findUnique({ where: { scenario } });
  if (!cfg) throw NotFound(`LLM 场景配置未找到: ${scenario}`);
  return cfg;
}

export async function loadCandidates(s: LlmScenarioConfig): Promise<Candidate[]> {
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

export async function pickSkipReason(cfg: LlmProviderConfig): Promise<string | null> {
  const provider = getProvider(cfg.name);
  if (!provider.isConfigured()) return 'no_api_key';
  if (isCircuitOpen(cfg)) return 'circuit_open';
  const quota = await checkQuota(cfg);
  if (!quota.allowed) return quota.dimension ?? 'quota';
  return null;
}

export function computeCost(cfg: LlmProviderConfig, resp: ChatResponse): number {
  const inCost = (resp.inputTokens / 1000) * cfg.inputCostPer1k;
  const outCost = (resp.outputTokens / 1000) * cfg.outputCostPer1k;
  return Number((inCost + outCost).toFixed(6));
}

export function joinOrNull(xs: string[]): string | null {
  return xs.length > 0 ? xs.join(';') : null;
}

export interface LogArgs {
  requestId: string;
  scenario: string;
  userId?: string | null;
  coachId?: string | null;
  cfg: LlmProviderConfig | null;
  resp: ChatResponse | null;
  cost: number;
  tried: string[];
  switched: boolean;
  switchReason: string | null;
  success: boolean;
  errorMessage?: string;
  latencyMs?: number;
  /** CO3: prompt SHA-256 前 16 hex · 审计追溯用 · 不存原文 */
  promptHash?: string | null;
}

export async function writeLog(a: LogArgs): Promise<void> {
  await prisma.llmCallLog.create({
    data: {
      requestId: a.requestId,
      scenario: a.scenario,
      userId: a.userId ?? null,
      coachId: a.coachId ?? null,
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
      promptHash: a.promptHash ?? null,
    },
  });
}
