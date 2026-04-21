// 班级 · 成员数据层
// - createClass：随机 6 位 joinCode，冲突重试
// - addMember / removeMember：upsert + 软删除（保留历史）
// - listMembers / listUserClasses / getClass / findClassByCode / archiveClass
import { randomBytes } from 'node:crypto';
import type { Class, ClassMember, ClassMemberRole } from '@prisma/client';
import { Forbidden, Internal, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

// 去掉 O/0/I/1 等易混淆字符，32 种选择 → 32^6 ≈ 10^9 码空间
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LEN = 6;
const MAX_CODE_RETRIES = 3;

export interface CreateClassInput {
  name: string;
  description?: string;
  coverEmoji?: string;
}

export async function createClass(input: CreateClassInput): Promise<Class> {
  for (let i = 0; i < MAX_CODE_RETRIES; i++) {
    const joinCode = generateJoinCode();
    const exists = await prisma.class.findUnique({ where: { joinCode } });
    if (!exists) {
      return prisma.class.create({
        data: {
          name: input.name,
          description: input.description,
          coverEmoji: input.coverEmoji,
          joinCode,
        },
      });
    }
  }
  throw Internal('生成班级加入码失败（多次冲突）');
}

export async function getClass(id: string): Promise<Class> {
  const c = await prisma.class.findUnique({ where: { id } });
  if (!c) throw NotFound('班级不存在');
  return c;
}

export async function findClassByCode(joinCode: string): Promise<Class> {
  const c = await prisma.class.findUnique({ where: { joinCode } });
  if (!c || !c.isActive) throw NotFound('加入码无效或班级已归档');
  return c;
}

export async function addMember(
  classId: string,
  userId: string,
  role: ClassMemberRole,
): Promise<ClassMember> {
  return prisma.classMember.upsert({
    where: { classId_userId: { classId, userId } },
    create: { classId, userId, role },
    update: { removedAt: null, role }, // 重新加入或身份变更
  });
}

export async function removeMember(
  classId: string,
  userId: string,
): Promise<void> {
  await prisma.classMember.updateMany({
    where: { classId, userId, removedAt: null },
    data: { removedAt: new Date() },
  });
}

export async function listMembers(classId: string) {
  return prisma.classMember.findMany({
    where: { classId, removedAt: null },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          dharmaName: true,
          avatar: true,
          lastLoginAt: true,
        },
      },
    },
  });
}

export async function listUserClasses(
  userId: string,
  role?: ClassMemberRole,
) {
  return prisma.classMember.findMany({
    where: {
      userId,
      removedAt: null,
      ...(role ? { role } : {}),
      class: { isActive: true },
    },
    orderBy: { joinedAt: 'desc' },
    include: { class: true },
  });
}

export async function archiveClass(id: string): Promise<Class> {
  return prisma.class.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date() },
  });
}

/** 断言 userId 是 classId 的当前辅导员；否则抛 Forbidden。 */
export async function assertIsCoachOfClass(
  userId: string,
  classId: string,
): Promise<void> {
  const m = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId } },
  });
  if (!m || m.removedAt || m.role !== 'coach') {
    throw Forbidden('非该班级辅导员');
  }
}

// ───── helpers ─────

function generateJoinCode(): string {
  const bytes = randomBytes(JOIN_CODE_LEN);
  let code = '';
  for (let i = 0; i < JOIN_CODE_LEN; i++) {
    code += JOIN_CODE_CHARS[bytes[i] % JOIN_CODE_CHARS.length];
  }
  return code;
}
