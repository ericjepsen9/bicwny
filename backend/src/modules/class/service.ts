// 班级 · 成员数据层（createClass / addMember / removeMember / list*
//   / assertIsCoachOfClass / assertMemberOfClass / archiveClass）
//
// AuditLog 约定：actorAdminId 显式传入时（admin 路由）落审计记录，
// 学员自助 join/leave（student 路由）不传 actorAdminId 则不污染 admin 审计。
import { randomBytes } from 'node:crypto';
import { type Class, type ClassMember, type ClassMemberRole, Prisma } from '@prisma/client';
import { Conflict, Forbidden, Internal, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { migratePracticeOnLeave } from '../practice/migration.js';
import { dispatchToUsers } from '../scheduler/dispatch.js';

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

// 邀请码：6 位纯数字 · 10^6 = 100 万码空间 · 配合 MAX_CODE_RETRIES 防冲突
// 用户更易输入 / 记忆 / 口述 · 不区分字母大小写问题
const JOIN_CODE_CHARS = '0123456789';
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
  // 是否「真正新加入」· 用于事务后是否发 joined 通知
  // 满足任一即算新加入：之前 row 不存在 / 之前 row removedAt 不为 null（重新激活）
  let wasNewlyJoined = false;

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    wasNewlyJoined = !before || before.removedAt !== null;
    const member = await tx.classMember.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId, role },
      update: opts.preserveExistingRole
        ? { removedAt: null } // 学员 join：不降级已有 coach/admin
        : { removedAt: null, role }, // 管理员添加：强制设 role
    });

    if (opts.linkEnrollment) {
      const courseId = opts.linkEnrollment.courseId;
      // C3: 新语义
      //   source: 用户与法本的'本源关系' · 一旦写入永不变（self / class）
      //   enrolledViaClassId: 当前是否被某班关联（动态指针）
      // 自学过的 → 加班只挂 enrolledViaClassId · 不破坏 source='self'
      // 之前实现把 source 升级为 'class' · 退班无 fallback 时会 delete 整条 enrollment，
      // 用户失去自学进度访问权 → 违反"自学先于加班"的预期
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
            // 退化为 update 路径 · 只挂 enrolledViaClassId · 保留 source 不变
            const concurrent = await tx.userCourseEnrollment.findUnique({
              where: { userId_courseId: { userId, courseId } },
            });
            if (concurrent && !concurrent.enrolledViaClassId) {
              await tx.userCourseEnrollment.update({
                where: { id: concurrent.id },
                data: { enrolledViaClassId: classId },
              });
            }
            // concurrent 已挂某班 → 保留首班指针不动
          } else {
            throw e;
          }
        }
      } else if (!existingEnr.enrolledViaClassId) {
        // 自学（或之前已退过班，enrolledViaClassId=null）→ 挂上本班
        await tx.userCourseEnrollment.update({
          where: { id: existingEnr.id },
          data: { enrolledViaClassId: classId },
        });
      }
      // existingEnr.enrolledViaClassId 已存在 → 保留首班指针不动
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

  // spec §3 ⑨ MembershipChange · joined tier · normal severity
  // 仅 admin/coach 操作时通知（学员自助 join 由 student.routes 调用 · 无 actorAdminId · 不通知 · 用户已主动操作）
  // 仅当真的「新加入」（含从 removedAt 重新激活）才发 · 避免角色变更也发通知
  if (opts.actorAdminId && wasNewlyJoined && role === 'student') {
    notifyMemberJoined(classId, userId).catch((e) => {
      console.error('[class] notify joined failed:', e);
    });
  }

  return result;
}

/** spec §3 ⑨ joined tier · 通知被加入新班的学员 */
async function notifyMemberJoined(classId: string, userId: string): Promise<void> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return;
  await dispatchToUsers({
    prisma,
    eventKind: 'membership_change',
    eventId: `${classId}:${userId}`,
    tier: 'joined',
    userIds: [userId],
    title: `你已加入「${cls.name}」`,
    body: '开始你的修学之旅',
    link: `/class/${classId}`,
    notificationType: 'system',
    severity: 'normal',
  });
}

/**
 * 切换班级成员角色（coach ↔ student）· admin only
 *  - 已退班 / 已禁用账户 → 不能改
 *  - 必须保留至少 1 个 coach（防班级成 0 coach 无人辅导）
 */
export async function setMemberRole(
  classId: string,
  userId: string,
  role: ClassMemberRole,
  opts: { actorAdminId?: string } = {},
): Promise<ClassMember> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    if (!before || before.removedAt) throw NotFound('该成员不在班级中');
    if (before.role === role) return before;

    // 防：从 coach 降级 student 时 · 班里得至少留 1 个 coach
    if (before.role === 'coach' && role === 'student') {
      const otherCoachCount = await tx.classMember.count({
        where: {
          classId,
          role: 'coach',
          removedAt: null,
          userId: { not: userId },
          user: { isActive: true },
        },
      });
      if (otherCoachCount === 0) {
        throw Conflict('班级至少保留 1 名 coach · 请先添加另一位 coach 再降级');
      }
    }

    const updated = await tx.classMember.update({
      where: { classId_userId: { classId, userId } },
      data: { role },
    });
    if (opts.actorAdminId) {
      await tx.auditLog.create({
        data: {
          adminId: opts.actorAdminId,
          action: 'class.member',
          targetType: 'class',
          targetId: classId,
          before: { userId, role: before.role } as Prisma.InputJsonValue,
          after: { userId, role } as Prisma.InputJsonValue,
        },
      });
    }
    return updated;
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
  //
  // SERIALIZABLE 隔离：fallback 查询基于"用户其他活跃班"的快照
  //   READ COMMITTED 下，另一笔事务可能并发把用户加进 C 班 / 移出 D 班
  //   → 本事务读到 stale，错把 enrollment 删了或转向已不存在的班
  //   SERIALIZABLE 下 PG 检测到读写依赖会让一方 abort 重试 → 不一致变可恢复错误
  await prisma.$transaction(async (tx) => {
    await _removeMemberInTx(tx, classId, userId, opts);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  // spec §3 ⑨ MembershipChange · kicked tier · urgent
  // 仅 admin/coach 操作时通知（self-leave 即用户主动退班 · 不发通知 · 隐私原则）
  if (opts.actorAdminId) {
    notifyMemberKicked(classId, userId).catch((e) => {
      console.error('[class] notify kicked failed:', e);
    });
  }
}

/** spec §3 ⑨ kicked tier · 通知被移出的学员 */
async function notifyMemberKicked(classId: string, userId: string): Promise<void> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!cls) return;
  await dispatchToUsers({
    prisma,
    eventKind: 'membership_change',
    eventId: `${classId}:${userId}`,
    tier: 'kicked',
    userIds: [userId],
    title: `你已被移出「${cls.name}」`,
    body: '如有疑问请联系辅导员',
    link: '/',  // 不能跳已退出的班 · 跳首页（spec §3.9 兜底）
    notificationType: 'system',
    severity: 'urgent',
  });
}

/** spec §3 ⑨ class_dissolved tier · 通知班级所有学员 */
async function notifyClassDissolved(classId: string, className: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await dispatchToUsers({
    prisma,
    eventKind: 'membership_change',
    eventId: `${classId}:dissolved`,
    tier: 'class_dissolved',
    userIds,
    title: `「${className}」已解散`,
    body: '感谢同行',
    link: '/',
    notificationType: 'system',
    severity: 'urgent',
  });
}

// C1: tx-aware 核心 · removeMember / archiveClass 共用
// archiveClass 走批量级联时传 skipAudit=true 避免每个成员都写 audit（已有 class.archive 总账）
async function _removeMemberInTx(
  tx: Prisma.TransactionClient,
  classId: string,
  userId: string,
  opts: { actorAdminId?: string; skipAudit?: boolean } = {},
): Promise<void> {
  const before = await tx.classMember.findUnique({
    where: { classId_userId: { classId, userId } },
  });

  // 软删 ClassMember（保留 join 历史）
  await tx.classMember.updateMany({
    where: { classId, userId, removedAt: null },
    data: { removedAt: new Date() },
  });

  // 学修计数：班级专修子项 → user-scope 副本（数据保留 · 退班后仍可计数）
  await migratePracticeOnLeave(tx, classId, userId);

  // 处理通过本班带来的 enrollment（批量化避免 N+1）
  //   C3 语义：source 是'本源关系'，永不退化
  //   1) 一次拿出本班关联的所有 orphan enrollment（含 source 字段判断）
  //   2) 一次拿出该用户其他活跃班级 → JS 端建 courseId→fallbackClassId map
  //   3) 按 fallback 分桶 updateMany / 清空 enrolledViaClassId / deleteMany
  //
  //   分桶规则：
  //     有 fallback → 把 enrolledViaClassId 转向另一个班（保留 source 不变）
  //     无 fallback + source='self' → 仅清空 enrolledViaClassId（保留自学进度，C3 修复）
  //     无 fallback + source='class' → 删除（本就是班级带来的，无班即清理）
  const orphans = await tx.userCourseEnrollment.findMany({
    where: { userId, enrolledViaClassId: classId },
    select: { id: true, courseId: true, source: true },
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
    const fallbackByCourse = new Map<string, string>();
    for (const m of otherClasses) {
      const cid = m.class.courseId;
      if (!fallbackByCourse.has(cid)) fallbackByCourse.set(cid, m.classId);
    }

    const updateBuckets = new Map<string, string[]>();
    const detachIds: string[] = []; // source='self' · 仅清 enrolledViaClassId
    const deleteIds: string[] = [];  // source='class' · 删除整条
    for (const enr of orphans) {
      const fb = fallbackByCourse.get(enr.courseId);
      if (fb) {
        if (!updateBuckets.has(fb)) updateBuckets.set(fb, []);
        updateBuckets.get(fb)!.push(enr.id);
      } else if (enr.source === 'self') {
        detachIds.push(enr.id);
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
    if (detachIds.length > 0) {
      await tx.userCourseEnrollment.updateMany({
        where: { id: { in: detachIds } },
        data: { enrolledViaClassId: null },
      });
    }
    if (deleteIds.length > 0) {
      await tx.userCourseEnrollment.deleteMany({
        where: { id: { in: deleteIds } },
      });
    }
  }

  if (opts.actorAdminId && !opts.skipAudit) {
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
}

export async function listMembers(classId: string, opts: { limit?: number } = {}) {
  // 默认 200 / 上限 500 · 防大班级（千人）一次拉爆
  // C8: User.isActive=false（admin 禁用账户）的成员视为不在班级 · 过滤掉
  const take = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  return prisma.classMember.findMany({
    where: {
      classId,
      removedAt: null,
      user: { isActive: true },
    },
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

// C4: 任意已登录用户调 GET /api/classes/:id 时的 service
// 班级不存在 → NotFound (404)
// 用户非当前活跃成员 → Forbidden (403) · 保留含义清晰
// 成员可见：基本信息 + 主修法本 + 我的角色 + 成员数（不含成员列表）
export async function getClassForMember(classId: string, userId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      ...CLASS_COURSE_INCLUDE,
      // 成员列表 · 前端 ClassDetailPage 需要展示教练 / 学员分组
      // 过滤已退出 + 已禁用账户 · 口径与 memberCount 一致
      members: {
        where: { removedAt: null, user: { isActive: true } },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, dharmaName: true } },
        },
        orderBy: [
          { role: 'desc' }, // coach 在前
          { joinedAt: 'asc' },
        ],
      },
    },
  });
  if (!cls) throw NotFound('班级不存在');
  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId } },
    select: { role: true, removedAt: true, joinedAt: true },
  });
  if (!member || member.removedAt !== null) {
    throw Forbidden('您不在该班级中');
  }
  // 成员数（活跃 + 用户未禁用）· 单独 count 避免 listMembers 加载全量
  // C8: 与 listMembers 口径一致 · 排除已禁用账户
  const memberCount = await prisma.classMember.count({
    where: { classId, removedAt: null, user: { isActive: true } },
  });
  return {
    ...cls,
    myRole: member.role,
    myJoinedAt: member.joinedAt,
    memberCount,
  };
}

export interface UpdateClassInput {
  name?: string;
  description?: string | null;
  coverEmoji?: string | null;
}
/** 更新班级元数据（不含归档/课程/加入码 · 这些有专门接口） */
export async function updateClass(
  id: string,
  patch: UpdateClassInput,
  opts: { actorAdminId?: string } = {},
): Promise<Class> {
  const before = await prisma.class.findUnique({ where: { id } });
  if (!before) throw NotFound('班级不存在');
  if (!before.isActive) throw NotFound('班级已归档 · 不可编辑');

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.coverEmoji !== undefined) data.coverEmoji = patch.coverEmoji?.trim() || null;
  if (Object.keys(data).length === 0) return before;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.class.update({
      where: { id },
      data,
      include: CLASS_COURSE_INCLUDE,
    });
    if (opts.actorAdminId) {
      await tx.auditLog.create({
        data: {
          adminId: opts.actorAdminId,
          action: 'class.update',
          targetType: 'class',
          targetId: id,
          before: { name: before.name, description: before.description, coverEmoji: before.coverEmoji } as Prisma.InputJsonValue,
          after: data as Prisma.InputJsonValue,
        },
      });
    }
    return updated;
  });
}

export async function archiveClass(
  id: string,
  opts: { actorAdminId?: string } = {},
): Promise<Class> {
  // C1: 班级解散需级联清理成员的 source='class' enrollment
  //   - 否则学员退出后 enrollment 仍指向已归档班 · listMyEnrollments 显示孤立项
  //   - 解决：复用 removeMember 的 fallback / delete 语义，对所有 active 成员逐个处理
  //   - 单次 tx + SERIALIZABLE：与 removeMember 一致的并发保证
  //   - skipAudit=true：避免每成员一条 audit · 已有 class.archive 总账记录解散事件
  // 提前抓 className + 成员 · 用于事务后发解散通知（tx 内 archive 后这些数据会被改）
  const preArchive = await prisma.class.findUnique({
    where: { id },
    select: { name: true, members: { where: { removedAt: null }, select: { userId: true } } },
  });

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.class.findUnique({
      where: { id },
      select: { isActive: true, archivedAt: true, name: true },
    });

    // 先级联处理所有 active 成员（fallback 查询要求本班 isActive=true 不影响：
    // _removeMemberInTx 排除当前 classId，本班是否 active 与 fallback 无关）
    const activeMembers = await tx.classMember.findMany({
      where: { classId: id, removedAt: null },
      select: { userId: true },
    });
    for (const m of activeMembers) {
      await _removeMemberInTx(tx, id, m.userId, {
        actorAdminId: opts.actorAdminId,
        skipAudit: true,
      });
    }

    // CO1: 私题软退役 · class_private + ownerClassId=本班 → visibility='draft'
    //   学员侧：listLessonQuestions / listDueCards / submitAnswer 都会过滤 draft
    //   coach 侧：createdByUserId 仍能列出（标"草稿"提示题目已无效）· UserAnswer 历史保留
    //   可逆：admin 后台若要恢复班级，draft 题可再改回 class_private
    const draftedCount = await tx.question.updateMany({
      where: { ownerClassId: id, visibility: 'class_private' },
      data: { visibility: 'draft' },
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
            cascadedMembers: activeMembers.length,
            draftedQuestions: draftedCount.count,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return cls;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  // spec §3 ⑨ class_dissolved tier · fire-and-forget 通知所有原成员
  if (preArchive && preArchive.members.length > 0) {
    notifyClassDissolved(id, preArchive.name, preArchive.members.map((m) => m.userId)).catch((e) => {
      console.error('[class] notify dissolved failed:', e);
    });
  }

  return result;
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
