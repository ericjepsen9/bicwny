// 通知调度器 · setInterval 60s tick · v1 仅处理 ClassSession 三档提醒
//   - 进程启动挂一次 · pm2 重启重新挂 · 单实例足够
//   - 抖动 ± 90 秒容忍 · 配合 DispatchLog unique 索引保证不重发
//   - 关闭方法：在测试 / dev 时 env CRON_ENABLED=false 跳过启动
import type { PrismaClient } from '@prisma/client';
import { dispatchToUsers, type Tier, type NotifType } from './dispatch.js';
import { config } from '../../lib/config.js';

const TIER_OFFSETS: Record<Tier, number> = {
  'T-30': 30 * 60_000,
  'T-5': 5 * 60_000,
  'T0': 0,
};
// 窗口 ± 90 秒 · cron 每分钟 tick · 即使有抖动也能命中
const WINDOW_MS = 90_000;

const TIER_BODY = {
  'T-30': '30 分钟后开始',
  'T-5': '5 分钟后开始',
  'T0': '现在开始 · 立即进入',
};

let timer: NodeJS.Timeout | null = null;
let running = false; // 防 tick 重入（上次没跑完下次就来了）

async function tickClassSessions(prisma: PrismaClient): Promise<void> {
  const now = Date.now();
  // 窗口最早 = T-30 - 90s · 最晚 = T0 + 90s
  const minStart = new Date(now + TIER_OFFSETS['T-30'] - WINDOW_MS);
  // 取 max(T-30 + 90s) 作为外层上界 · 不漏窗口
  const maxStart = new Date(now + TIER_OFFSETS['T-30'] + WINDOW_MS);
  // T0 下界 = now - 90s
  const minT0 = new Date(now - WINDOW_MS);

  // 一次性拉所有候选 · 然后内存中按三档窗口分类
  const sessions = await prisma.classSession.findMany({
    where: {
      startAt: { gte: minT0, lte: maxStart },
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          members: {
            where: { removedAt: null, user: { isActive: true } },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (sessions.length === 0) return;

  for (const s of sessions) {
    const startMs = s.startAt.getTime();
    const userIds = s.class.members.map((m) => m.userId);
    if (userIds.length === 0) continue;

    const link = s.liveLink || `/app/class/${s.classId}`;
    const baseTitle = `${s.class.name} · ${s.title}`;

    for (const [tier, offset] of Object.entries(TIER_OFFSETS) as [Tier, number][]) {
      const expected = startMs - offset; // 期望触发时刻（startAt - 偏移）
      const diff = Math.abs(now - expected);
      if (diff > WINDOW_MS) continue; // 不在该 tier 窗口

      const notifType: NotifType = tier === 'T0' ? 'class_session' : 'class_session_soon';
      try {
        const result = await dispatchToUsers({
          prisma,
          eventKind: 'class_session',
          eventId: s.id,
          tier,
          userIds,
          title: baseTitle,
          body: TIER_BODY[tier],
          link,
          notificationType: notifType,
        });
        if (result.newPushedUsers > 0) {
          console.log(
            `[scheduler] dispatched session=${s.id} tier=${tier} new=${result.newPushedUsers} push_ok=${result.pushDelivered} invalid=${result.pushInvalid}`,
          );
        }
      } catch (e) {
        console.error(`[scheduler] dispatch failed session=${s.id} tier=${tier}`, e);
      }
    }
  }
}

async function tick(prisma: PrismaClient): Promise<void> {
  if (running) {
    console.warn('[scheduler] previous tick still running · skipping');
    return;
  }
  running = true;
  try {
    await tickClassSessions(prisma);
  } catch (e) {
    console.error('[scheduler] tick error', e);
  } finally {
    running = false;
  }
}

export function startScheduler(prisma: PrismaClient): void {
  if (timer) return;
  // env CRON_ENABLED=false 可禁用（测试 / dev 用）
  if (config.CRON_ENABLED === false) {
    console.log('[scheduler] disabled by CRON_ENABLED=false');
    return;
  }
  // 立即跑一次 · 防止刚启动时漏掉窗口
  tick(prisma).catch(() => {});
  timer = setInterval(() => {
    tick(prisma).catch(() => {});
  }, 60_000);
  console.log('[scheduler] started · tick every 60s');
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
