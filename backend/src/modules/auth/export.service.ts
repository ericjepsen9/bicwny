// 用户数据导出 · GDPR-style · 输出 user 自己产生的所有数据
// P2 #29
//
// 设计：
//   - 单个 JSON · 不打 zip（多 GB 题库不会落到单用户 · 几 MB 内）
//   - 包含：profile / answers / mistakes / favorites / sm2 / enrollments
//          / memberships / sessions / pushSubs / notifications / reports
//          / analytics / experimentExposures
//   - 不含：他人产生的内容（题目本身 / 班级 / 法本）· 用户只是引用
//   - 大字段（answer payload）按原样保留 · 数据可移植性优先
//   - 不暴露其他用户 id / passwordHash 等敏感字段
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { NotFound, Unauthorized } from '../../lib/errors.js';

interface UserExportPayload {
  exportedAt: string;
  schemaVersion: 1;
  user: {
    id: string;
    email: string | null;
    emailVerifiedAt: string | null;
    role: string;
    isActive: boolean;
    dharmaName: string | null;
    avatar: string | null;
    timezone: string;
    locale: string;
    hasOnboarded: boolean;
    contentCohort: string | null;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  };
  answers: Array<Record<string, unknown>>;
  mistakes: Array<Record<string, unknown>>;
  favorites: Array<Record<string, unknown>>;
  sm2Cards: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  pushSubscriptions: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  questionReports: Array<Record<string, unknown>>;
  analyticsEvents: Array<Record<string, unknown>>;
  experimentExposures: Array<Record<string, unknown>>;
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function plain(d: Date): string {
  return d.toISOString();
}

export async function exportUserData(userId: string): Promise<UserExportPayload> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw NotFound('用户不存在');
  if (!u.isActive) throw Unauthorized('账户已停用');

  // 并行拉所有 user-owned 行 · 大表注意 take 上限 · 实际生产用户最多几千行
  const [
    answers,
    mistakes,
    favorites,
    sm2Cards,
    enrollments,
    memberships,
    sessions,
    pushSubs,
    notifications,
    reports,
    analytics,
    exposures,
  ] = await Promise.all([
    prisma.userAnswer.findMany({
      where: { userId },
      orderBy: { answeredAt: 'desc' },
      take: 50_000,
    }),
    prisma.userMistakeBook.findMany({
      where: { userId },
      orderBy: { lastWrongAt: 'desc' },
    }),
    prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sm2Card.findMany({
      where: { userId },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.userCourseEnrollment.findMany({
      where: { userId },
      orderBy: { enrolledAt: 'desc' },
    }),
    prisma.classMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.authSession.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      // 不导出 refreshTokenHash（敏感）
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
    prisma.pushSubscription.findMany({
      where: { userId },
      // endpoint / p256dh / auth 是订阅秘钥 · 给用户看 endpoint · 隐去秘钥
      select: {
        id: true,
        endpoint: true,
        platform: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5_000,
    }),
    prisma.questionReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    }),
    prisma.experimentExposure.findMany({
      where: { userId },
      orderBy: { firstSeenAt: 'desc' },
    }),
  ]);

  const serialize = (rows: Array<Record<string, unknown>>) =>
    rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (v instanceof Date) out[k] = plain(v);
        else if (v instanceof Prisma.Decimal) out[k] = v.toString();
        else out[k] = v;
      }
      return out;
    });

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    user: {
      id: u.id,
      email: u.email,
      emailVerifiedAt: toIso(u.emailVerifiedAt),
      role: u.role,
      isActive: u.isActive,
      dharmaName: u.dharmaName,
      avatar: u.avatar,
      timezone: u.timezone,
      locale: u.locale,
      hasOnboarded: u.hasOnboarded,
      contentCohort: u.contentCohort,
      createdAt: plain(u.createdAt),
      updatedAt: plain(u.updatedAt),
      lastLoginAt: toIso(u.lastLoginAt),
    },
    answers: serialize(answers as Array<Record<string, unknown>>),
    mistakes: serialize(mistakes as Array<Record<string, unknown>>),
    favorites: serialize(favorites as Array<Record<string, unknown>>),
    sm2Cards: serialize(sm2Cards as Array<Record<string, unknown>>),
    enrollments: serialize(enrollments as Array<Record<string, unknown>>),
    memberships: serialize(memberships as Array<Record<string, unknown>>),
    sessions: serialize(sessions as Array<Record<string, unknown>>),
    pushSubscriptions: serialize(pushSubs as Array<Record<string, unknown>>),
    notifications: serialize(notifications as Array<Record<string, unknown>>),
    questionReports: serialize(reports as Array<Record<string, unknown>>),
    analyticsEvents: serialize(analytics as Array<Record<string, unknown>>),
    experimentExposures: serialize(exposures as Array<Record<string, unknown>>),
  };
}

/** 生成下载用文件名 · juexue-data-export-{userId}-{date}.json */
export function exportFilename(userId: string, date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `juexue-data-export-${userId.slice(0, 8)}-${d}.json`;
}
