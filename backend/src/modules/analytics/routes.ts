// 分析埋点 ingestion · 高频写入端点
//   POST /api/analytics/events            可选鉴权 · 批量 insert · 限频
//   GET  /api/admin/analytics/summary     admin · 简易聚合（DAU / event 计数 / 时间段）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getUserId, requireRole } from '../../lib/auth.js';
import { BadRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const eventSchema = z.object({
  event: z.string().min(1).max(60),
  properties: z.record(z.unknown()).optional(),
  page: z.string().max(120).optional(),
  sessionId: z.string().min(8).max(64),
  ts: z.number().int().optional(), // 客户端时间戳 · 仅参考
});

const ingestBody = z.object({
  events: z.array(eventSchema).min(1).max(100), // 单批最多 100
});

const summaryQuery = z.object({
  fromDays: z.coerce.number().int().min(1).max(90).default(7),
  event: z.string().max(60).optional(),
});

const TAGS = ['Analytics'];
const SEC = [{ bearerAuth: [] as string[] }];

const adminGuard = requireRole('admin');

// 简单 in-memory 限频 · session 维度 · 每 5 秒最多 200 events
//   超出直接丢弃旧事件 + 返 429 提示客户端降速
//   重启清空 · 接受这个简化（短期防滥用）· 长期可上 redis
const sessionRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 5_000;
const RATE_MAX = 200;
function checkRate(sessionId: string): boolean {
  const now = Date.now();
  const r = sessionRateMap.get(sessionId);
  if (!r || r.resetAt < now) {
    sessionRateMap.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  r.count++;
  return r.count <= RATE_MAX;
}
// 定期清过期项 · 防 map 长大
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessionRateMap) {
    if (v.resetAt < now - 60_000) sessionRateMap.delete(k);
  }
}, 60_000).unref();

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/analytics/events', {
    schema: { tags: TAGS, summary: '埋点批量上报（鉴权可选）', security: SEC },
  }, async (req, reply) => {
    const parsed = ingestBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const events = parsed.data.events;
    const sessionId = events[0]?.sessionId || 'anonymous';
    if (!checkRate(sessionId)) {
      reply.code(429);
      return { data: { accepted: 0, dropped: events.length, reason: 'RATE_LIMITED' } };
    }
    const userId = getUserId(req); // null = 匿名 OK
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    const referrer = (req.headers.referer || req.headers.referrer || '') as string;

    const rows = events.map((e) => ({
      userId: userId || null,
      sessionId: e.sessionId,
      event: e.event,
      properties: (e.properties || {}) as object,
      page: e.page || null,
      userAgent,
      referrer: referrer ? referrer.slice(0, 500) : null,
    }));
    await prisma.analyticsEvent.createMany({ data: rows, skipDuplicates: false });
    reply.code(202);
    return { data: { accepted: rows.length } };
  });

  // 极简 admin 聚合 · 后续可拆专门的 dashboard
  app.get('/api/admin/analytics/summary', {
    preHandler: adminGuard,
    schema: { tags: ['Admin'], summary: 'Analytics 聚合（事件计数 / DAU）', security: SEC },
  }, async (req) => {
    const parsed = summaryQuery.safeParse(req.query);
    if (!parsed.success) throw BadRequest('查询参数不合法');
    const since = new Date(Date.now() - parsed.data.fromDays * 24 * 3600 * 1000);
    const eventFilter = parsed.data.event
      ? { event: parsed.data.event }
      : {};
    // 总事件数
    const total = await prisma.analyticsEvent.count({
      where: { createdAt: { gte: since }, ...eventFilter },
    });
    // 按 event 分组
    const byEvent = await prisma.analyticsEvent.groupBy({
      by: ['event'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 30,
    });
    // DAU · userId 不为空的当日去重
    //   注：postgres groupBy + COUNT DISTINCT 走 raw 更省 · prisma 多步替代
    const dau = await prisma.$queryRaw<Array<{ day: Date; uniq: bigint }>>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(DISTINCT "userId") AS uniq
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${since} AND "userId" IS NOT NULL
      GROUP BY day
      ORDER BY day ASC
    `;
    return {
      data: {
        fromDays: parsed.data.fromDays,
        total,
        byEvent: byEvent.map((b) => ({ event: b.event, count: b._count._all })),
        dau: dau.map((d) => ({ day: d.day, uniqueUsers: Number(d.uniq) })),
      },
    };
  });
};
