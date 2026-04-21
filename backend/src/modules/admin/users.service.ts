// Admin 用户管理
// - listUsers：createdAt 降序 + 游标分页，可按 role 过滤 / email+dharmaName 模糊搜索
// - updateUserRole：禁止把自己降级（防锁死所有 admin）+ AuditLog
// - setUserActive：停用时在同事务内吊销所有活跃 AuthSession + AuditLog
import type { Prisma, User, UserRole } from '@prisma/client';
import { Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export type PublicUser = Omit<User, 'passwordHash'>;

function stripPassword(u: User): PublicUser {
  const { passwordHash: _removed, ...rest } = u;
  return rest;
}

export interface ListUsersOpts {
  limit?: number;
  cursor?: string;
  role?: UserRole;
  search?: string;
}

export async function listUsers(
  opts: ListUsersOpts = {},
): Promise<PublicUser[]> {
  const where: Prisma.UserWhereInput = {
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.search
      ? {
          OR: [
            { email: { contains: opts.search, mode: 'insensitive' } },
            { dharmaName: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  return rows.map(stripPassword);
}

export async function updateUserRole(
  userId: string,
  adminId: string,
  role: UserRole,
): Promise<PublicUser> {
  if (userId === adminId && role !== 'admin') {
    throw Forbidden('不能把自己降级');
  }
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw NotFound('用户不存在');
  if (before.role === role) return stripPassword(before);

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role } }),
    prisma.auditLog.create({
      data: {
        adminId,
        action: 'user.updateRole',
        targetType: 'user',
        targetId: userId,
        before: { role: before.role } as Prisma.InputJsonValue,
        after: { role } as Prisma.InputJsonValue,
      },
    }),
  ]);
  return stripPassword(updated);
}

export async function setUserActive(
  userId: string,
  adminId: string,
  isActive: boolean,
): Promise<PublicUser> {
  if (userId === adminId && !isActive) {
    throw Forbidden('不能停用自己');
  }
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw NotFound('用户不存在');

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { isActive },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: isActive ? 'user.reactivate' : 'user.deactivate',
        targetType: 'user',
        targetId: userId,
        before: { isActive: before.isActive } as Prisma.InputJsonValue,
        after: { isActive } as Prisma.InputJsonValue,
      },
    });
    if (!isActive) {
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return u;
  });

  return stripPassword(updated);
}
