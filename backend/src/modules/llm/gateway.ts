// LLM Gateway · 核心调度
// 选 provider → 过滤（熔断/配额/未配置）→ 调 provider →
//   成功：记录用量 + 写日志，返回
//   失败：记录错误，尝试下一个
// 全部失败：抛 UpstreamError。
//
// 辅助函数见 ./gateway.helpers.ts
import crypto from 'node:crypto';
import { UpstreamError } from '../../lib/errors.js';
import { recordFailure, recordSuccess } from './circuit.js';
import {
  computeCost,
  joinOrNull,
  loadCandidates,
  loadScenario,
  pickSkipReason,
  writeLog,
} from './gateway.helpers.js';
import type { ChatMessage, ChatResponse } from './providers/index.js';
import { getProvider } from './providers/index.js';
import { incrementUsage } from './usage.js';

export interface ChatContext {
  userId?: string;
  coachId?: string;
  /** 幂等键；不传则自动生成 uuid */
  requestId?: string;
  temperature?: number;
  maxTokens?: number;
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
      const resp = await getProvider(cfg.name).chat({
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
          requestId,
          scenario,
          userId: ctx.userId,
          coachId: ctx.coachId,
          cfg,
          resp,
          cost,
          tried,
          switched: tried.length > 1,
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
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          isError: true,
        }),
      ]);
    }
  }

  await writeLog({
    requestId,
    scenario,
    userId: ctx.userId,
    coachId: ctx.coachId,
    cfg: null,
    resp: null,
    cost: 0,
    tried,
    switched: tried.length > 1,
    switchReason: joinOrNull(skipReasons),
    success: false,
    errorMessage: lastError?.message ?? '所有 provider 都不可用',
    latencyMs: Date.now() - startedAt,
  });

  // 用户/客户端可见的错误体不带 provider 名 / skipReasons —— 防泄漏基础设施配置
  // 完整 tried+skipReasons 已写到 LlmCallLog (writeLog above)，admin 后台可查
  throw UpstreamError('所有 LLM provider 均不可用', {
    triedCount: tried.length,
  });
}
