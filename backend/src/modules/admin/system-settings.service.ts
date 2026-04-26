// SystemSetting · 通用 KV 读写 + 已知键的类型化封装
//
// 当前键：
//   scraper.fetchVia → 'local' | 'asia'  · 法本 URL 抓取的出口节点
//
// 设计：
//   - getSetting<T>(key) 直接读 DB · 进程内 1 秒 LRU 缓存（admin 后台一次预览触发 1 次抓取，
//     频次低；缓存仅防同一次操作短时间内重复读，避免每次 fetch 都打 DB）
//   - setSetting(key, value, byUserId) → upsert · 写 AuditLog
//   - 未知键拒绝写（白名单），防止 admin 误操作把任意 KV 塞进库
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BadRequest } from '../../lib/errors.js';

export type ScraperFetchVia = 'local' | 'asia';

export interface KnownSettings {
  'scraper.fetchVia': ScraperFetchVia;
}

const DEFAULTS: KnownSettings = {
  'scraper.fetchVia': 'local',
};

const VALIDATORS: { [K in keyof KnownSettings]: (v: unknown) => KnownSettings[K] } = {
  'scraper.fetchVia': (v): ScraperFetchVia => {
    if (v === 'local' || v === 'asia') return v;
    throw BadRequest('scraper.fetchVia 仅允许 "local" 或 "asia"');
  },
};

// 进程内极小缓存：1 秒过期
// 单次「点抓取 → fetch」流程内只读 1 次；批量抓取 50 次 URL 也只读 1 次 DB
const cache = new Map<string, { value: unknown; exp: number }>();
const CACHE_MS = 1_000;

/** 读已知键 · 缓存命中直接返回 · 未命中查 DB（无记录返回默认值） */
export async function getSetting<K extends keyof KnownSettings>(
  key: K,
): Promise<KnownSettings[K]> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return hit.value as KnownSettings[K];

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  const validator = VALIDATORS[key];
  let value: KnownSettings[K];
  try {
    value = row ? validator(row.value) : DEFAULTS[key];
  } catch {
    // DB 里值损坏 → 回退默认（不阻断主流程）
    value = DEFAULTS[key];
  }
  cache.set(key, { value, exp: now + CACHE_MS });
  return value;
}

/** 写已知键 · 通过 validator 校验 · 写 AuditLog（before/after） */
export async function setSetting<K extends keyof KnownSettings>(
  key: K,
  value: KnownSettings[K],
  adminId: string,
): Promise<void> {
  const validator = VALIDATORS[key];
  const validated = validator(value);

  // 读旧值用于 AuditLog
  const before = await prisma.systemSetting.findUnique({ where: { key } });

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: validated as Prisma.InputJsonValue,
        updatedBy: adminId,
      },
      update: {
        value: validated as Prisma.InputJsonValue,
        updatedBy: adminId,
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'system.setting.update',
        targetType: 'systemSetting',
        targetId: key,
        before: before
          ? ({ value: before.value } as Prisma.InputJsonValue)
          : ({ value: DEFAULTS[key] as unknown } as Prisma.InputJsonValue),
        after: { value: validated as unknown } as Prisma.InputJsonValue,
      },
    });
  });

  // 立刻使本地缓存失效，避免 admin 切换后下次抓取仍用旧值
  cache.delete(key);
}

/** 测试 / 紧急清缓存用 · 不暴露给 HTTP */
export function clearSettingsCache(): void {
  cache.clear();
}
