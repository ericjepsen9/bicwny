// 认证 HTTP 路由
//   POST /api/auth/register        → 201 { user, accessToken, refreshToken }
//   POST /api/auth/login           → 200 { user, accessToken, refreshToken }
//   POST /api/auth/refresh         → 200 { accessToken, refreshToken }
//   POST /api/auth/logout          → 200 { ok: true }（幂等）
//   POST /api/auth/forgot          → 200 · 找回密码（邮件 token）
//   POST /api/auth/reset           → 200 · 用 forgot token 重置密码
//   POST /api/auth/verify-email    → 200 · 验证邮箱（AU3 · 公开）
//   POST /api/auth/resend-verify   → 200 · 重发邮箱验证（AU3 · 需登录 · 速率限制）
//   GET  /api/auth/me              → 200 { ...user, 不含 passwordHash }
//
// /me 依赖 requireUserId：Sprint 1 阶段走 dev fake user；B.5 后走 JWT preHandler。
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireUserId } from '../../lib/auth.js';
import { verifyCaptcha } from '../../lib/captcha.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { zBody } from '../../lib/openapi.js';
import { prisma } from '../../lib/prisma.js';
import { resendVerification, verifyEmail } from './email-verify.service.js';
import { forgotPassword, resetPassword } from './password-reset.service.js';
import { exportFilename, exportUserData } from './export.service.js';
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
  // CAPTCHA token · CAPTCHA_PROVIDER='none' 时可选 · 否则必填
  captchaToken: z.string().max(2048).optional(),
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

const forgotBody = z.object({
  email: z.string().email(),
  captchaToken: z.string().max(2048).optional(),
});

const resetBody = z.object({
  token: z.string().min(20).max(128),
  newPassword: z.string().min(6).max(128),
});

// AU3: 邮箱验证 token 校验
const verifyEmailBody = z.object({
  token: z.string().min(20).max(128),
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
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await verifyCaptcha(parsed.data.captchaToken, req.ip);
    const result = await registerUser(app, {
      email: parsed.data.email,
      password: parsed.data.password,
      dharmaName: parsed.data.dharmaName,
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    reply.code(201);
    return { data: result };
  });

  app.post('/api/auth/login', {
    schema: { tags: TAGS, summary: '登录', body: zBody(loginBody) },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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

  // 忘记密码：请求重置链接。无论邮箱是否存在，响应一致 { ok: true }，防枚举。
  // Dev 环境响应带 devToken，便于本地不接 SMTP 走通流程。
  app.post('/api/auth/forgot', {
    schema: { tags: TAGS, summary: '忘记密码 · 发送重置链接', body: zBody(forgotBody) },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req) => {
    const parsed = forgotBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await verifyCaptcha(parsed.data.captchaToken, req.ip);
    const result = await forgotPassword(parsed.data.email, req.ip);
    return { data: { ok: true, ...result } };
  });

  // 重置密码：凭 forgot 下发的 token 设置新密码。成功后所有 session 吊销。
  app.post('/api/auth/reset', {
    schema: { tags: TAGS, summary: '重置密码 · 用 forgot 下发的 token', body: zBody(resetBody) },
  }, async (req) => {
    const parsed = resetBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await resetPassword(parsed.data.token, parsed.data.newPassword);
    return { data: { ok: true } };
  });

  // AU3: 邮箱验证 · 公开端点 · 凭注册 / resend 下发的 token
  app.post('/api/auth/verify-email', {
    schema: { tags: TAGS, summary: '验证邮箱', body: zBody(verifyEmailBody) },
  }, async (req) => {
    const parsed = verifyEmailBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());
    await verifyEmail(parsed.data.token);
    return { data: { ok: true } };
  });

  // AU3: 重发邮箱验证 · 需登录 · 单用户 1h ≤ 3 次
  //   响应包含 devToken（仅 dev/test 环境）· prod 永远 undefined
  app.post('/api/auth/resend-verify', {
    schema: {
      tags: TAGS,
      summary: '重发邮箱验证邮件',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const userId = requireUserId(req);
    const result = await resendVerification(userId);
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
        emailVerifiedAt: true,
        role: true,
        dharmaName: true,
        avatar: true,
        timezone: true,
        locale: true,
        isActive: true,
        hasOnboarded: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw NotFound('用户不存在');
    return { data: user };
  });

  // 首次登录引导完成 · 任一选择（加入班级 / 自由学习）后调一次
  app.post('/api/auth/onboarding-done', {
    schema: {
      tags: TAGS, summary: '标记首次引导已完成',
      security: [{ bearerAuth: [] }],
    },
  }, async (req) => {
    const userId = requireUserId(req);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { hasOnboarded: true },
      select: { id: true, hasOnboarded: true },
    });
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

  // 数据导出（GDPR style）· 单用户全量数据 JSON 下载
  // 简易速率限制：5 分钟内一次（in-memory · 生产 Redis 更稳）· 写一条 AuditLog
  // 不收 password · 已登录态足够 · 防止偷窃直接看 token 也能导出（同账户控制权）
  const exportCooldown = new Map<string, number>();
  app.get('/api/auth/me/data-export', {
    schema: {
      tags: TAGS,
      summary: '导出本人全部数据（JSON 下载）· 5 分钟一次',
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const userId = requireUserId(req);
    const now = Date.now();
    const last = exportCooldown.get(userId) || 0;
    if (now - last < 5 * 60 * 1000) {
      const wait = Math.ceil((5 * 60 * 1000 - (now - last)) / 1000);
      throw BadRequest(`导出过于频繁 · 请 ${wait}s 后重试`);
    }
    exportCooldown.set(userId, now);
    // 清理 30 分钟前的过期 key · 防 map 无限增长
    if (exportCooldown.size > 1000) {
      const cutoff = now - 30 * 60 * 1000;
      for (const [k, t] of exportCooldown.entries()) {
        if (t < cutoff) exportCooldown.delete(k);
      }
    }

    const data = await exportUserData(userId);
    // 写审计 · admin 可追踪谁在什么时候导过 · 取证用
    await prisma.auditLog.create({
      data: {
        adminId: userId, // 用户自助也记 adminId 字段方便统一查询
        action: 'user.data_export',
        targetType: 'user',
        targetId: userId,
        after: {
          counts: {
            answers: data.answers.length,
            mistakes: data.mistakes.length,
            favorites: data.favorites.length,
            sm2Cards: data.sm2Cards.length,
            sessions: data.sessions.length,
            notifications: data.notifications.length,
          },
        },
      },
    });

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="${exportFilename(userId)}"`,
    );
    reply.header('Cache-Control', 'no-store');
    return data;
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
