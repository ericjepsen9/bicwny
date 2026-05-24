// Admin LLM 用量报表
// - providerUsageSummary：单 provider 按 periodType（默认 day）取 N 期
// - platformUsageSummary：当期所有 provider 汇总 + 合计
// - listCallLogs：LlmCallLog 游标分页（timestamp 降序）
import type {
  LlmCallLog,
  LlmProviderUsage,
  PeriodType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { periodKey } from './period.js';

export interface ProviderUsageRow {
  periodKey: string;
  tokenCount: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  errorCount: number;
  cost: number;
}

function toRow(r: LlmProviderUsage): ProviderUsageRow {
  return {
    periodKey: r.periodKey,
    tokenCount: Number(r.tokenCount),
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
    requestCount: r.requestCount,
    errorCount: r.errorCount,
    cost: Number(r.cost),
  };
}

export async function providerUsageSummary(
  providerId: string,
  opts: { periodType?: PeriodType; limit?: number } = {},
): Promise<ProviderUsageRow[]> {
  const rows = await prisma.llmProviderUsage.findMany({
    where: { providerId, periodType: opts.periodType ?? 'day' },
    orderBy: { periodKey: 'desc' },
    take: opts.limit ?? 30,
  });
  return rows.map(toRow);
}

export interface PlatformUsageSummary {
  periodType: PeriodType;
  periodKey: string;
  byProvider: Array<
    { providerId: string; name: string; displayName: string } & ProviderUsageRow
  >;
  totals: {
    tokenCount: number;
    requestCount: number;
    errorCount: number;
    cost: number;
  };
}

export async function platformUsageSummary(
  opts: { periodType?: PeriodType; at?: Date } = {},
): Promise<PlatformUsageSummary> {
  const type = opts.periodType ?? 'month';
  const key = periodKey(type, opts.at ?? new Date());

  const providers = await prisma.llmProviderConfig.findMany({
    select: { id: true, name: true, displayName: true },
  });
  const usages = await prisma.llmProviderUsage.findMany({
    where: {
      periodType: type,
      periodKey: key,
      providerId: { in: providers.map((p) => p.id) },
    },
  });
  const map = new Map(usages.map((u) => [u.providerId, u]));

  const byProvider = providers.map((p) => {
    const u = map.get(p.id);
    const base = u
      ? toRow(u)
      : {
          periodKey: key,
          tokenCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          requestCount: 0,
          errorCount: 0,
          cost: 0,
        };
    return {
      providerId: p.id,
      name: p.name,
      displayName: p.displayName,
      ...base,
    };
  });

  const totals = byProvider.reduce(
    (acc, p) => ({
      tokenCount: acc.tokenCount + p.tokenCount,
      requestCount: acc.requestCount + p.requestCount,
      errorCount: acc.errorCount + p.errorCount,
      cost: acc.cost + p.cost,
    }),
    { tokenCount: 0, requestCount: 0, errorCount: 0, cost: 0 },
  );

  return { periodType: type, periodKey: key, byProvider, totals };
}

export interface ListCallLogsOpts {
  providerUsed?: string;
  scenario?: string;
  userId?: string;
  success?: boolean;
  limit?: number;
  /** 上一页最后一条的 id */
  cursor?: string;
}

export async function listCallLogs(
  opts: ListCallLogsOpts = {},
): Promise<LlmCallLog[]> {
  return prisma.llmCallLog.findMany({
    where: {
      ...(opts.providerUsed ? { providerUsed: opts.providerUsed } : {}),
      ...(opts.scenario ? { scenario: opts.scenario } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.success !== undefined ? { success: opts.success } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: opts.limit ?? 50,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
}
