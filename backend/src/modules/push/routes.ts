// Web Push HTTP 路由
//   GET    /api/push/vapid-public-key   公开 · 客户端 subscribe 用
//   POST   /api/push/subscribe          鉴权 · 上报订阅
//   DELETE /api/push/subscribe          鉴权 · 取消订阅（按 endpoint）
//   POST   /api/push/test               鉴权 · 给自己发一条测试推送
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { config } from '../../lib/config.js';
import { BadRequest, Internal } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendPushToUser } from './service.js';

const subscribeBody = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
  platform: z.enum(['web', 'ios', 'android', 'capacitor-ios', 'capacitor-android']).optional(),
  userAgent: z.string().max(500).optional(),
});

const unsubscribeBody = z.object({
  endpoint: z.string().url().max(2000),
});

const TAGS = ['Push'];
const SEC = [{ bearerAuth: [] as string[] }];

export const pushRoutes: FastifyPluginAsync = async (app) => {
  // 公开端点 · 客户端 subscribe 时需要这把 key
  app.get('/api/push/vapid-public-key', {
    schema: { tags: TAGS, summary: 'VAPID 公钥（前端 subscribe 用）' },
  }, async () => {
    if (!config.VAPID_PUBLIC_KEY) {
      throw Internal('Web Push 未配置（VAPID_PUBLIC_KEY 缺失）');
    }
    return { data: { key: config.VAPID_PUBLIC_KEY } };
  });

  app.post('/api/push/subscribe', {
    schema: { tags: TAGS, summary: '上报推送订阅', security: SEC },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const parsed = subscribeBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('订阅参数不合法', parsed.error.flatten());
    const b = parsed.data;
    // upsert by endpoint · 同设备重复订阅时只更新 user / lastSeen
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: b.endpoint },
      create: {
        userId,
        endpoint: b.endpoint,
        p256dh: b.keys.p256dh,
        auth: b.keys.auth,
        platform: b.platform || 'web',
        userAgent: b.userAgent || null,
      },
      update: {
        userId, // 同设备换账号 · 更新 ownership
        p256dh: b.keys.p256dh,
        auth: b.keys.auth,
        platform: b.platform || 'web',
        userAgent: b.userAgent || null,
        lastSeenAt: new Date(),
      },
    });
    reply.code(201);
    return { data: { id: sub.id } };
  });

  app.delete('/api/push/subscribe', {
    schema: { tags: TAGS, summary: '取消推送订阅', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = unsubscribeBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('取消参数不合法');
    // 仅删属于自己的 · 防止知道 endpoint 就能 ghost 别人
    const r = await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint: parsed.data.endpoint },
    });
    return { data: { removed: r.count } };
  });

  app.post('/api/push/test', {
    schema: { tags: TAGS, summary: '给自己发测试推送', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const result = await sendPushToUser(userId, {
      title: '觉学测试推送',
      body: '如果您看到这条 · 推送已正常工作 ✓',
      link: 'home.html',
      tag: 'test',
    });
    return { data: result };
  });
};
