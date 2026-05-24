// 通知调度器 · setInterval 60s tick · v2 多事件源
//   - 进程启动挂一次 · pm2 重启重新挂 · 单实例足够
//   - 抖动 ± 90 秒容忍 · 配合 DispatchLog unique 索引保证不重发
//   - 关闭方法：在测试 / dev 时 env CRON_ENABLED=false 跳过启动
//   - 事件源：① ClassSession 三档 · ③ PracticeTask 两档（t24h/t6h）· ④ Personal Reminder 三档
import type { PrismaClient } from '@prisma/client';
import { dispatchToUsers, type NotifType } from './dispatch.js';
import { tickPersonalReminders } from './personal-reminders.js';
import { gcOrphanedFiles } from '../courses/cover.service.js';
import { getBadgeDef } from '../achievements/service.js';
import { getAssembliesForT1hReminder } from '../dharma-assemblies/service.js';
import { config } from '../../lib/config.js';
import { reportJobError } from '../../lib/job-monitor.js';
import { pruneOldLogs } from '../../lib/log-retention.js';
import { pruneStaleSubscriptions } from '../push/service.js';

type ClassSessionTier = 'T-24h' | 'T-30' | 'T-5' | 'T0';
const TIER_OFFSETS: Record<ClassSessionTier, number> = {
  'T-24h': 24 * 60 * 60_000,
  'T-30': 30 * 60_000,
  'T-5': 5 * 60_000,
  'T0': 0,
};
// 窗口 ± 90 秒 · cron 每分钟 tick · 即使有抖动也能命中
const WINDOW_MS = 90_000;

const TIER_BODY: Record<ClassSessionTier, string> = {
  'T-24h': '明天将举行 · 24 小时后开始',
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
let retentionTimer: NodeJS.Timeout | null = null;
let running = false; // 防 tick 重入（上次没跑完下次就来了）

async function tickClassSessions(prisma: PrismaClient, sinceMs: number): Promise<void> {
  const now = Date.now();
  // 分档窄窗 OR（审计）· 每档 [now+offset±90s] · 只取真正临近某档的 session ·
  //   旧实现一次扫 [now-90s, now+24h+90s] 全量 · 加 T-24h 后每 60s 拉 24h 内所有 session+成员 ·
  //   绝大多数会被内存窗口过滤掉 · 纯浪费 I/O。
  // sinceMs：稳态 = now（窗口不变）· 启动补发 = 上次 tick（下界回扫 · DispatchLog 去重防双发）
  const tierWindows = (Object.values(TIER_OFFSETS) as number[]).map((offset) => ({
    startAt: {
      gte: new Date(sinceMs + offset - WINDOW_MS),
      lte: new Date(now + offset + WINDOW_MS),
    },
  }));

  // 只拉临近任一档的候选 · 然后内存中按各档窗口分类
  const sessions = await prisma.classSession.findMany({
    where: {
      OR: tierWindows,
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

    // push link 改为单场详情页 · liveLink 不放 push（SW safeLink 会拦外部 URL）
    // 学员进详情页有「加入直播 ↗」按钮 target=_blank 跳 liveLink
    const link = `/class/${s.classId}/sessions/${s.id}`;
    const baseTitle = `${s.class.name} · ${s.title}`;

    for (const [tier, offset] of Object.entries(TIER_OFFSETS) as [ClassSessionTier, number][]) {
      const expected = startMs - offset; // 期望触发时刻（startAt - 偏移）
      // 触发条件：期望时刻落在 [sinceMs-WINDOW, now+WINDOW]（稳态 sinceMs=now 即原 ±WINDOW）
      if (expected > now + WINDOW_MS || expected < sinceMs - WINDOW_MS) continue;

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
        reportJobError('class-session', 'dispatch failed', e, { sessionId: s.id, tier });
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
async function tickPracticeTasks(prisma: PrismaClient, sinceMs: number): Promise<void> {
  const now = Date.now();
  // 一次性查所有候选 · 内存中分档（避免双查询）
  // 最远 = t24h + 90s · 最近 = t6h - 90s（sinceMs 下界回扫支持启动补发）
  const minEnd = new Date(sinceMs + PRACTICE_TASK_OFFSETS.task_t6h - WINDOW_MS);
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
      if (expected > now + WINDOW_MS || expected < sinceMs - WINDOW_MS) continue; // 不在窗口（含补发回扫）

      try {
        const result = await dispatchToUsers({
          prisma,
          eventKind: 'practice_task',
          eventId: t.id,
          tier,
          userIds,
          title: `《${t.class.name}》${taskTitle}`,
          body: PRACTICE_TASK_BODY[tier],
          link: `/class/${t.class.id}`,
          notificationType: 'reminder',
          severity: PRACTICE_TASK_SEVERITY[tier],
        });
        if (result.newPushedUsers > 0) {
          console.log(
            `[scheduler] dispatched practice-task=${t.id} tier=${tier} new=${result.newPushedUsers} push_ok=${result.pushDelivered}`,
          );
        }
      } catch (e) {
        reportJobError('practice-task', 'dispatch failed', e, { taskId: t.id, tier });
      }
    }
  }
}

/**
 * 成就解锁 5min 聚合通知（spec §3.5 + §19.9）
 *
 * 触发逻辑:
 *   - submitAnswer / getAchievements 调用 detectAndPersistNewUnlocks 后
 *     UserAchievementUnlock 表会有 notifiedAt=null 的行
 *   - cron 每 60s 扫描：min(unlockedAt) 早于 5min 前 且 notifiedAt=null 的用户
 *   - 5min 窗口让多个解锁合并为一条通知（避免快速连续解锁产生多条）
 *
 * 文案 (spec §19.9):
 *   - 单条：🎉 解锁成就「title」
 *   - 聚合：🎉 解锁 N 个成就 · body=「A」·「B」·「C」
 */
const ACHIEVEMENT_AGGREGATE_MS = 5 * 60_000; // 5 分钟

async function tickAchievementUnlocks(prisma: PrismaClient): Promise<void> {
  const cutoff = new Date(Date.now() - ACHIEVEMENT_AGGREGATE_MS);
  // 找所有未通知 + 已超过 5min 的解锁记录
  const pending = await prisma.userAchievementUnlock.findMany({
    where: {
      notifiedAt: null,
      unlockedAt: { lt: cutoff },
    },
    orderBy: { unlockedAt: 'asc' },
    take: 500, // 单次 cap · 防大批量阻塞
  });
  if (pending.length === 0) return;

  // 按 userId 分组
  const byUser = new Map<string, typeof pending>();
  for (const row of pending) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId)!.push(row);
  }

  for (const [userId, rows] of byUser) {
    // 同时把同用户在 5min 内已存在但未到 cutoff 的也归入此次（避免拆批）
    // 注：rows 已是 cutoff 之前的 · 已包含「足够旧」的解锁
    const badgeIds = rows.map((r) => r.badgeId);
    const defs = badgeIds.map((id) => getBadgeDef(id)).filter((d): d is NonNullable<typeof d> => !!d);
    if (defs.length === 0) continue;

    const titles = defs.slice(0, 3).map((d) => d.titleSc);
    const more = defs.length > 3 ? ` 等 ${defs.length} 个` : '';
    const notifTitle = defs.length === 1
      ? `🎉 解锁成就「${titles[0]}」`
      : `🎉 解锁 ${defs.length} 个成就`;
    const notifBody = defs.length === 1
      ? defs[0].descSc
      : titles.join('·') + more;
    // 单条 link 到 highlight 那个 · 多条 link 到列表
    const link = defs.length === 1
      ? `/achievement?highlight=${encodeURIComponent(defs[0].id)}`
      : '/achievement';

    try {
      // eventId 用聚合后 unique key · 同 userId + 同批次 badge id 集合
      // 简化版：用最早 unlock 时间 + badgeIds 排序后 hash 当 eventId
      // 实际 dedup 由 dispatchLog 的 (kind, eventId, tier, userId, channel) 保证
      // 这里直接用 rows[0].id（最早一条的 id）作 eventId · 5min 后才扫到一次 · 不会冲突
      const eventId = rows[0].id;
      const result = await dispatchToUsers({
        prisma,
        eventKind: 'achievement',
        eventId,
        tier: 'unlocked',
        userIds: [userId],
        title: notifTitle,
        body: notifBody,
        link,
        notificationType: 'achievement',
        severity: 'normal',
      });
      // 标记 notifiedAt（不论 dispatch 是否新写入 · 都防再次扫到）
      await prisma.userAchievementUnlock.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { notifiedAt: new Date() },
      });
      if (result.newPushedUsers > 0) {
        console.log(
          `[scheduler] dispatched achievement userId=${userId} badges=${defs.length} push_ok=${result.pushDelivered}`,
        );
      }
    } catch (e) {
      reportJobError('achievement', 'dispatch failed', e, { userId });
    }
  }
}

/**
 * 法会 / 系统活动 · 每日 1h 前提醒（spec §3.7 daily_t1h tier）
 * 简化策略：找 startAt = now+1h 命中的（cron 窗口 ±90s）
 * v3 改进：DharmaAssembly 加 dailyTopics 子表精细化每日时刻
 */
async function tickDharmaAssemblies(prisma: PrismaClient): Promise<void> {
  const now = new Date();
  const assemblies = await getAssembliesForT1hReminder(now);
  if (assemblies.length === 0) return;

  // 给所有 active 用户发预告 · 游标分页（审计）· 不一次性把全量用户读进内存 ·
  // dispatchToUsers 按 (eventKind,eventId,tier,userId) 幂等 · 分批调用安全
  const PAGE = 1000;
  let cursor: string | undefined;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    const userIds = users.map((u) => u.id);
    for (const a of assemblies) {
      try {
        const result = await dispatchToUsers({
          prisma,
          eventKind: 'dharma_assembly',
          eventId: a.id,
          tier: 'daily_t1h',
          userIds,
          title: `${a.title} · 1 小时后开始`,
          body: '参与方式见详情',
          link: `/assemblies/${a.id}`,
          notificationType: 'system',
          severity: 'urgent',
        });
        if (result.newPushedUsers > 0) {
          console.log(`[scheduler] dispatched assembly=${a.id} tier=daily_t1h new=${result.newPushedUsers}`);
        }
      } catch (e) {
        reportJobError('dharma-assembly', 'dispatch failed', e, { assemblyId: a.id });
      }
    }
    if (users.length < PAGE) break;
    cursor = users[users.length - 1].id;
  }
}

// 心跳（审计 4.2）· 存最近一次成功 tick 的时刻 · 供启动补发回扫 + /health 探测「调度器卡死/停摆」
const HEARTBEAT_KEY = 'scheduler:lastTickAt';
const CATCHUP_CAP_MS = 15 * 60_000; // 补发回扫上限 · 防停机过久后回放过期提醒

async function writeHeartbeat(prisma: PrismaClient): Promise<void> {
  // 心跳写失败不应中断 tick（best-effort）
  await prisma.systemSetting.upsert({
    where: { key: HEARTBEAT_KEY },
    create: { key: HEARTBEAT_KEY, value: Date.now() },
    update: { value: Date.now() },
  }).catch(() => {});
}

async function readHeartbeat(prisma: PrismaClient): Promise<number | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: HEARTBEAT_KEY } });
  return typeof row?.value === 'number' ? row.value : null;
}

/** /health/detailed 用：调度器心跳新鲜度（staleSeconds 过大 = tick 卡死/停摆） */
export async function getSchedulerHeartbeat(prisma: PrismaClient): Promise<{ lastTickAt: number | null; staleSeconds: number | null }> {
  const last = await readHeartbeat(prisma);
  return { lastTickAt: last, staleSeconds: last == null ? null : Math.round((Date.now() - last) / 1000) };
}

// sinceMs：稳态默认 now（窗口与原逻辑一致）· 启动补发传入更早的回扫起点
async function tick(prisma: PrismaClient, sinceMs?: number): Promise<void> {
  if (running) {
    console.warn('[scheduler] previous tick still running · skipping');
    return;
  }
  running = true;
  const since = sinceMs ?? Date.now();
  try {
    await tickClassSessions(prisma, since);  // 支持补发回扫
    await tickPracticeTasks(prisma, since);  // 支持补发回扫
    await tickPersonalReminders(prisma);     // 时段型 · 稳态（补发意义小）
    await tickAchievementUnlocks(prisma);    // cutoff 聚合型 · 天然幂等
    await tickDharmaAssemblies(prisma);      // 窗口在 helper · 稳态
    await writeHeartbeat(prisma);
  } catch (e) {
    reportJobError('tick', 'top-level tick error', e);
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
  // 启动补发（审计 4.1）：回扫上次心跳以来错过的窗口（class session / practice task 两类）。
  //   DispatchLog (eventKind,eventId,tier,userId,channel) unique 幂等 → 重放不会重复发。
  //   回扫上限 CATCHUP_CAP_MS（15min）· 防停机过久后回放已过期的「现在开始」类提醒。
  //   个人提醒 / 法会窗口在各自 helper · 暂不补发（时段型 · 短停机影响小 · 见 tick 注释）。
  void (async () => {
    try {
      const last = await readHeartbeat(prisma);
      const now = Date.now();
      if (last != null && now - last > WINDOW_MS) {
        const since = Math.max(last, now - CATCHUP_CAP_MS);
        if (last < now - CATCHUP_CAP_MS) {
          reportJobError('scheduler-catchup', `停机过久 · 早于 ${CATCHUP_CAP_MS / 60_000}min 的提醒窗口已跳过`, new Error('catch-up capped'), { lastTickAt: new Date(last).toISOString() });
        }
        console.log(`[scheduler] 补发回扫 since=${new Date(since).toISOString()}`);
        await tick(prisma, since);
      } else {
        await tick(prisma); // 无心跳（首次部署）或间隔很短 · 正常跑一次
      }
    } catch (e) {
      reportJobError('scheduler-startup', 'startup catch-up tick failed', e);
    }
  })();
  timer = setInterval(() => {
    tick(prisma).catch(() => {});
  }, 60_000);
  console.log('[scheduler] started · tick every 60s');

  // 启动时跑一次孤儿文件 GC（spec §19.4 兜底）
  // 业务流量驱动 GC 在 cover 操作时触发 · 这里是「长期无 cover 操作」的兜底
  // 7 天前的 OrphanedFile 行 + 物理文件一次性清理 · 单次最多 100 行
  gcOrphanedFiles().then((n) => {
    if (n > 0) console.log(`[scheduler] gcOrphanedFiles cleaned ${n} files at startup`);
  }).catch((e) => reportJobError('gc-orphaned-files', 'startup GC failed', e));

  // 日志保留清理（审计）+ 过期 push 订阅清理 · 启动跑一次 + 每 24h 一次
  //   防 ErrorLog/DispatchLog 与 PushSubscription（410/404 软停用 + 30 天无活动）无限膨胀
  const runDailyMaintenance = () => {
    pruneOldLogs(prisma).catch(() => {});
    pruneStaleSubscriptions()
      .then((n) => { if (n > 0) console.log(`[scheduler] pruned ${n} stale push subscriptions`); })
      .catch((e) => reportJobError('prune-push', 'prune stale subscriptions failed', e));
  };
  runDailyMaintenance();
  retentionTimer = setInterval(runDailyMaintenance, 24 * 60 * 60_000);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
  if (retentionTimer) clearInterval(retentionTimer);
  retentionTimer = null;
}
