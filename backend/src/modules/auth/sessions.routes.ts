// 多设备会话管理
//   GET    /api/auth/sessions               列我自己的活跃 session
//   DELETE /api/auth/sessions/:id           吊销指定 session
//   POST   /api/auth/sessions/revoke-others 留当前 · 吊销其他所有 session（"在其他设备退出"）
//
// 安全约束：
//   - 仅能管理自己的 session（userId 校验）
//   - 当前 session 用 access token 的 sid claim 标记 · 不允许吊销当前
//   - 吊销 = 设 revokedAt · refresh 时校验拒绝
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getCurrentSessionId, requireUserId } from '../../lib/auth.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const idParam = z.object({ id: z.string().min(1) });
const TAGS = ['Auth'];
const SEC = [{ bearerAuth: [] as string[] }];

// 简化 user-agent → 可读设备名（safari/chrome/firefox/edge + ios/android/win/mac/linux）
function parseUA(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: 'unknown', os: 'unknown' };
  let browser = 'browser';
  let os = 'unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return { browser, os };
}

export const authSessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/auth/sessions', {
    schema: { tags: TAGS, summary: '我的活跃登录设备', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const currentSid = getCurrentSessionId(req);
    const now = new Date();
    const sessions = await prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { issuedAt: 'desc' },
    });
    return {
      data: sessions.map((s) => {
        const ua = parseUA(s.userAgent);
        return {
          id: s.id,
          isCurrent: s.id === currentSid,
          browser: ua.browser,
          os: ua.os,
          ipAddress: s.ipAddress,
          issuedAt: s.issuedAt,
          expiresAt: s.expiresAt,
        };
      }),
    };
  });

  app.delete('/api/auth/sessions/:id', {
    schema: { tags: TAGS, summary: '吊销指定 session（不可吊销当前）', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) throw BadRequest('路径参数不合法');
    const currentSid = getCurrentSessionId(req);
    if (parsed.data.id === currentSid) {
      throw Forbidden('不能吊销当前设备 · 请用退出登录');
    }
    const r = await prisma.authSession.updateMany({
      where: { id: parsed.data.id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (r.count === 0) throw NotFound('会话不存在或已吊销');
    return { data: { revoked: r.count } };
  });

  app.post('/api/auth/sessions/revoke-others', {
    schema: { tags: TAGS, summary: '在其他设备退出 · 留当前 session · 吊销其他所有', security: SEC },
  }, async (req) => {
    const userId = requireUserId(req);
    const currentSid = getCurrentSessionId(req);
    if (!currentSid) {
      throw Forbidden('当前 token 缺少 session id · 无法定位当前设备');
    }
    const r = await prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        id: { not: currentSid },
      },
      data: { revokedAt: new Date() },
    });
    return { data: { revoked: r.count } };
  });
};
