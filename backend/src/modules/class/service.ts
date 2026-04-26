// 班级 · 成员数据层（createClass / addMember / removeMember / list*
//   / assertIsCoachOfClass / assertMemberOfClass / archiveClass）
//
// AuditLog 约定：actorAdminId 显式传入时（admin 路由）落审计记录，
// 学员自助 join/leave（student 路由）不传 actorAdminId 则不污染 admin 审计。
import { randomBytes } from 'node:crypto';
import { type Class, type ClassMember, type ClassMemberRole, Prisma } from '@prisma/client';
import { Forbidden, Internal, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

// 班级列表 / 详情 / 写操作返回时统一带的 course 选段
// admin 列表页 + 详情抽屉 + coach.html / class-detail.html 都依赖 c.course.{title|coverEmoji|...}
const CLASS_COURSE_INCLUDE = {
  course: {
    select: {
      id: true, slug: true, title: true, titleTraditional: true,
      author: true, coverEmoji: true,
    },
  },
} as const;

// 去掉 O/0/I/1 等易混淆字符，32 种选择 → 32^6 ≈ 10^9 码空间
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LEN = 6;
const MAX_CODE_RETRIES = 3;

export interface CreateClassInput {
  name: string;
  courseId: string; // 主修法本 · 必填
  description?: string;
  coverEmoji?: string;
}

export async function createClass(
  input: CreateClassInput,
  opts: { actorAdminId?: string } = {},
): Promise<Class> {
  // 校验 course 存在 + 已发布
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) throw NotFound('指定的法本不存在');
  if (!course.isPublished) throw NotFound('指定的法本未发布');

  for (let i = 0; i < MAX_CODE_RETRIES; i++) {
    const joinCode = generateJoinCode();
    const exists = await prisma.class.findUnique({ where: { joinCode } });
    if (!exists) {
      return prisma.$transaction(async (tx) => {
        const cls = await tx.class.create({
          data: {
            name: input.name,
            description: input.description,
            coverEmoji: input.coverEmoji,
            courseId: input.courseId,
            joinCode,
          },
          include: CLASS_COURSE_INCLUDE,
        });
        if (opts.actorAdminId) {
          await tx.auditLog.create({
            data: {
              adminId: opts.actorAdminId,
              action: 'class.create',
              targetType: 'class',
              targetId: cls.id,
              after: {
                name: cls.name,
                courseId: cls.courseId,
                joinCode: cls.joinCode,
              } as Prisma.InputJsonValue,
            },
          });
        }
        return cls;
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
  opts: {
    preserveExistingRole?: boolean;
    actorAdminId?: string;
    /**
     * 学员 join 路径联动：在同一事务内 upsert 该课程 enrollment。
     *  - 无 enrollment → create(source=class, viaClassId=classId)
     *  - source=self  → 升级为 class（保留进度，失去退课权）
     *  - source=class → 保留首班指针（不覆盖跨班统计）
     * admin 强制加成员路径不传，避免影响 enrollment 来源。
     */
    linkEnrollment?: { courseId: string };
  } = {},
): Promise<ClassMember> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    const member = await tx.classMember.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId, role },
      update: opts.preserveExistingRole
        ? { removedAt: null } // 学员 join：不降级已有 coach/admin
        : { removedAt: null, role }, // 管理员添加：强制设 role
    });

    if (opts.linkEnrollment) {
      const courseId = opts.linkEnrollment.courseId;
      // findUnique + create/update 模式 + P2002 兜底（并发同时 join 同 user 同 course）
      const existingEnr = await tx.userCourseEnrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!existingEnr) {
        try {
          await tx.userCourseEnrollment.create({
            data: { userId, courseId, source: 'class', enrolledViaClassId: classId },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            // 并发竞争：另一笔事务同 (userId, courseId) 已抢先 create
            // 退化为 update 路径 · 仅当原 source=self 时升级
            const concurrent = await tx.userCourseEnrollment.findUnique({
              where: { userId_courseId: { userId, courseId } },
            });
            if (concurrent && concurrent.source === 'self') {
              await tx.userCourseEnrollment.update({
                where: { id: concurrent.id },
                data: { source: 'class', enrolledViaClassId: classId },
              });
            }
            // concurrent 已是 'class' 源 → 保留不动
          } else {
            throw e;
          }
        }
      } else if (existingEnr.source === 'self') {
        await tx.userCourseEnrollment.update({
          where: { id: existingEnr.id },
          data: { source: 'class', enrolledViaClassId: classId },
        });
      }
      // existingEnr.source === 'class' → 保留首班指针不动
    }

    if (opts.actorAdminId) {
      await tx.auditLog.create({
        data: {
          adminId: opts.actorAdminId,
          action: 'class.member.add',
          targetType: 'classMember',
          targetId: member.id,
          before: before
            ? ({
                role: before.role,
                removedAt: before.removedAt,
              } as Prisma.InputJsonValue)
            : Prisma.DbNull,
          after: {
            classId,
            userId,
            role: member.role,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return member;
  });
}

export async function removeMember(
  classId: string,
  userId: string,
  opts: { actorAdminId?: string } = {},
): Promise<void> {
  // 退班联动 enrollment：
  //   1) 找所有 enrolledViaClassId=classId 的 enrollment（每条对应一个 courseId）
  //   2) 对每条 enrollment 看用户是否还在其他班里上同一 courseId
  //      - 是 → 把 enrolledViaClassId 转向另一个班（保留 source='class'）
  //      - 否 → 直接 delete enrollment（彻底失去课程访问权）
  //   原实现把 source 改回 'self' + 清 enrolledViaClassId，结果是「被踢出 A 班但
  //   仍可访问 A 班的法本」，违反"踢出即失访"语义。
  await prisma.$transaction(async (tx) => {
    const before = await tx.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
    });

    // 软删 ClassMember（保留 join 历史）
    await tx.classMember.updateMany({
      where: { classId, userId, removedAt: null },
      data: { removedAt: new Date() },
    });

    // 处理通过本班带来的 enrollment（批量化避免 N+1）
    //   1) 一次拿出本班关联的所有 orphan enrollment
    //   2) 一次拿出该用户其他活跃班级（含 class.courseId）→ JS 端建 courseId→fallbackClassId map
    //   3) 按 fallback 分桶 updateMany / deleteMany（每个桶一次往返）
    const orphans = await tx.userCourseEnrollment.findMany({
      where: { userId, enrolledViaClassId: classId },
      select: { id: true, courseId: true },
    });
    if (orphans.length > 0) {
      const otherClasses = await tx.classMember.findMany({
        where: {
          userId,
          removedAt: null,
          classId: { not: classId },
          class: { isActive: true },
        },
        select: { classId: true, class: { select: { courseId: true } } },
      });
      // 同一 courseId 可能在多个班 · 取第一个作为 fallback（顺序由 PG 决定，对结果语义无影响）
      const fallbackByCourse = new Map<string, string>();
      for (const m of otherClasses) {
        const cid = m.class.courseId;
        if (!fallbackByCourse.has(cid)) fallbackByCourse.set(cid, m.classId);
      }

      const updateBuckets = new Map<string, string[]>();
      const deleteIds: string[] = [];
      for (const enr of orphans) {
        const fb = fallbackByCourse.get(enr.courseId);
        if (fb) {
          if (!updateBuckets.has(fb)) updateBuckets.set(fb, []);
          updateBuckets.get(fb)!.push(enr.id);
        } else {
          deleteIds.push(enr.id);
        }
      }
      for (const [fbClassId, ids] of updateBuckets) {
        await tx.userCourseEnrollment.updateMany({
          where: { id: { in: ids } },
          data: { enrolledViaClassId: fbClassId },
        });
      }
      if (deleteIds.length > 0) {
        await tx.userCourseEnrollment.deleteMany({
          where: { id: { in: deleteIds } },
        });
      }
    }

    if (opts.actorAdminId) {
      await tx.auditLog.create({
        data: {
          adminId: opts.actorAdminId,
          action: 'class.member.remove',
          targetType: 'classMember',
          targetId: before?.id ?? null,
          before: before
            ? ({
                classId,
                userId,
                role: before.role,
                wasActive: before.removedAt === null,
              } as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });
    }
  });
}

export async function listMembers(classId: string, opts: { limit?: number } = {}) {
  // 默认 200 / 上限 500 · 防大班级（千人）一次拉爆
  const take = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  return prisma.classMember.findMany({
    where: { classId, removedAt: null },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    take,
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
    include: {
      class: {
        include: {
          course: {
            select: {
              id: true, slug: true, title: true, titleTraditional: true,
              author: true, coverEmoji: true,
            },
          },
        },
      },
    },
  });
}

export async function archiveClass(
  id: string,
  opts: { actorAdminId?: string } = {},
): Promise<Class> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.class.findUnique({
      where: { id },
      select: { isActive: true, archivedAt: true, name: true },
    });
    const cls = await tx.class.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date() },
      include: CLASS_COURSE_INCLUDE,
    });
    if (opts.actorAdminId) {
      await tx.auditLog.create({
        data: {
          adminId: opts.actorAdminId,
          action: 'class.archive',
          targetType: 'class',
          targetId: id,
          before: (before ?? Prisma.DbNull) as Prisma.InputJsonValue,
          after: {
            isActive: cls.isActive,
            archivedAt: cls.archivedAt,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return cls;
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

/** 断言 userId 是 classId 的当前在册成员（任何角色）；否则抛 Forbidden。 */
export async function assertMemberOfClass(
  classId: string,
  userId: string,
): Promise<void> {
  const m = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId } },
  });
  if (!m || m.removedAt) {
    throw Forbidden('学员不属于该班级');
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
