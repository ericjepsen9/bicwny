// LLM 用量读写
// 每次调用完成后把 tokens / cost / error 累加到 5 个时间桶（year/month/day/hour/minute）；
// 配额检查和面板以桶为单位聚合读取。
import type { LlmProviderUsage, PeriodType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { allPeriodKeys } from './period.js';

export interface UsageDelta {
  inputTokens: number;
  outputTokens: number;
  /** USD，精度 6 位小数 */
  cost: number;
  isError?: boolean;
}

const PERIOD_TYPES: PeriodType[] = ['year', 'month', 'day', 'hour', 'minute'];

/** 累加一次 LLM 调用到 5 个时间桶。使用事务确保 5 条一起写入或全失败。 */
export async function incrementUsage(
  providerId: string,
  delta: UsageDelta,
  at: Date = new Date(),
): Promise<void> {
  const keys = allPeriodKeys(at);
  const total = BigInt(delta.inputTokens + delta.outputTokens);
  const input = BigInt(delta.inputTokens);
  const output = BigInt(delta.outputTokens);
  const errorInc = delta.isError ? 1 : 0;
  const costStr = delta.cost.toFixed(6);

  await prisma.$transaction(
    PERIOD_TYPES.map((periodType) =>
      prisma.llmProviderUsage.upsert({
        where: {
          providerId_periodType_periodKey: {
            providerId,
            periodType,
            periodKey: keys[periodType],
          },
        },
        create: {
          providerId,
          periodType,
          periodKey: keys[periodType],
          tokenCount: total,
          inputTokens: input,
          outputTokens: output,
          requestCount: 1,
          errorCount: errorInc,
          cost: costStr,
        },
        update: {
          tokenCount: { increment: total },
          inputTokens: { increment: input },
          outputTokens: { increment: output },
          requestCount: { increment: 1 },
          errorCount: { increment: errorInc },
          cost: { increment: costStr },
        },
      }),
    ),
  );
}

export async function readUsage(
  providerId: string,
  periodType: PeriodType,
  periodKey: string,
): Promise<LlmProviderUsage | null> {
  return prisma.llmProviderUsage.findUnique({
    where: {
      providerId_periodType_periodKey: { providerId, periodType, periodKey },
    },
  });
}

/** 一次读当前 year/month/day 用量，供配额检查使用。 */
export async function readCurrentUsage(
  providerId: string,
  at: Date = new Date(),
): Promise<{
  year: LlmProviderUsage | null;
  month: LlmProviderUsage | null;
  day: LlmProviderUsage | null;
}> {
  const keys = allPeriodKeys(at);
  const [year, month, day] = await Promise.all([
    readUsage(providerId, 'year', keys.year),
    readUsage(providerId, 'month', keys.month),
    readUsage(providerId, 'day', keys.day),
  ]);
  return { year, month, day };
}
