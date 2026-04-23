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
import { zBody } from '../../lib/openapi.js';
import { prisma } from '../../lib/prisma.js';
import {
  changePassword,
  deleteAccount,
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

const deleteMeBody = z.object({
  currentPassword: z.string().min(1),
});

const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(128),
  })
  .refine((p) => p.currentPassword !== p.newPassword, {
    message: '新密码与旧密码不能相同',
    path: ['newPassword'],
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

const TAGS = ['Auth'];

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/register', {
    schema: { tags: TAGS, summary: '注册账号', body: zBody(registerBody) },
  }, async (req, reply) => {
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

  app.post('/api/auth/login', {
    schema: { tags: TAGS, summary: '登录', body: zBody(loginBody) },
  }, async (req) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const result = await loginUser(app, {
      ...parsed.data,
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data: result };
  });

  app.post('/api/auth/refresh', {
    schema: { tags: TAGS, summary: '刷新 access token', body: zBody(refreshBody) },
  }, async (req) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const result = await refreshSession(app, parsed.data.refreshToken, {
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data: result };
  });

  app.post('/api/auth/logout', {
    schema: { tags: TAGS, summary: '登出（吊销 refresh）', body: zBody(refreshBody) },
  }, async (req) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await logout(app, parsed.data.refreshToken);
    return { data: { ok: true } };
  });

  app.get('/api/auth/me', {
    schema: {
      tags: TAGS, summary: '当前用户',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
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

  app.patch('/api/auth/me', {
    schema: {
      tags: TAGS, summary: '更新本人资料',
      security: [{ bearerAuth: [] }],
      body: zBody(updateMeBody),
    },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = updateMeBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    const user = await updateMe(userId, parsed.data);
    return { data: user };
  });

  // 改密后会吊销所有 session，前端应立即清 token 跳登录
  app.post('/api/auth/change-password', {
    schema: {
      tags: TAGS, summary: '修改密码（改后所有会话吊销）',
      security: [{ bearerAuth: [] }],
      body: zBody(changePasswordBody),
    },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = changePasswordBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword);
    return { data: { ok: true } };
  });

  // 注销：软删除（isActive=false + 清 email/passwordHash）+ 吊销全部 session
  // 保留 UserAnswer / Sm2Card / AuditLog 等历史记录的 FK 完整性
  app.delete('/api/auth/me', {
    schema: {
      tags: TAGS, summary: '注销账号（软删除）',
      security: [{ bearerAuth: [] }],
      body: zBody(deleteMeBody),
    },
  }, async (req) => {
    const userId = requireUserId(req);
    const parsed = deleteMeBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await deleteAccount(userId, parsed.data.currentPassword);
    return { data: { ok: true } };
  });
};
