// 内容版本化 · seed 注册表 + 审计流水
// P2 #22
//
// 用法（在 seed 文件里）：
//   import { runSeed, recordRelease } from '../src/lib/content-seed.js';
//   await runSeed({
//     name: 'V202604_add_xinjing_questions',
//     run: async (prisma, { record }) => {
//       const q = await prisma.question.create({...});
//       await record('question', q.id, 'create', null, q.contentVersion);
//       return { inserted: 1 };
//     },
//   });
//
// runSeed 行为：
//   - 同名 seed 已应用且 hash 一致 → 跳过 · 返回 { skipped: true }
//   - 同名 seed 已应用但 hash 不同 → 抛错（除非 force=true）
//   - 没记录 → 在事务里跑 run · 全部成功才 INSERT ContentSeed · 任何一条 release 都 INSERT
//
// 注意：seed 内部不要直接捕获错误吞掉 · 让事务回滚才能保持注册表与数据一致

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';

type Tx = Prisma.TransactionClient;

export interface SeedContext {
  /** 把一次实体变更写进 ContentRelease */
  record: (
    entity: 'course' | 'chapter' | 'lesson' | 'question' | 'cohort',
    entityId: string,
    change: 'create' | 'update' | 'archive' | 'restore' | 'cohort-set' | 'cohort-promote',
    oldVersion?: number | null,
    newVersion?: number | null,
    diff?: Record<string, unknown>,
  ) => Promise<void>;
}

export interface SeedDef<R = unknown> {
  /** 唯一标识 · 建议 'V<yyyymm>_<slug>' 格式 */
  name: string;
  /** 源码哈希 · 不传则从调用文件路径自动算 */
  hash?: string;
  /** 调用文件绝对路径 · 不传走 import.meta.url 的调用方需要自带 */
  sourcePath?: string;
  /** 实际写库逻辑 · 在事务内执行 */
  run(tx: Tx, ctx: SeedContext): Promise<R>;
  /** 触发者 ID（admin UI 触发时填）· CLI 留空 */
  appliedBy?: string;
  /** 强制覆盖：hash 变了也允许重跑（重跑会再 INSERT 一行 release · ContentSeed.hash 更新） */
  force?: boolean;
}

export interface RunResult<R> {
  skipped: boolean;
  hashChanged?: boolean;
  result?: R;
  releases: number;
}

function sha256(s: string | Buffer): string {
  return createHash('sha256').update(s).digest('hex');
}

function computeHash(def: SeedDef): string {
  if (def.hash) return def.hash;
  if (def.sourcePath) {
    try {
      return sha256(readFileSync(def.sourcePath));
    } catch {
      // ignore · fall through
    }
  }
  // 兜底：用函数体字符串 · 改函数体能检测到
  return sha256(def.run.toString());
}

export async function runSeed<R = unknown>(def: SeedDef<R>): Promise<RunResult<R>> {
  if (!def.name || !/^[A-Za-z0-9_\-.]+$/.test(def.name)) {
    throw new Error(`runSeed: invalid name '${def.name}'`);
  }
  const hash = computeHash(def);

  const existing = await prisma.contentSeed.findUnique({ where: { name: def.name } });
  if (existing && existing.hash === hash) {
    return { skipped: true, releases: 0 };
  }
  if (existing && existing.hash !== hash && !def.force) {
    throw new Error(
      `Seed '${def.name}' was applied previously with a different hash. ` +
        `Pass force=true to re-run (only safe for idempotent seeds).`,
    );
  }

  let releaseCount = 0;
  const result = await prisma.$transaction(async (tx) => {
    const ctx: SeedContext = {
      record: async (entity, entityId, change, oldVersion, newVersion, diff) => {
        await tx.contentRelease.create({
          data: {
            entity,
            entityId,
            change,
            oldVersion: oldVersion ?? null,
            newVersion: newVersion ?? null,
            diff: (diff as Prisma.InputJsonValue) ?? Prisma.DbNull,
            byUserId: def.appliedBy ?? null,
            bySeed: def.name,
          },
        });
        releaseCount++;
      },
    };
    const r = await def.run(tx, ctx);
    if (existing) {
      await tx.contentSeed.update({
        where: { name: def.name },
        data: { hash, appliedAt: new Date(), notes: notesOf(r) },
      });
    } else {
      await tx.contentSeed.create({
        data: {
          name: def.name,
          hash,
          appliedBy: def.appliedBy ?? null,
          notes: notesOf(r),
        },
      });
    }
    return r;
  });

  return {
    skipped: false,
    hashChanged: !!(existing && existing.hash !== hash),
    result,
    releases: releaseCount,
  };
}

function notesOf(r: unknown): string | null {
  if (r == null) return null;
  if (typeof r === 'string') return r.slice(0, 200);
  try {
    return JSON.stringify(r).slice(0, 200);
  } catch {
    return null;
  }
}

// 服务层手动写一行 release（admin 编辑题 / 法本导入用）
export async function recordRelease(
  client: PrismaClient | Tx,
  args: {
    entity: 'course' | 'chapter' | 'lesson' | 'question' | 'cohort';
    entityId: string;
    change: 'create' | 'update' | 'archive' | 'restore' | 'cohort-set' | 'cohort-promote';
    oldVersion?: number | null;
    newVersion?: number | null;
    diff?: Record<string, unknown>;
    byUserId?: string | null;
    bySeed?: string | null;
  },
): Promise<void> {
  await client.contentRelease.create({
    data: {
      entity: args.entity,
      entityId: args.entityId,
      change: args.change,
      oldVersion: args.oldVersion ?? null,
      newVersion: args.newVersion ?? null,
      diff: (args.diff as Prisma.InputJsonValue) ?? Prisma.DbNull,
      byUserId: args.byUserId ?? null,
      bySeed: args.bySeed ?? null,
    },
  });
}

// 题库选题时按 cohort 过滤的 Prisma where
//   user.contentCohort = null → 仅看 cohort=null 主线
//   user.contentCohort = 'A'  → 看 cohort=null 或 cohort='A' 的题
export function cohortWhere(userCohort: string | null | undefined) {
  if (!userCohort) return { cohort: null };
  return { OR: [{ cohort: null }, { cohort: userCohort }] };
}
