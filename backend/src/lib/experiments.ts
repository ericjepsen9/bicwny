// A/B 实验 · 注册 + 确定性分配 + 暴露记录
// P2 #23
//
// 流程：
//   1. admin 调 POST /api/admin/experiments 创建 { key, variants:[{name,weight}], goalEvent? }
//   2. 客户端 boot 时调 POST /api/experiments/:key/assign · 后端用 sha256(key+userId) 桶位
//      首次写 ExperimentExposure(unique(key,user)/(key,session)) · 之后再调返回同 variant
//   3. AnalyticsEvent 自动从 properties.experiment / .variant 关联 · 算转化率：
//      `select variant, count(*) filter (where event='goal') / count(*) from ...`
//
// 确定性分配：sha256 前 4 字节 mod weightSum · 同一 user 在同一实验里永远同 variant
// （即使不写 exposure 也能稳定）· 落库后再不重抽就靠 unique 约束兜底

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface VariantSpec {
  name: string;
  weight: number; // 任意正数 · 总和归一
}

interface AssignArgs {
  key: string;
  userId?: string | null;
  sessionId?: string | null;
}

export interface AssignResult {
  experimentKey: string;
  variant: string;
  firstSeen: boolean; // true = 本次首次记录暴露
  /** 实验已结束 / 已归档 / 不存在时返回 'control' · 调用方可选择不做实验逻辑 */
  inactive?: boolean;
}

/** 默认 control（实验缺失时所有调用方一致回落） */
const DEFAULT_VARIANT = 'control';

/** 确定性桶位：subject ('uid:xxx' / 'sid:yyy') + key → variant 名 */
export function deterministicVariant(
  variants: VariantSpec[],
  subject: string,
  key: string,
): string {
  if (variants.length === 0) return DEFAULT_VARIANT;
  const totalWeight = variants.reduce((s, v) => s + Math.max(0, v.weight || 0), 0);
  if (totalWeight <= 0) return variants[0]!.name;

  const h = createHash('sha256').update(`${key}|${subject}`).digest();
  // 取前 4 字节当 uint32 · 0..2^32-1
  const n = (h[0]! << 24) | (h[1]! << 16) | (h[2]! << 8) | h[3]!;
  const bucket = (n >>> 0) % totalWeight;

  let acc = 0;
  for (const v of variants) {
    acc += Math.max(0, v.weight || 0);
    if (bucket < acc) return v.name;
  }
  return variants[variants.length - 1]!.name;
}

function parseVariants(raw: unknown): VariantSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (v): v is { name: unknown; weight: unknown } =>
        typeof v === 'object' && v != null && 'name' in v && 'weight' in v,
    )
    .map((v) => ({
      name: String(v.name),
      weight: Number(v.weight) || 0,
    }))
    .filter((v) => v.name.length > 0);
}

/**
 * 分配 variant + 写 exposure（首次）· 同 subject 第二次调用直接返回原 variant。
 * subject 选择优先级：userId > sessionId · 都缺时抛错。
 */
export async function assignVariant(args: AssignArgs): Promise<AssignResult> {
  const { key } = args;
  const userId = args.userId || null;
  const sessionId = args.sessionId || null;
  if (!userId && !sessionId) {
    throw new Error('assignVariant: userId or sessionId required');
  }

  const exp = await prisma.experiment.findUnique({ where: { key } });
  if (!exp || !exp.isActive || exp.archivedAt) {
    return { experimentKey: key, variant: DEFAULT_VARIANT, firstSeen: false, inactive: true };
  }

  const variants = parseVariants(exp.variants);
  const subject = userId ? `uid:${userId}` : `sid:${sessionId}`;
  const variant = deterministicVariant(variants, subject, key);

  // 已经暴露过？返回原 variant · 不重抽
  const existing = await prisma.experimentExposure.findFirst({
    where: {
      experimentKey: key,
      OR: userId ? [{ userId }, { sessionId }] : [{ sessionId }],
    },
  });
  if (existing) {
    return { experimentKey: key, variant: existing.variant, firstSeen: false };
  }

  // 首次：upsert（处理并发）· unique(key,userId) 和 unique(key,sessionId) 同时存在
  // 优先按 userId 唯一键 upsert · 没 userId 时按 sessionId
  try {
    if (userId) {
      await prisma.experimentExposure.upsert({
        where: { experimentKey_userId: { experimentKey: key, userId } },
        create: { experimentKey: key, userId, sessionId, variant },
        update: {},
      });
    } else if (sessionId) {
      await prisma.experimentExposure.upsert({
        where: { experimentKey_sessionId: { experimentKey: key, sessionId } },
        create: { experimentKey: key, userId: null, sessionId, variant },
        update: {},
      });
    }
  } catch (e) {
    // 并发同 subject 二次插入 · 走查询路径返回原 variant
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const row = await prisma.experimentExposure.findFirst({
        where: {
          experimentKey: key,
          OR: userId ? [{ userId }, { sessionId }] : [{ sessionId }],
        },
      });
      if (row) return { experimentKey: key, variant: row.variant, firstSeen: false };
    }
    throw e;
  }
  return { experimentKey: key, variant, firstSeen: true };
}

/**
 * 读取实验结果 · 按 variant 统计 exposed 与 converted（goalEvent）
 * 转化条件：AnalyticsEvent.userId 在该 variant 的 exposure 名单里
 *           且 event = experiment.goalEvent · 且 createdAt >= exposure.firstSeenAt
 *           （只算暴露后产生的事件）
 */
export interface VariantStats {
  variant: string;
  exposed: number;
  converted: number;
  rate: number; // converted / exposed · 0 时返 0
}

export async function getExperimentResults(key: string): Promise<{
  experiment: { key: string; goalEvent: string | null };
  stats: VariantStats[];
}> {
  const exp = await prisma.experiment.findUnique({ where: { key } });
  if (!exp) throw new Error(`Experiment '${key}' not found`);

  const exposures = await prisma.experimentExposure.findMany({
    where: { experimentKey: key },
    select: { userId: true, variant: true, firstSeenAt: true },
  });

  // exposed by variant
  const counts = new Map<string, { exposed: number; converted: number }>();
  for (const e of exposures) {
    const slot = counts.get(e.variant) || { exposed: 0, converted: 0 };
    slot.exposed += 1;
    counts.set(e.variant, slot);
  }

  if (exp.goalEvent) {
    // 仅统计登录用户的转化（匿名 → 用户的 join 不在这版做 · 后续可加 sessionId 路径）
    const userIds = exposures.map((e) => e.userId).filter((x): x is string => !!x);
    if (userIds.length > 0) {
      const events = await prisma.analyticsEvent.findMany({
        where: {
          userId: { in: userIds },
          event: exp.goalEvent,
        },
        select: { userId: true, createdAt: true },
      });
      // 索引 exposure by userId 以查 firstSeenAt
      const expByUid = new Map<string, { variant: string; firstSeenAt: Date }>();
      for (const e of exposures) {
        if (e.userId) expByUid.set(e.userId, { variant: e.variant, firstSeenAt: e.firstSeenAt });
      }
      // 每个用户在该实验最多算一次转化（去重 by userId）
      const convertedByVariant = new Map<string, Set<string>>();
      for (const ev of events) {
        if (!ev.userId) continue;
        const exp2 = expByUid.get(ev.userId);
        if (!exp2) continue;
        if (ev.createdAt < exp2.firstSeenAt) continue; // 暴露前事件不算
        let s = convertedByVariant.get(exp2.variant);
        if (!s) {
          s = new Set();
          convertedByVariant.set(exp2.variant, s);
        }
        s.add(ev.userId);
      }
      for (const [variant, set] of convertedByVariant.entries()) {
        const slot = counts.get(variant) || { exposed: 0, converted: 0 };
        slot.converted = set.size;
        counts.set(variant, slot);
      }
    }
  }

  const stats: VariantStats[] = Array.from(counts.entries())
    .map(([variant, { exposed, converted }]) => ({
      variant,
      exposed,
      converted,
      rate: exposed > 0 ? converted / exposed : 0,
    }))
    .sort((a, b) => a.variant.localeCompare(b.variant));

  return { experiment: { key, goalEvent: exp.goalEvent }, stats };
}
