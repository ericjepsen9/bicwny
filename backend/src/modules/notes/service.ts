// 笔记 service · CRUD + 全文搜索 + 班级可见性
import type { Prisma, PrismaClient } from '@prisma/client';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';

export interface NoteDto {
  id: string;
  userId: string;
  lessonId: string | null;
  courseId: string | null;
  title: string;
  body: string;
  tags: string[];
  visibility: 'private' | 'class';
  anchorText: string | null;
  anchorIndex: number | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // shared 视图额外字段
  authorName?: string | null;
  lessonTitle?: string | null;
}

interface Row {
  id: string;
  userId: string;
  lessonId: string | null;
  courseId: string | null;
  title: string;
  body: string;
  tags: Prisma.JsonValue;
  visibility: string;
  anchorText: string | null;
  anchorIndex: number | null;
  pinnedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToDto(r: Row): NoteDto {
  return {
    id: r.id,
    userId: r.userId,
    lessonId: r.lessonId,
    courseId: r.courseId,
    title: r.title,
    body: r.body,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    visibility: (r.visibility === 'class' ? 'class' : 'private'),
    anchorText: r.anchorText,
    anchorIndex: r.anchorIndex,
    pinnedAt: r.pinnedAt?.toISOString() ?? null,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export interface ListFilter {
  lessonId?: string;
  tag?: string;
  q?: string;
  includeArchived?: boolean;
}

export async function listMyNotes(prisma: PrismaClient, userId: string, filter: ListFilter = {}): Promise<NoteDto[]> {
  const where: Prisma.NoteWhereInput = { userId };
  if (!filter.includeArchived) where.archivedAt = null;
  if (filter.lessonId) where.lessonId = filter.lessonId;
  if (filter.q?.trim()) {
    where.OR = [
      { title: { contains: filter.q, mode: 'insensitive' } },
      { body: { contains: filter.q, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.note.findMany({
    where,
    orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    take: 200,
  });
  let result = rows.map(rowToDto);
  if (filter.tag) result = result.filter((n) => n.tags.includes(filter.tag!));
  return result;
}

export async function getNote(prisma: PrismaClient, userId: string, noteId: string): Promise<NoteDto> {
  const r = await prisma.note.findUnique({ where: { id: noteId } });
  if (!r) throw NotFound('笔记不存在');
  // 私密笔记仅作者可看 · 班级共享 = 同班成员可看
  if (r.userId !== userId) {
    if (r.visibility !== 'class') throw Forbidden('无权查看');
    // 同班校验：作者和当前用户至少有一个公共 class
    const sharedClass = await prisma.classMember.findFirst({
      where: {
        userId,
        removedAt: null,
        class: { members: { some: { userId: r.userId, removedAt: null } } },
      },
    });
    if (!sharedClass) throw Forbidden('非同班 · 无权查看');
  }
  return rowToDto(r);
}

/** 班级共享笔记列表 · 当前用户能看到的所有同班 visibility='class' 笔记 */
export async function listSharedNotes(prisma: PrismaClient, userId: string, filter: { q?: string } = {}): Promise<NoteDto[]> {
  // 当前用户所有班级
  const memberships = await prisma.classMember.findMany({
    where: { userId, removedAt: null },
    select: { classId: true },
  });
  if (memberships.length === 0) return [];
  const classIds = memberships.map((m) => m.classId);
  // 同班所有用户
  const classmateMembers = await prisma.classMember.findMany({
    where: { classId: { in: classIds }, removedAt: null },
    select: { userId: true },
  });
  const userIds = Array.from(new Set(classmateMembers.map((m) => m.userId).filter((id) => id !== userId)));
  if (userIds.length === 0) return [];

  const where: Prisma.NoteWhereInput = {
    userId: { in: userIds },
    visibility: 'class',
    archivedAt: null,
  };
  if (filter.q?.trim()) {
    where.OR = [
      { title: { contains: filter.q, mode: 'insensitive' } },
      { body: { contains: filter.q, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      user: { select: { dharmaName: true } },
      lesson: { select: { title: true } },
    },
  });
  return rows.map((r) => ({
    ...rowToDto(r),
    authorName: r.user?.dharmaName ?? null,
    lessonTitle: r.lesson?.title ?? null,
  }));
}

export interface CreateInput {
  lessonId?: string | null;
  title: string;
  body: string;
  tags?: string[];
  visibility?: 'private' | 'class';
  anchorText?: string | null;
  anchorIndex?: number | null;
}

export async function createNote(prisma: PrismaClient, userId: string, input: CreateInput): Promise<NoteDto> {
  if (input.title.length > 80) throw BadRequest('标题超长');
  if (input.body.length > 10000) throw BadRequest('正文超长');
  let courseId: string | null = null;
  if (input.lessonId) {
    const l = await prisma.lesson.findUnique({
      where: { id: input.lessonId },
      select: { chapter: { select: { courseId: true } } },
    });
    if (!l) throw NotFound('课时不存在');
    courseId = l.chapter.courseId;
  }
  const r = await prisma.note.create({
    data: {
      userId,
      lessonId: input.lessonId ?? null,
      courseId,
      title: input.title.trim(),
      body: input.body,
      tags: (input.tags ?? []) as Prisma.InputJsonValue,
      visibility: input.visibility === 'class' ? 'class' : 'private',
      anchorText: input.anchorText?.slice(0, 80) ?? null,
      anchorIndex: input.anchorIndex ?? null,
    },
  });
  return rowToDto(r);
}

export interface UpdateInput {
  title?: string;
  body?: string;
  tags?: string[];
  visibility?: 'private' | 'class';
  pinned?: boolean;
  archive?: boolean;
}

export async function updateNote(prisma: PrismaClient, userId: string, noteId: string, input: UpdateInput): Promise<NoteDto> {
  const existing = await prisma.note.findUnique({ where: { id: noteId } });
  if (!existing) throw NotFound('笔记不存在');
  if (existing.userId !== userId) throw Forbidden('无权编辑');
  if (input.title !== undefined && input.title.length > 80) throw BadRequest('标题超长');
  if (input.body !== undefined && input.body.length > 10000) throw BadRequest('正文超长');

  const data: Prisma.NoteUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.body !== undefined) data.body = input.body;
  if (input.tags !== undefined) data.tags = input.tags as Prisma.InputJsonValue;
  if (input.visibility !== undefined) data.visibility = input.visibility === 'class' ? 'class' : 'private';
  if (input.pinned !== undefined) data.pinnedAt = input.pinned ? new Date() : null;
  if (input.archive !== undefined) data.archivedAt = input.archive ? new Date() : null;

  const r = await prisma.note.update({ where: { id: noteId }, data });
  return rowToDto(r);
}

export async function deleteNote(prisma: PrismaClient, userId: string, noteId: string): Promise<void> {
  const existing = await prisma.note.findUnique({ where: { id: noteId }, select: { userId: true } });
  if (!existing) throw NotFound('笔记不存在');
  if (existing.userId !== userId) throw Forbidden('无权删除');
  await prisma.note.delete({ where: { id: noteId } });
}
