// 认证 HTTP 路由
//   POST /api/auth/register  → 201 { user, accessToken, refreshToken }
//   POST /api/auth/login     → 200 { user, accessToken, refreshToken }
//   POST /api/auth/refresh   → 200 { accessToken, refreshToken }
//   POST /api/auth/logout    → 200 { ok: true }（幂等）
//   GET  /api/auth/me        → 200 { ...user, 不含 passwordHash }
//
// /me 依赖 requireUserId：Sprint 1 阶段走 dev fake user；B.5 后走 JWT preHandler。
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  loginUser,
  logout,
  refreshSession,
  registerUser,
  updateMe,
} from './service.js';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  dharmaName: z.string().max(64).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

const updateMeBody = z
  .object({
    // 空串 → 清空；undefined → 保持不变
    dharmaName: z.string().max(64).nullable().optional(),
    avatar: z.string().max(256).nullable().optional(),
    // IANA 时区名或 zh-Hans/zh-Hant 这类 BCP-47 取值；长度上限保守给到 64
    timezone: z.string().min(1).max(64).optional(),
    locale: z.string().min(2).max(16).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'patch 不能为空' });

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const result = await registerUser(app, {
      ...parsed.data,
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    reply.code(201);
    return { data: result };
  });

  app.post('/api/auth/login', async (req) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const result = await loginUser(app, {
      ...parsed.data,
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data: result };
  });

  app.post('/api/auth/refresh', async (req) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const result = await refreshSession(app, parsed.data.refreshToken, {
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data: result };
  });

  app.post('/api/auth/logout', async (req) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await logout(app, parsed.data.refreshToken);
    return { data: { ok: true } };
  });

  app.get('/api/auth/me', async (req) => {
    const userId = requireUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        dharmaName: true,
        avatar: true,
        timezone: true,
        locale: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw NotFound('用户不存在');
    return { data: user };
  });

  app.patch('/api/auth/me', async (req) => {
    const userId = requireUserId(req);
    const parsed = updateMeBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const user = await updateMe(userId, parsed.data);
    return { data: user };
  });
};
