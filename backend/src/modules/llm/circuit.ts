// 熔断器状态机
// 连续错误 >= THRESHOLD 次 → 开熔断 COOLDOWN_MS 毫秒；
// 开熔断期间 Gateway 跳过该 provider 直接走兜底。
// 一次成功即重置计数与熔断时间。
import type { LlmProviderConfig } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const ERROR_THRESHOLD = 3;
export const COOLDOWN_MS = 60_000;

export function isCircuitOpen(
  cfg: Pick<LlmProviderConfig, 'circuitOpenUntil'>,
  at: Date = new Date(),
): boolean {
  return !!cfg.circuitOpenUntil && cfg.circuitOpenUntil > at;
}

export async function recordSuccess(providerId: string): Promise<void> {
  await prisma.llmProviderConfig.update({
    where: { id: providerId },
    data: {
      consecutiveErrors: 0,
      circuitOpenUntil: null,
      healthStatus: 'healthy',
      lastSuccessAt: new Date(),
    },
  });
}

export async function recordFailure(
  providerId: string,
  now: Date = new Date(),
): Promise<void> {
  // 原子 increment，避免并发下计数漂移
  const { consecutiveErrors } = await prisma.llmProviderConfig.update({
    where: { id: providerId },
    data: {
      consecutiveErrors: { increment: 1 },
      lastErrorAt: now,
    },
    select: { consecutiveErrors: true },
  });

  if (consecutiveErrors >= ERROR_THRESHOLD) {
    await prisma.llmProviderConfig.update({
      where: { id: providerId },
      data: {
        circuitOpenUntil: new Date(now.getTime() + COOLDOWN_MS),
        healthStatus: 'degraded',
      },
    });
  }
}
