// 密码找回（忘记密码）流程
//
//   POST /api/auth/forgot { email }
//     · 无论邮箱是否存在，一律返回 { ok: true } 防枚举
//     · 若邮箱合法且账户可用：生成高熵 token，DB 存 sha256，原文通过邮件发给用户
//     · Dev 环境把原文 token + 链接也记到日志，便于本地调试（不依赖 SMTP）
//
//   POST /api/auth/reset { token, newPassword }
//     · 校验 token：未消费 · 未过期 · 对应用户仍可用
//     · 原子：更新 passwordHash、标 usedAt、吊销所有活跃 session、
//       同一用户其它未用 token 一并标记（防并发多个 token 共存）
//
// 邮件发送留待真 SMTP 集成；当前 dev 通过日志透出链接，prod 接入前请先配邮件服务。
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../../lib/config.js';
import { BadRequest, Unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from './hash.js';
import { normalizeEmail } from './service.helpers.js';

const TOKEN_TTL_MIN = 30;
const TOKEN_BYTES = 32; // 256 位熵

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateToken(): string {
  // base64url 便于放 URL；32 字节 → 43 字符
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export interface ForgotResult {
  /** 仅 dev / test 环境回传，便于本地调试；production 永远 undefined */
  devToken?: string;
}

export async function forgotPassword(
  email: string,
  ip?: string,
): Promise<ForgotResult> {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  // 静默成功：无论邮箱是否存在、是否被停用、是否无 passwordHash，
  // 响应体都相同 —— 防邮箱枚举 & 防通过错误消息爆破账户状态
  if (!user || !user.isActive || !user.passwordHash) {
    return {};
  }

  const raw = generateToken();
  const hash = sha256(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);

  // 原子作废用户所有未消费旧 token + 创建新 token
  // —— 防"重发邮件"产生多个并存有效 token 被历史邮件截获后改密
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt,
        requestIp: ip,
      },
    }),
  ]);

  // Dev / test：把链接打到日志 + 通过响应回传，方便本地跑通流程
  // 严格白名单：只在 NODE_ENV === 'development' || 'test' 时输出 raw token
  // 配置畸形（NODE_ENV 未设、设成奇怪值）一律按生产处理 → 不泄漏 token
  const hint = `[password-reset] ${normalized} → token=${raw} (expires ${expiresAt.toISOString()})`;
  const exposeToken =
    config.NODE_ENV === 'development' || config.NODE_ENV === 'test';
  if (exposeToken) {
    // eslint-disable-next-line no-console
    console.log(hint);
  }
  // TODO(prod)：接入 SMTP / SendGrid 等邮件服务，把 raw 拼成 reset-confirm 链接发给 user.email

  return exposeToken ? { devToken: raw } : {};
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  if (!rawToken || rawToken.length < 20) throw BadRequest('token 非法');
  const hash = sha256(rawToken);
  const t = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });

  // 统一错误消息，避免通过差异探测 token 存在性
  if (!t) throw Unauthorized('token 无效或已过期');
  if (t.usedAt) throw Unauthorized('token 无效或已过期');
  if (t.expiresAt.getTime() < Date.now()) throw Unauthorized('token 无效或已过期');

  const user = await prisma.user.findUnique({ where: { id: t.userId } });
  if (!user || !user.isActive) throw Unauthorized('token 无效或已过期');

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: t.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: t.id },
      data: { usedAt: now },
    }),
    // 同一用户其它未用 token 一并作废，防并发多个 token 共存
    prisma.passwordResetToken.updateMany({
      where: { userId: t.userId, usedAt: null, id: { not: t.id } },
      data: { usedAt: now },
    }),
    // 强制所有设备下线
    prisma.authSession.updateMany({
      where: { userId: t.userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}
