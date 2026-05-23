// 观修学员 service · 播放 / 进度 / 完成
//
// session 模型：
//   - 用户每次进入播放页 createSession · 拿到 sessionId
//   - 播放期间每 10s patchSession 更新 videoWatchedSec
//   - 视频 ≥ 80% 时长 → isCompleted = true · completedAt = now · UCE.meditationsCompleted 加该 medId
//   - 用户可手动 complete（兜底 · 不依赖前端 80% 触发）
//
// 同一 user × meditation 多次播放产生多条 session（历史记录）
// "已完成" 判定 = 任一 session.isCompleted = true（reduce）

import { Prisma, type Meditation, type MeditationSession } from '@prisma/client';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const COMPLETION_THRESHOLD = 0.8;

/** 课时关联的观修（v1 一对一为主 · 取首条）· 没有就 null */
export async function getLessonMeditation(lessonId: string): Promise<Meditation | null> {
  return prisma.meditation.findFirst({
    where: { lessonId, isPublished: true, archivedAt: null },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

/** 法本下所有已发布观修（目录页批量用） */
export async function getCourseMeditations(courseId: string): Promise<Meditation[]> {
  return prisma.meditation.findMany({
    where: { courseId, isPublished: true, archivedAt: null },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

/** 观修详情 + 该用户的最新 session（如有）· 用于播放页 boot */
export interface MeditationDetailResp {
  meditation: Meditation;
  // 最近一次 session · 用于"上次修到 X 分钟"
  latestSession?: {
    id: string;
    startedAt: Date;
    completedAt: Date | null;
    videoWatchedSec: number;
    isCompleted: boolean;
  };
  // 历史完成次数（聚合）
  totalCompletions: number;
}

export async function getMeditationDetail(
  userId: string,
  meditationId: string,
): Promise<MeditationDetailResp> {
  const meditation = await prisma.meditation.findFirst({
    where: { id: meditationId, archivedAt: null },
  });
  if (!meditation) throw NotFound('观修不存在');

  const [latestSession, totalCompletions] = await Promise.all([
    prisma.meditationSession.findFirst({
      where: { userId, meditationId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true, startedAt: true, completedAt: true,
        videoWatchedSec: true, isCompleted: true,
      },
    }),
    prisma.meditationSession.count({
      where: { userId, meditationId, isCompleted: true },
    }),
  ]);

  return {
    meditation,
    latestSession: latestSession ?? undefined,
    totalCompletions,
  };
}

/** 创建一次播放 session · 用户每次进播放页调一次 */
export async function startSession(
  userId: string,
  meditationId: string,
): Promise<MeditationSession> {
  const meditation = await prisma.meditation.findFirst({
    where: { id: meditationId, archivedAt: null, isPublished: true },
    select: { id: true },
  });
  if (!meditation) throw NotFound('观修不存在或未发布');

  return prisma.meditationSession.create({
    data: { userId, meditationId },
  });
}

/** 上报播放进度（每 10s 调一次）· 自动判定完成 */
export async function updateSessionProgress(
  userId: string,
  meditationId: string,
  sessionId: string,
  videoWatchedSec: number,
): Promise<MeditationSession> {
  if (!Number.isFinite(videoWatchedSec) || videoWatchedSec < 0) {
    throw BadRequest('videoWatchedSec 不合法');
  }
  const session = await prisma.meditationSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw NotFound('session 不存在');
  if (session.userId !== userId) throw NotFound('session 不存在');
  if (session.meditationId !== meditationId) throw BadRequest('meditation/session mismatch');

  const meditation = await prisma.meditation.findUnique({
    where: { id: meditationId },
    select: { videoDurationSec: true, courseId: true },
  });
  if (!meditation) throw NotFound('观修不存在');

  // 单调不递减 · 防前端误传后退
  const newWatched = Math.max(session.videoWatchedSec, Math.floor(videoWatchedSec));
  const cap = meditation.videoDurationSec || newWatched;
  const cappedWatched = Math.min(newWatched, cap);

  const shouldComplete = !session.isCompleted
    && meditation.videoDurationSec > 0
    && cappedWatched >= meditation.videoDurationSec * COMPLETION_THRESHOLD;

  const updated = await prisma.meditationSession.update({
    where: { id: sessionId },
    data: {
      videoWatchedSec: cappedWatched,
      ...(shouldComplete && { isCompleted: true, completedAt: new Date() }),
    },
  });

  if (shouldComplete) {
    await markCourseEnrollmentMeditationDone(userId, meditation.courseId, meditationId);
  }

  return updated;
}

/** 手动标完成（用户点 [完成观修] 按钮 · 兜底）· 不要求达到 80% */
export async function manualComplete(
  userId: string,
  meditationId: string,
): Promise<{ ok: true }> {
  const meditation = await prisma.meditation.findFirst({
    where: { id: meditationId, archivedAt: null },
    select: { id: true, courseId: true, videoDurationSec: true },
  });
  if (!meditation) throw NotFound('观修不存在');

  // 取最近的 session · 没有就创建一个
  let session = await prisma.meditationSession.findFirst({
    where: { userId, meditationId },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) {
    session = await prisma.meditationSession.create({
      data: { userId, meditationId },
    });
  }

  if (session.isCompleted) {
    return { ok: true };
  }

  await prisma.meditationSession.update({
    where: { id: session.id },
    data: {
      isCompleted: true,
      completedAt: new Date(),
      videoWatchedSec: meditation.videoDurationSec,
    },
  });

  await markCourseEnrollmentMeditationDone(userId, meditation.courseId, meditationId);

  return { ok: true };
}

/** 把 medId 加进 UserCourseEnrollment.meditationsCompleted（去重）· best-effort */
async function markCourseEnrollmentMeditationDone(
  userId: string,
  courseId: string | null,
  meditationId: string,
): Promise<void> {
  if (!courseId) return;
  // 审计 D3：读-改-写进 Serializable 事务 · 防同课多观修并发完成时数组互相覆盖（丢更新）
  await prisma.$transaction(async (tx) => {
    const enrollment = await tx.userCourseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { meditationsCompleted: true },
    });
    if (!enrollment) return;
    if (enrollment.meditationsCompleted.includes(meditationId)) return;
    await tx.userCourseEnrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        meditationsCompleted: [...enrollment.meditationsCompleted, meditationId],
        lastStudiedAt: new Date(),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** 我的观修历史 · 列出该用户完成过的所有观修（按 completedAt desc · 跨课程） */
export async function listMyCompletedMeditations(userId: string) {
  // 审计 P6：DB 内 DISTINCT ON 选出每个 meditation 最近一条已完成 session 的 id（结果 ≤ 观修数 · 有界）·
  //   排除归档观修 · 再用 Prisma 按 id 取完整结构 · 不再把全部 session 行拉进内存去重
  const picked = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT ON (s."meditationId") s.id
    FROM "MeditationSession" s
    JOIN "Meditation" m ON m.id = s."meditationId"
    WHERE s."userId" = ${userId}
      AND s."isCompleted" = true
      AND m."archivedAt" IS NULL
    ORDER BY s."meditationId", s."completedAt" DESC NULLS LAST
  `;
  const ids = picked.map((r) => r.id);
  if (ids.length === 0) return [];

  return prisma.meditationSession.findMany({
    where: { id: { in: ids } },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      meditationId: true,
      videoWatchedSec: true,
      completedAt: true,
      meditation: {
        select: {
          id: true,
          title: true,
          titleTraditional: true,
          videoDurationSec: true,
          courseId: true,
          lessonId: true,
          archivedAt: true,
          course: { select: { id: true, slug: true, title: true, coverEmoji: true } },
          lesson: { select: { id: true, title: true } },
        },
      },
    },
  });
}
