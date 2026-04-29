// Admin 法本（论典 / 章 / 节）CRUD
//
// 三级树：Course → Chapter → Lesson
// 仅 admin 可写；学员侧 listPublishedCourses() / getCourseBySlug() 不变。
//
// 删除策略：硬删 + 级联（Prisma onDelete: Cascade 已配 Chapter/Lesson）
// · 但 Question 引用 courseId / chapterId / lessonId 没设级联 →
//   删 Course / Chapter / Lesson 前先检查关联 Question 是否存在；
//   有则拒绝（避免破坏题库）。学员 enrollment / sm2card 同理。
// · 已答过的 Course 删除会破坏历史数据；admin 应改用 isPublished=false 下架。
//
// AuditLog: 记 action: course.create / course.update / course.delete · chapter.* · lesson.*

import type { Prisma } from '@prisma/client';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

// ─── Course ──────────────────────────────────────────────────────

export interface CreateCourseInput {
  slug: string;
  title: string;
  titleTraditional?: string;
  author?: string;
  authorInfo?: string;
  description?: string;
  coverEmoji?: string;
  displayOrder?: number;
  isPublished?: boolean;
  licenseInfo?: string;
}

export interface UpdateCourseInput {
  slug?: string;
  title?: string;
  titleTraditional?: string | null;
  author?: string | null;
  authorInfo?: string | null;
  description?: string | null;
  coverEmoji?: string;
  coverImageUrl?: string | null;
  displayOrder?: number;
  isPublished?: boolean;
  licenseInfo?: string | null;
}

export async function listAllCoursesAdmin() {
  // 含未发布；过滤已归档（admin 用「删除」按钮触发的归档不应再显示在列表）
  // 如需查归档，将来可加 ?includeArchived=1 query
  const courses = await prisma.course.findMany({
    where: { archivedAt: null },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { chapters: true, enrollments: true } } },
  });
  // 附 lesson 总数（chapter 跨级 count 不能直接 select）
  const ids = courses.map((c) => c.id);
  const lessonCounts = await prisma.lesson.groupBy({
    by: ['chapterId'],
    where: { chapter: { courseId: { in: ids } } },
    _count: true,
  });
  // chapterId → courseId 映射
  const chapterRows = await prisma.chapter.findMany({
    where: { courseId: { in: ids } },
    select: { id: true, courseId: true },
  });
  const chapterToCourse = new Map(chapterRows.map((c) => [c.id, c.courseId]));
  const lessonCountByCourse = new Map<string, number>();
  for (const row of lessonCounts) {
    const cid = chapterToCourse.get(row.chapterId);
    if (!cid) continue;
    lessonCountByCourse.set(cid, (lessonCountByCourse.get(cid) ?? 0) + row._count);
  }
  return courses.map((c) => ({
    ...c,
    chapterCount: c._count.chapters,
    lessonCount: lessonCountByCourse.get(c.id) ?? 0,
    enrollmentCount: c._count.enrollments,
    _count: undefined,
  }));
}

export async function getCourseTreeAdmin(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        include: {
          lessons: { orderBy: { order: 'asc' } },
        },
      },
    },
  });
  if (!course) throw NotFound('法本不存在');
  return course;
}

export async function createCourse(adminId: string, input: CreateCourseInput) {
  const slug = input.slug.trim();
  if (await prisma.course.findUnique({ where: { slug } })) {
    throw Conflict('slug 已被占用');
  }
  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.course.create({
      data: {
        slug,
        title: input.title,
        titleTraditional: input.titleTraditional ?? null,
        author: input.author ?? null,
        authorInfo: input.authorInfo ?? null,
        description: input.description ?? null,
        coverEmoji: input.coverEmoji ?? '🪷',
        displayOrder: input.displayOrder ?? 0,
        isPublished: input.isPublished ?? true,
        licenseInfo: input.licenseInfo ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'course.create',
        targetType: 'course',
        targetId: c.id,
        after: { slug: c.slug, title: c.title } as Prisma.InputJsonValue,
      },
    });
    return c;
  });
  return created;
}

export async function updateCourse(
  adminId: string,
  id: string,
  patch: UpdateCourseInput,
) {
  const before = await prisma.course.findUnique({ where: { id } });
  if (!before) throw NotFound('法本不存在');
  if (patch.slug && patch.slug !== before.slug) {
    const dup = await prisma.course.findUnique({ where: { slug: patch.slug.trim() } });
    if (dup) throw Conflict('slug 已被占用');
  }

  const data: Prisma.CourseUpdateInput = {};
  if (patch.slug !== undefined)             data.slug             = patch.slug.trim();
  if (patch.title !== undefined)            data.title            = patch.title;
  if (patch.titleTraditional !== undefined) data.titleTraditional = patch.titleTraditional;
  if (patch.author !== undefined)           data.author           = patch.author;
  if (patch.authorInfo !== undefined)       data.authorInfo       = patch.authorInfo;
  if (patch.description !== undefined)      data.description      = patch.description;
  if (patch.coverEmoji !== undefined)       data.coverEmoji       = patch.coverEmoji;
  if (patch.coverImageUrl !== undefined)    data.coverImageUrl    = patch.coverImageUrl;
  if (patch.displayOrder !== undefined)     data.displayOrder     = patch.displayOrder;
  if (patch.isPublished !== undefined)      data.isPublished      = patch.isPublished;
  if (patch.licenseInfo !== undefined)      data.licenseInfo      = patch.licenseInfo;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.course.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'course.update',
        targetType: 'course',
        targetId: id,
        before: { slug: before.slug, title: before.title, isPublished: before.isPublished } as Prisma.InputJsonValue,
        after: data as Prisma.InputJsonValue,
      },
    });
    return u;
  });
  return updated;
}

/**
 * "删除"法本：实际是软归档（isPublished=false + archivedAt=now）。
 *
 * 设计：永远不真删 Course 行（避免破坏 UserAnswer/Sm2Card/AuditLog 等历史数据），
 * 学员侧已通过 isPublished=true 过滤，归档后即对学员不可见。
 * 路由层仍是 DELETE 谓词，保持前端 API 不变；AuditLog action=course.archive。
 */
export async function deleteCourse(adminId: string, id: string) {
  const before = await prisma.course.findUnique({ where: { id } });
  if (!before) throw NotFound('法本不存在');
  if (before.archivedAt) {
    throw BadRequest('法本已归档；如需彻底清理请联系 DBA');
  }

  // C1: 不允许在仍有 active 班级以本法本为主修时归档
  //   否则班级里学员的 enrollment 仍指向已归档 course → 学员侧 reading 也会卡
  //   admin 应先解散这些班级（archiveClass 已联动清 enrollment）再归档法本
  const activeClassCount = await prisma.class.count({
    where: { courseId: id, isActive: true },
  });
  if (activeClassCount > 0) {
    throw Conflict(
      `仍有 ${activeClassCount} 个活跃班级以本法本为主修，请先解散这些班级再归档`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.course.update({
      where: { id },
      data: { isPublished: false, archivedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'course.archive',
        targetType: 'course',
        targetId: id,
        before: {
          slug: before.slug,
          title: before.title,
          isPublished: before.isPublished,
        } as Prisma.InputJsonValue,
        after: { isPublished: false, archivedAt: new Date() } as Prisma.InputJsonValue,
      },
    });
  });
}

// ─── Chapter ─────────────────────────────────────────────────────

export interface CreateChapterInput {
  order?: number;            // 不填则自动取末尾 +1
  title: string;
  titleTraditional?: string;
}

export interface UpdateChapterInput {
  order?: number;
  title?: string;
  titleTraditional?: string | null;
}

export async function createChapter(
  adminId: string,
  courseId: string,
  input: CreateChapterInput,
) {
  if (!(await prisma.course.findUnique({ where: { id: courseId } }))) {
    throw NotFound('法本不存在');
  }
  let order = input.order;
  if (order === undefined) {
    const last = await prisma.chapter.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = (last?.order ?? 0) + 1;
  } else {
    const dup = await prisma.chapter.findUnique({
      where: { courseId_order: { courseId, order } },
    });
    if (dup) throw Conflict(`章序号 ${order} 已被占用`);
  }
  return prisma.$transaction(async (tx) => {
    const c = await tx.chapter.create({
      data: {
        courseId,
        order,
        title: input.title,
        titleTraditional: input.titleTraditional ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'chapter.create',
        targetType: 'chapter',
        targetId: c.id,
        after: { courseId, order, title: c.title } as Prisma.InputJsonValue,
      },
    });
    return c;
  });
}

export async function updateChapter(
  adminId: string,
  id: string,
  patch: UpdateChapterInput,
) {
  const before = await prisma.chapter.findUnique({ where: { id } });
  if (!before) throw NotFound('章不存在');
  if (patch.order !== undefined && patch.order !== before.order) {
    const dup = await prisma.chapter.findUnique({
      where: { courseId_order: { courseId: before.courseId, order: patch.order } },
    });
    if (dup) throw Conflict(`章序号 ${patch.order} 已被占用`);
  }
  const data: Prisma.ChapterUpdateInput = {};
  if (patch.order !== undefined)            data.order            = patch.order;
  if (patch.title !== undefined)            data.title            = patch.title;
  if (patch.titleTraditional !== undefined) data.titleTraditional = patch.titleTraditional;

  return prisma.$transaction(async (tx) => {
    const u = await tx.chapter.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'chapter.update',
        targetType: 'chapter',
        targetId: id,
        before: { order: before.order, title: before.title } as Prisma.InputJsonValue,
        after: data as Prisma.InputJsonValue,
      },
    });
    return u;
  });
}

export async function deleteChapter(adminId: string, id: string) {
  const before = await prisma.chapter.findUnique({ where: { id } });
  if (!before) throw NotFound('章不存在');

  const qs = await prisma.question.count({ where: { chapterId: id } });
  if (qs) {
    throw BadRequest(`无法删除：本章关联 ${qs} 道题。`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.chapter.delete({ where: { id } }); // cascade lessons
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'chapter.delete',
        targetType: 'chapter',
        targetId: id,
        before: { courseId: before.courseId, order: before.order, title: before.title } as Prisma.InputJsonValue,
      },
    });
  });
}

// ─── Lesson ──────────────────────────────────────────────────────

export interface CreateLessonInput {
  order?: number;
  title: string;
  titleTraditional?: string;
  referenceText?: string;
  teachingSummary?: string;
}

export interface UpdateLessonInput {
  order?: number;
  title?: string;
  titleTraditional?: string | null;
  referenceText?: string | null;
  teachingSummary?: string | null;
}

export async function createLesson(
  adminId: string,
  chapterId: string,
  input: CreateLessonInput,
) {
  if (!(await prisma.chapter.findUnique({ where: { id: chapterId } }))) {
    throw NotFound('章不存在');
  }
  let order = input.order;
  if (order === undefined) {
    const last = await prisma.lesson.findFirst({
      where: { chapterId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = (last?.order ?? 0) + 1;
  } else {
    const dup = await prisma.lesson.findUnique({
      where: { chapterId_order: { chapterId, order } },
    });
    if (dup) throw Conflict(`课时序号 ${order} 已被占用`);
  }
  return prisma.$transaction(async (tx) => {
    const l = await tx.lesson.create({
      data: {
        chapterId,
        order,
        title: input.title,
        titleTraditional: input.titleTraditional ?? null,
        referenceText: input.referenceText ?? null,
        teachingSummary: input.teachingSummary ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'lesson.create',
        targetType: 'lesson',
        targetId: l.id,
        after: { chapterId, order, title: l.title } as Prisma.InputJsonValue,
      },
    });
    return l;
  });
}

export async function updateLesson(
  adminId: string,
  id: string,
  patch: UpdateLessonInput,
) {
  const before = await prisma.lesson.findUnique({ where: { id } });
  if (!before) throw NotFound('课时不存在');
  if (patch.order !== undefined && patch.order !== before.order) {
    const dup = await prisma.lesson.findUnique({
      where: { chapterId_order: { chapterId: before.chapterId, order: patch.order } },
    });
    if (dup) throw Conflict(`课时序号 ${patch.order} 已被占用`);
  }
  const data: Prisma.LessonUpdateInput = {};
  if (patch.order !== undefined)            data.order            = patch.order;
  if (patch.title !== undefined)            data.title            = patch.title;
  if (patch.titleTraditional !== undefined) data.titleTraditional = patch.titleTraditional;
  if (patch.referenceText !== undefined)    data.referenceText    = patch.referenceText;
  if (patch.teachingSummary !== undefined)  data.teachingSummary  = patch.teachingSummary;

  return prisma.$transaction(async (tx) => {
    const u = await tx.lesson.update({ where: { id }, data });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'lesson.update',
        targetType: 'lesson',
        targetId: id,
        // 教学内容是高频改动 · 加进快照便于回溯 admin 改了什么
        before: {
          order: before.order,
          title: before.title,
          referenceText: before.referenceText,
          teachingSummary: before.teachingSummary,
        } as Prisma.InputJsonValue,
        after: {
          order: u.order,
          title: u.title,
          referenceText: u.referenceText,
          teachingSummary: u.teachingSummary,
        } as Prisma.InputJsonValue,
      },
    });
    return u;
  });
}

export async function deleteLesson(adminId: string, id: string) {
  const before = await prisma.lesson.findUnique({ where: { id } });
  if (!before) throw NotFound('课时不存在');

  const qs = await prisma.question.count({ where: { lessonId: id } });
  if (qs) {
    throw BadRequest(`无法删除：本课时关联 ${qs} 道题。`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.lesson.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        adminId,
        action: 'lesson.delete',
        targetType: 'lesson',
        targetId: id,
        before: { chapterId: before.chapterId, order: before.order, title: before.title } as Prisma.InputJsonValue,
      },
    });
  });
}
