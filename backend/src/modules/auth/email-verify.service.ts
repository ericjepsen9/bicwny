// 邮箱验证（AU3）
//
//   POST /api/auth/verify-email { token }
//     · 校验 token：未消费 · 未过期 · 用户仍 isActive
//     · 原子：set User.emailVerifiedAt + 标 usedAt + 同用户其它 token 一并消费
//
//   POST /api/auth/resend-verify  (需登录)
//     · 单用户 1 小时内最多 3 次（防 DOS · 与 AU6 找回密码同口径）
//     · 已验证用户调用直接 200，不发新 token
//
//   注册流程：registerUser 成功后调 createVerificationToken（dev console 输出）
//
// 邮件发送留待真 SMTP 集成；当前 dev 通过日志透出链接。
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../../lib/config.js';
import { BadRequest, Conflict, NotFound, Unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const TOKEN_TTL_HOURS = 24;
const TOKEN_BYTES = 32; // 256 位熵

// AU3: 单用户 1 小时内最多 3 条 verify token · 防 DOS
const PER_USER_WINDOW_MS = 60 * 60 * 1000;
const PER_USER_LIMIT = 3;

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export interface VerifyTokenResult {
  /** 仅 dev / test 环境回传，便于本地调试 */
  devToken?: string;
}

/**
 * 创建邮箱验证 token · 注册时 + 用户主动重发时调
 * - 不做速率限制（registerUser 单次调用 + resendVerification 已带速率限制）
 * - 同一用户已有 unused token 不主动作废 · 由 verifyEmail 时统一处理
 */
export async function createVerificationToken(
  userId: string,
): Promise<VerifyTokenResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || !user.email) {
    throw NotFound('用户不存在或邮箱缺失');
  }
  if (user.emailVerifiedAt) {
    throw Conflict('邮箱已验证');
  }

  const raw = generateToken();
  const hash = sha256(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60_000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hash, expiresAt },
  });

  // dev / test 环境把链接打到 console + 通过响应回传
  // prod 环境永远 undefined · 必须接邮件服务才能到达用户
  const hint = `[email-verify] ${user.email} → token=${raw} (expires ${expiresAt.toISOString()})`;
  const exposeToken =
    config.NODE_ENV === 'development' || config.NODE_ENV === 'test';
  if (exposeToken) {
    // eslint-disable-next-line no-console
    console.log(hint);
  }
  // TODO(prod): 接入 SMTP / SendGrid · 把 raw 拼成 verify-email 链接发给 user.email

  return exposeToken ? { devToken: raw } : {};
}

/**
 * 用户主动重发 · 速率限制：1 小时内 ≤ 3 次
 */
export async function resendVerification(
  userId: string,
): Promise<VerifyTokenResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || !user.email) {
    throw NotFound('用户不存在或邮箱缺失');
  }
  if (user.emailVerifiedAt) {
    return {}; // 已验证 · 静默成功
  }

  const recentCount = await prisma.emailVerificationToken.count({
    where: {
      userId,
      requestedAt: { gt: new Date(Date.now() - PER_USER_WINDOW_MS) },
    },
  });
  if (recentCount >= PER_USER_LIMIT) {
    throw Conflict(`重发次数过多，请 ${TOKEN_TTL_HOURS} 小时后再试`);
  }

  return createVerificationToken(userId);
}

/**
 * 用 token 验证邮箱
 * - 未消费 · 未过期 · 用户仍 isActive 才放行
 * - 原子：set User.emailVerifiedAt + 标 usedAt + 同用户其它 token 一并消费
 */
export async function verifyEmail(rawToken: string): Promise<void> {
  if (!rawToken || rawToken.length < 20) throw BadRequest('token 非法');
  const hash = sha256(rawToken);
  const t = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hash },
  });

  if (!t) throw Unauthorized('token 无效或已过期');
  if (t.usedAt) throw Unauthorized('token 无效或已过期');
  if (t.expiresAt.getTime() < Date.now()) throw Unauthorized('token 无效或已过期');

  const user = await prisma.user.findUnique({ where: { id: t.userId } });
  if (!user || !user.isActive) throw Unauthorized('token 无效或已过期');
  if (user.emailVerifiedAt) {
    // 幂等 · 已验证则只标 token usedAt 不重复 set
    await prisma.emailVerificationToken.update({
      where: { id: t.id },
      data: { usedAt: new Date() },
    });
    return;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: t.userId },
      data: { emailVerifiedAt: now },
    }),
    prisma.emailVerificationToken.update({
      where: { id: t.id },
      data: { usedAt: now },
    }),
    // 同用户其它未用 token 一并作废
    prisma.emailVerificationToken.updateMany({
      where: { userId: t.userId, usedAt: null, id: { not: t.id } },
      data: { usedAt: now },
    }),
  ]);
}
