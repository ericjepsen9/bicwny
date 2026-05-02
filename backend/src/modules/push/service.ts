// Web Push 服务 · web-push lib 包装
//   - 启动时若 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 缺失 · sendPushTo* 直接 no-op
//     防止半配置状态炸 prod
//   - 410 Gone / 404 Not Found · endpoint 已被浏览器吊销 → 物理删除订阅
//   - 其他错误（502 / 超时）· log + 保留订阅给下次重试
import webPush from 'web-push';
import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  webPush.setVapidDetails(
    config.VAPID_SUBJECT,
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body?: string;
  link?: string; // 客户端 click → location.href · 默认 home.html
  tag?: string; // 同 tag 的通知会替换上一条 · 防刷屏
  icon?: string;
  badge?: string;
}

interface SendResult {
  delivered: number;
  invalid: number; // 410/404 已物理清理的数量
  failed: number;
}

/**
 * 给指定 user 推一条 · 该用户所有订阅设备都会收到
 * 返回成功 / 失效 / 失败计数 · 调用方可据此监控
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured()) {
    console.warn('[push] VAPID keys 未配置 · 跳过推送');
    return { delivered: 0, invalid: 0, failed: 0 };
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  return sendToSubscriptions(subs, payload);
}

/** 给一批 user 推 · 适用于班级公告等场景 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured()) {
    return { delivered: 0, invalid: 0, failed: 0 };
  }
  if (userIds.length === 0) return { delivered: 0, invalid: 0, failed: 0 };
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  return sendToSubscriptions(subs, payload);
}

interface SubLike {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToSubscriptions(
  subs: SubLike[],
  payload: PushPayload,
): Promise<SendResult> {
  let delivered = 0;
  let invalid = 0;
  let failed = 0;
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body || '',
    link: payload.link || 'home.html',
    tag: payload.tag,
    icon: payload.icon,
    badge: payload.badge,
  });
  await Promise.all(subs.map(async (s) => {
    try {
      await webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 * 60 * 24 }, // 24h · 用户离线超过这就丢弃这条推送
      );
      delivered++;
      // 触发 lastSeenAt 更新（异步 · 不阻塞）
      prisma.pushSubscription.update({
        where: { id: s.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 410 || e.statusCode === 404) {
        // endpoint 已被吊销 · 删
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        invalid++;
      } else {
        console.warn('[push] send failed:', e.statusCode, e.message);
        failed++;
      }
    }
  }));
  return { delivered, invalid, failed };
}

/** 取 30 天没活动的订阅 · 定期任务清理（暂未接 cron） */
export async function pruneStaleSubscriptions(daysOld = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const r = await prisma.pushSubscription.deleteMany({
    where: { lastSeenAt: { lt: cutoff } },
  });
  return r.count;
}
