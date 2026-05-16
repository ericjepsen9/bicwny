// 通知调度器 · setInterval 60s tick · v2 多事件源
//   - 进程启动挂一次 · pm2 重启重新挂 · 单实例足够
//   - 抖动 ± 90 秒容忍 · 配合 DispatchLog unique 索引保证不重发
//   - 关闭方法：在测试 / dev 时 env CRON_ENABLED=false 跳过启动
//   - 事件源：① ClassSession 三档 · ③ PracticeTask 两档（t24h/t6h）· ④ Personal Reminder 三档
import type { PrismaClient } from '@prisma/client';
import { dispatchToUsers, type NotifType } from './dispatch.js';
import { tickPersonalReminders } from './personal-reminders.js';
import { gcOrphanedFiles } from '../courses/cover.service.js';
import { config } from '../../lib/config.js';

type ClassSessionTier = 'T-30' | 'T-5' | 'T0';
const TIER_OFFSETS: Record<ClassSessionTier, number> = {
  'T-30': 30 * 60_000,
  'T-5': 5 * 60_000,
  'T0': 0,
};
// 窗口 ± 90 秒 · cron 每分钟 tick · 即使有抖动也能命中
const WINDOW_MS = 90_000;

const TIER_BODY: Record<ClassSessionTier, string> = {
  'T-30': '30 分钟后开始',
  'T-5': '5 分钟后开始',
  'T0': '现在开始 · 立即进入',
};

// PracticeTask 截止前提醒（spec §3.3）
// 仅 fixed mode 任务（有 endAt）触发 · daily 任务每日刷新无截止
type PracticeTaskTier = 'task_t24h' | 'task_t6h';
const PRACTICE_TASK_OFFSETS: Record<PracticeTaskTier, number> = {
  task_t24h: 24 * 60 * 60_000,  // 24h
  task_t6h: 6 * 60 * 60_000,    //  6h
};
const PRACTICE_TASK_BODY: Record<PracticeTaskTier, string> = {
  task_t24h: '还有 24 小时完成',
  task_t6h: '⚠️ 6 小时后截止',
};
// spec §3.3 · t6h 自动升 urgent
const PRACTICE_TASK_SEVERITY: Record<PracticeTaskTier, 'normal' | 'urgent'> = {
  task_t24h: 'normal',
  task_t6h: 'urgent',
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

    for (const [tier, offset] of Object.entries(TIER_OFFSETS) as [ClassSessionTier, number][]) {
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

/**
 * 班级修学任务 · t24h / t6h 截止前提醒（spec §3.3）
 * 扫 fixed mode + endAt 在 24h / 6h 窗口内 + 未归档的任务
 * 给班级所有 active 学员发（dispatchToUsers 幂等防重发）
 *
 * 简化策略：发给所有班级学员 · 不检查个人完成状态
 *   - 优点：单次扫描简单 · 不需要每用户聚合 PracticeEntry
 *   - 缺点：已完成的学员会收到一次「确认」提醒（噪音较小 · 可接受）
 *   - TODO 优化：v3 时按 (userId, projectId) 聚合 PracticeEntry vs target 过滤
 */
async function tickPracticeTasks(prisma: PrismaClient): Promise<void> {
  const now = Date.now();
  // 一次性查所有候选 · 内存中分档（避免双查询）
  // 最远 = t24h + 90s · 最近 = t6h - 90s
  const minEnd = new Date(now + PRACTICE_TASK_OFFSETS.task_t6h - WINDOW_MS);
  const maxEnd = new Date(now + PRACTICE_TASK_OFFSETS.task_t24h + WINDOW_MS);

  const tasks = await prisma.practiceTask.findMany({
    where: {
      scope: 'class',
      mode: 'fixed',
      archivedAt: null,
      endAt: { gte: minEnd, lte: maxEnd },
      // 注意 classId 必有 · scope='class' 约束
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          members: {
            where: { removedAt: null, role: 'student', user: { isActive: true } },
            select: { userId: true },
          },
        },
      },
      project: { select: { name: true } },
    },
  });

  if (tasks.length === 0) return;

  for (const t of tasks) {
    if (!t.endAt || !t.class) continue;
    const userIds = t.class.members.map((m) => m.userId);
    if (userIds.length === 0) continue;

    const endMs = t.endAt.getTime();
    const taskTitle = t.title || t.project.name;

    for (const [tier, offset] of Object.entries(PRACTICE_TASK_OFFSETS) as [PracticeTaskTier, number][]) {
      const expected = endMs - offset; // 期望触发时刻
      if (Math.abs(now - expected) > WINDOW_MS) continue; // 不在该 tier 窗口

      try {
        const result = await dispatchToUsers({
          prisma,
          eventKind: 'practice_task',
          eventId: t.id,
          tier,
          userIds,
          title: `《${t.class.name}》${taskTitle}`,
          body: PRACTICE_TASK_BODY[tier],
          link: '/practice',
          notificationType: 'reminder',
          severity: PRACTICE_TASK_SEVERITY[tier],
        });
        if (result.newPushedUsers > 0) {
          console.log(
            `[scheduler] dispatched practice-task=${t.id} tier=${tier} new=${result.newPushedUsers} push_ok=${result.pushDelivered}`,
          );
        }
      } catch (e) {
        console.error(`[scheduler] practice-task dispatch failed task=${t.id} tier=${tier}`, e);
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
    await tickPracticeTasks(prisma);
    await tickPersonalReminders(prisma);
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

  // 启动时跑一次孤儿文件 GC（spec §19.4 兜底）
  // 业务流量驱动 GC 在 cover 操作时触发 · 这里是「长期无 cover 操作」的兜底
  // 7 天前的 OrphanedFile 行 + 物理文件一次性清理 · 单次最多 100 行
  gcOrphanedFiles().then((n) => {
    if (n > 0) console.log(`[scheduler] gcOrphanedFiles cleaned ${n} files at startup`);
  }).catch((e) => console.error('[scheduler] gcOrphanedFiles failed at startup:', e));
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
