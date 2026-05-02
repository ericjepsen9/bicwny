// 觉学 v2 · 共享 React Query hooks
// 所有 GET 数据走这里 · queryKey 统一约定 · staleTime 5min（main.tsx 默认）
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// ── 课程相关 ──
export interface Course {
  id: string;
  slug: string;
  title: string;
  titleTraditional: string | null;
  author: string | null;
  authorInfo: string | null;
  description: string | null;
  coverEmoji: string;
  coverImageUrl: string | null;
  displayOrder: number;
  isPublished: boolean;
}

export interface CourseDetail extends Course {
  chapters: Chapter[];
}
export interface Chapter {
  id: string;
  order: number;
  title: string;
  lessons: Lesson[];
}
export interface Lesson {
  id: string;
  order: number;
  title: string;
  referenceText: string | null;
}

export function useCourses() {
  return useQuery({
    queryKey: ['/api/courses'],
    queryFn: ({ signal }) => api.get<Course[]>('/api/courses', { signal }),
  });
}

export function useCourseDetail(slug: string | null | undefined) {
  return useQuery({
    enabled: !!slug,
    queryKey: ['/api/courses', slug],
    queryFn: ({ signal }) => api.get<CourseDetail>('/api/courses/' + encodeURIComponent(slug!), { signal }),
  });
}

// ── 我的报名 ──
export interface Enrollment {
  courseId: string;
  enrolledAt: string;
  lessonsCompleted: string[];
  currentLessonId: string | null;
  course?: Course;
}

export function useEnrollments() {
  return useQuery({
    queryKey: ['/api/my/enrollments'],
    queryFn: ({ signal }) => api.get<Enrollment[]>('/api/my/enrollments', { signal }),
  });
}

// ── 我的班级 ──
export interface MyClass {
  classId: string;
  role: 'coach' | 'student';
  joinedAt: string;
  class: {
    id: string;
    name: string;
    coverEmoji: string;
    courseId: string;
    course?: { id: string; slug: string; title: string; titleTraditional: string | null };
  };
}

export function useClasses() {
  return useQuery({
    queryKey: ['/api/my/classes'],
    queryFn: ({ signal }) => api.get<MyClass[]>('/api/my/classes', { signal }),
  });
}

// ── 我的进度（聚合 streak / SM2 / byCourse） ──
export interface MyProgress {
  totalAnswered: number;
  totalCorrect: number;
  correctRate: number; // 0..1
  streakDays: number;
  todayAnswered: number;
  byCourse: Array<{
    courseId: string;
    answered: number;
    correct: number;
    masteredCount: number;
  }>;
}

export function useProgress() {
  return useQuery({
    queryKey: ['/api/my/progress'],
    queryFn: ({ signal }) => api.get<MyProgress>('/api/my/progress', { signal }),
  });
}

// ── SM-2 统计 ──
export interface Sm2Stats {
  totalDue: number;
  byCourse: Array<{ courseId: string; due: number }>;
}

export function useSm2Stats() {
  return useQuery({
    queryKey: ['/api/sm2/stats'],
    queryFn: ({ signal }) => api.get<Sm2Stats>('/api/sm2/stats', { signal }),
  });
}

// ── 错题数 / 收藏数（轻量 badge 用 · 走专用 count 端点）──
export function useMistakeCount() {
  return useQuery({
    queryKey: ['/api/mistakes', 'count'],
    queryFn: async ({ signal }) => {
      const r = await api.get<{ count: number }>('/api/mistakes/count', { signal });
      return r?.count ?? 0;
    },
  });
}
export function useFavoriteCount() {
  return useQuery({
    queryKey: ['/api/favorites', 'count'],
    queryFn: async ({ signal }) => {
      const r = await api.get<{ count: number }>('/api/favorites/count', { signal });
      return r?.count ?? 0;
    },
  });
}

// ── 课时题目 + 答题相关 ──

export type QuestionType =
  | 'single' | 'multi' | 'fill' | 'open'
  | 'sort' | 'match' | 'flip'
  | 'image' | 'listen' | 'flow' | 'guided' | 'scenario';

export interface QuestionPublic {
  id: string;
  type: QuestionType;
  courseId: string;
  chapterId: string;
  lessonId: string;
  difficulty: number;
  tags: string[];
  questionText: string;
  /** 评分时后端补全 · 列题时为空串 */
  correctText: string;
  wrongText: string;
  source: string;
  payload: Record<string, unknown>;
}

export function useLessonQuestions(lessonId: string | null | undefined) {
  return useQuery({
    enabled: !!lessonId,
    queryKey: ['/api/lessons', lessonId, 'questions'],
    queryFn: ({ signal }) => api.get<QuestionPublic[]>(
      '/api/lessons/' + encodeURIComponent(lessonId!) + '/questions',
      { signal },
    ),
  });
}

// ── 错题列表 / 详情 ──
export interface MistakeItem {
  id: string;
  questionId: string;
  lastWrongAt: string;
  wrongCount: number;
  question?: QuestionPublic;
}

export function useMistakes() {
  return useQuery({
    queryKey: ['/api/mistakes'],
    queryFn: ({ signal }) => api.get<MistakeItem[]>('/api/mistakes', { signal }),
  });
}

export function useMistakeDetail(questionId: string | null | undefined) {
  return useQuery({
    enabled: !!questionId,
    queryKey: ['/api/mistakes', questionId],
    queryFn: ({ signal }) => api.get<MistakeItem>(
      '/api/mistakes/' + encodeURIComponent(questionId!),
      { signal },
    ),
  });
}

// ── 收藏列表 ──
export interface FavoriteItem {
  id: string;
  createdAt: string;
  questionId: string;
  question?: QuestionPublic;
}
export function useFavorites() {
  return useQuery({
    queryKey: ['/api/favorites'],
    queryFn: ({ signal }) => api.get<FavoriteItem[]>('/api/favorites?limit=500', { signal }),
  });
}

// ── SM-2 待复习卡片 ──
export interface Sm2Card {
  cardId: string;
  questionId: string;
  courseId: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  interval: number;
  repetitions: number;
  easeFactor: number;
  dueDate: string;
  lastReviewed: string | null;
  lastRating: number | null;
  question: QuestionPublic;
  answerReveal: { correctText: string; wrongText: string };
}
export function useSm2Due(opts?: { courseId?: string; limit?: number }) {
  const q: string[] = [];
  if (opts?.courseId) q.push('courseId=' + encodeURIComponent(opts.courseId));
  q.push('limit=' + (opts?.limit ?? 30));
  return useQuery({
    queryKey: ['/api/sm2/due', opts?.courseId ?? null, opts?.limit ?? 30],
    queryFn: ({ signal }) => api.get<Sm2Card[]>('/api/sm2/due?' + q.join('&'), { signal }),
  });
}

// ── 通知 ──
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}
export function useNotifications(opts?: { unreadOnly?: boolean; limit?: number }) {
  const q: string[] = [];
  if (opts?.unreadOnly) q.push('unreadOnly=1');
  q.push('limit=' + (opts?.limit ?? 50));
  return useQuery({
    queryKey: ['/api/notifications', opts?.unreadOnly ?? false, opts?.limit ?? 50],
    queryFn: ({ signal }) => api.get<NotificationItem[]>('/api/notifications?' + q.join('&'), { signal }),
  });
}
export function useUnreadNotifCount() {
  return useQuery({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: async ({ signal }) => {
      const r = await api.get<{ count: number }>('/api/notifications/unread-count', { signal });
      return r?.count ?? 0;
    },
  });
}

// ── 登录会话/设备 ──
export interface SessionInfo {
  id: string;
  isCurrent: boolean;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  issuedAt: string;
  expiresAt: string;
}
export function useSessions() {
  return useQuery({
    queryKey: ['/api/auth/sessions'],
    queryFn: ({ signal }) => api.get<SessionInfo[]>('/api/auth/sessions', { signal }),
  });
}

// ── 班级详情 ──
export interface ClassDetail {
  id: string;
  name: string;
  coverEmoji: string;
  joinCode: string | null;
  courseId: string;
  course?: { id: string; slug: string; title: string; coverEmoji: string };
  members: Array<{
    id: string;
    role: 'coach' | 'student';
    joinedAt: string;
    user: { id: string; dharmaName: string };
  }>;
}
export function useClassDetail(classId: string | null | undefined) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/classes', classId],
    queryFn: ({ signal }) => api.get<ClassDetail>('/api/classes/' + encodeURIComponent(classId!), { signal }),
  });
}

// ── 成就/徽章 ──
export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
  progress?: { current: number; target: number };
}
export function useAchievements() {
  return useQuery({
    queryKey: ['/api/achievements'],
    queryFn: ({ signal }) => api.get<Achievement[]>('/api/achievements', { signal }),
  });
}

// ───────────────────────── Coach (辅导员) ─────────────────────────

export interface CoachClassRow {
  id: string;
  name: string;
  coverEmoji: string;
  joinCode: string | null;
  courseId: string;
  course?: { id: string; slug: string; title: string; coverEmoji: string };
  memberCount?: number;
  myRole: 'coach';
}

export function useCoachClasses() {
  return useQuery({
    queryKey: ['/api/coach/classes'],
    queryFn: ({ signal }) => api.get<CoachClassRow[]>('/api/coach/classes', { signal }),
  });
}

export interface CoachClassStats {
  classId: string;
  memberCount: number;
  activeInWindow: number;
  totalAnswers: number;
  correctRate: number; // 0..1
  windowDays: number;
}
export function useCoachClassStats(classId: string | null | undefined, windowDays = 7) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/coach/classes', classId, 'stats', windowDays],
    queryFn: ({ signal }) => api.get<CoachClassStats>(
      `/api/coach/classes/${encodeURIComponent(classId!)}/stats?windowDays=${windowDays}`,
      { signal },
    ),
  });
}

export interface CoachClassMember {
  id: string;
  role: 'coach' | 'student';
  joinedAt: string;
  user: { id: string; dharmaName: string; email?: string; lastLoginAt?: string | null };
}
export function useCoachClassMembers(classId: string | null | undefined) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/coach/classes', classId, 'members'],
    queryFn: ({ signal }) => api.get<CoachClassMember[]>(
      `/api/coach/classes/${encodeURIComponent(classId!)}/members`,
      { signal },
    ),
  });
}

export interface CoachStudentDetail {
  user: { id: string; dharmaName: string; email: string; lastLoginAt: string | null; status: string };
  summary: {
    totalAnswers: number;
    correctRate: number;
    firstAnswerAt: string | null;
    lastActiveAt: string | null;
  };
  sm2: { new: number; learning: number; review: number; mastered: number; due: number; total: number };
  recentAnswers: Array<{
    id: string;
    questionId: string;
    lessonId: string | null;
    lessonTitle: string | null;
    score: number | null;
    isCorrect: boolean | null;
    createdAt: string;
  }>;
  mistakes: Array<{
    id: string;
    questionId: string;
    questionText: string;
    wrongCount: number;
    lastWrongAt: string;
  }>;
  enrollments: Array<{
    courseId: string;
    courseTitle: string;
    status: string;
    lastStudiedAt: string | null;
  }>;
}
export function useCoachStudent(
  classId: string | null | undefined,
  uid: string | null | undefined,
  recentLimit = 20,
) {
  return useQuery({
    enabled: !!classId && !!uid,
    queryKey: ['/api/coach/classes', classId, 'students', uid, recentLimit],
    queryFn: ({ signal }) => api.get<CoachStudentDetail>(
      `/api/coach/classes/${encodeURIComponent(classId!)}/students/${encodeURIComponent(uid!)}?recentLimit=${recentLimit}`,
      { signal },
    ),
  });
}

export interface CoachQuestion {
  id: string;
  type: QuestionType;
  courseId: string;
  chapterId: string;
  lessonId: string;
  visibility: 'class_private' | 'public';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  difficulty: number;
  tags: string[];
  questionText: string;
  correctText: string;
  wrongText: string;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  ownerClassId?: string | null;
  hasAnswers?: boolean;
}

export function useCoachQuestions(limit = 200) {
  return useQuery({
    queryKey: ['/api/coach/questions', limit],
    queryFn: ({ signal }) => api.get<CoachQuestion[]>(`/api/coach/questions?limit=${limit}`, { signal }),
  });
}
export function useCoachQuestion(id: string | null | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['/api/coach/questions', id],
    queryFn: ({ signal }) => api.get<CoachQuestion>(`/api/coach/questions/${encodeURIComponent(id!)}`, { signal }),
  });
}

// ───────────────────────── Admin (管理员) ─────────────────────────

export interface AdminPlatformStats {
  windowDays: number;
  users: {
    total: number;
    newInWindow: number;
    activeInWindow: number;
    byRole: { admin: number; coach: number; student: number };
  };
  classes: { active: number; archived: number };
  questions: {
    byStatus: { pending: number; approved: number; rejected: number };
    byType: Record<string, number>;
  };
  answers: { total: number; inWindow: number; correctRate: number };
  llm: { monthRequests: number; monthTokens: number; errorRate: number; monthCost: number };
}
export function useAdminPlatformStats(windowDays = 7) {
  return useQuery({
    queryKey: ['/api/admin/platform-stats', windowDays],
    queryFn: ({ signal }) => api.get<AdminPlatformStats>(`/api/admin/platform-stats?windowDays=${windowDays}`, { signal }),
  });
}

export interface AdminUser {
  id: string;
  email: string;
  dharmaName: string | null;
  role: 'admin' | 'coach' | 'student';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
}
export interface AdminUsersResp {
  items: AdminUser[];
  total: number;
  nextCursor: string | null;
}
export function useAdminUsers(opts?: { limit?: number; role?: string; search?: string; cursor?: string }) {
  const q: string[] = [];
  q.push('limit=' + (opts?.limit ?? 50));
  if (opts?.role) q.push('role=' + encodeURIComponent(opts.role));
  if (opts?.search) q.push('search=' + encodeURIComponent(opts.search));
  if (opts?.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
  return useQuery({
    queryKey: ['/api/admin/users', opts?.limit ?? 50, opts?.role ?? '', opts?.search ?? '', opts?.cursor ?? ''],
    queryFn: ({ signal }) => api.get<AdminUsersResp>('/api/admin/users?' + q.join('&'), { signal }),
  });
}

export interface AdminClass {
  id: string;
  name: string;
  coverEmoji: string;
  joinCode: string | null;
  isActive: boolean;
  description: string | null;
  courseId: string;
  course?: { id: string; slug: string; title: string; coverEmoji: string };
  memberCount?: number;
  createdAt: string;
}
export function useAdminClasses() {
  return useQuery({
    queryKey: ['/api/admin/classes'],
    queryFn: ({ signal }) => api.get<AdminClass[]>('/api/admin/classes', { signal }),
  });
}

export interface AdminClassMember {
  id: string;
  role: 'coach' | 'student';
  joinedAt: string;
  user: { id: string; dharmaName: string; email: string };
}
export function useAdminClassMembers(classId: string | null | undefined) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/admin/classes', classId, 'members'],
    queryFn: ({ signal }) => api.get<AdminClassMember[]>(`/api/admin/classes/${encodeURIComponent(classId!)}/members`, { signal }),
  });
}

export interface AdminPendingQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  correctText: string;
  wrongText: string;
  source: string;
  difficulty: number;
  tags: string[];
  payload: Record<string, unknown>;
  courseId: string;
  chapterId: string;
  lessonId: string;
  visibility: 'class_private' | 'public';
  createdByUserId: string;
  createdAt: string;
}
export function useAdminPendingQuestions(opts?: { limit?: number; courseId?: string }) {
  const q: string[] = [];
  q.push('limit=' + (opts?.limit ?? 200));
  if (opts?.courseId) q.push('courseId=' + encodeURIComponent(opts.courseId));
  return useQuery({
    queryKey: ['/api/admin/questions/pending', opts?.limit ?? 200, opts?.courseId ?? ''],
    queryFn: ({ signal }) => api.get<AdminPendingQuestion[]>('/api/admin/questions/pending?' + q.join('&'), { signal }),
  });
}

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}
export interface AdminAuditResp {
  items: AdminAuditEntry[];
  nextCursor: string | null;
}
export function useAdminAudit(opts?: { adminId?: string; action?: string; targetType?: string; targetId?: string; limit?: number; cursor?: string }) {
  const q: string[] = [];
  q.push('limit=' + (opts?.limit ?? 50));
  if (opts?.adminId) q.push('adminId=' + encodeURIComponent(opts.adminId));
  if (opts?.action) q.push('action=' + encodeURIComponent(opts.action));
  if (opts?.targetType) q.push('targetType=' + encodeURIComponent(opts.targetType));
  if (opts?.targetId) q.push('targetId=' + encodeURIComponent(opts.targetId));
  if (opts?.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
  return useQuery({
    queryKey: ['/api/admin/audit', opts?.action ?? '', opts?.targetType ?? '', opts?.limit ?? 50, opts?.cursor ?? ''],
    queryFn: ({ signal }) => api.get<AdminAuditResp>('/api/admin/audit?' + q.join('&'), { signal }),
  });
}

export interface AdminLogEntry {
  id: string;
  kind: 'error' | 'slow_request' | 'slow_query';
  message: string;
  userId: string | null;
  requestId: string | null;
  stack: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
export interface AdminLogsResp {
  items: AdminLogEntry[];
  nextCursor: string | null;
}
export function useAdminLogs(opts?: { kind?: string; userId?: string; requestId?: string; limit?: number; cursor?: string }) {
  const q: string[] = [];
  q.push('limit=' + (opts?.limit ?? 50));
  if (opts?.kind) q.push('kind=' + encodeURIComponent(opts.kind));
  if (opts?.userId) q.push('userId=' + encodeURIComponent(opts.userId));
  if (opts?.requestId) q.push('requestId=' + encodeURIComponent(opts.requestId));
  if (opts?.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
  return useQuery({
    queryKey: ['/api/admin/logs', opts?.kind ?? '', opts?.limit ?? 50, opts?.cursor ?? ''],
    queryFn: ({ signal }) => api.get<AdminLogsResp>('/api/admin/logs?' + q.join('&'), { signal }),
  });
}
export interface AdminLogsStats {
  windowHours: number;
  counts: { error: number; slow_request: number; slow_query: number };
}
export function useAdminLogsStats() {
  return useQuery({
    queryKey: ['/api/admin/logs/stats'],
    queryFn: ({ signal }) => api.get<AdminLogsStats>('/api/admin/logs/stats', { signal }),
  });
}

export type ReportReason = 'wrong_answer' | 'sensitive' | 'doctrine_error' | 'typo' | 'other';
export interface AdminReport {
  id: string;
  questionId: string;
  reason: ReportReason;
  details: string | null;
  reportedByUserId: string;
  createdAt: string;
  question?: { id: string; questionText: string };
}
export function useAdminReports(opts?: { limit?: number; reason?: ReportReason }) {
  const q: string[] = [];
  q.push('limit=' + (opts?.limit ?? 200));
  if (opts?.reason) q.push('reason=' + encodeURIComponent(opts.reason));
  return useQuery({
    queryKey: ['/api/admin/reports/pending', opts?.limit ?? 200, opts?.reason ?? ''],
    queryFn: ({ signal }) => api.get<AdminReport[]>('/api/admin/reports/pending?' + q.join('&'), { signal }),
  });
}

// ── Admin · 法本/章节/课时 三级 CRUD ──
export interface AdminCourseRow {
  id: string;
  slug: string;
  title: string;
  titleTraditional: string | null;
  author: string | null;
  description: string | null;
  coverEmoji: string;
  coverImageUrl: string | null;
  displayOrder: number;
  isPublished: boolean;
  archivedAt: string | null;
  createdAt: string;
  chapterCount: number;
  lessonCount: number;
  enrollmentCount: number;
}

export interface AdminCourseDetail {
  id: string;
  slug: string;
  title: string;
  titleTraditional: string | null;
  author: string | null;
  authorInfo: string | null;
  description: string | null;
  coverEmoji: string;
  coverImageUrl: string | null;
  displayOrder: number;
  isPublished: boolean;
  licenseInfo: string | null;
  chapters: AdminChapter[];
}
export interface AdminChapter {
  id: string;
  order: number;
  title: string;
  titleTraditional: string | null;
  lessons: AdminLesson[];
}
export interface AdminLesson {
  id: string;
  order: number;
  title: string;
  titleTraditional: string | null;
  referenceText: string | null;
  teachingSummary: string | null;
}

export function useAdminCourses() {
  return useQuery({
    queryKey: ['/api/admin/courses'],
    queryFn: ({ signal }) => api.get<AdminCourseRow[]>('/api/admin/courses', { signal }),
  });
}

export function useAdminCourseDetail(id: string | null | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['/api/admin/courses', id],
    queryFn: ({ signal }) => api.get<AdminCourseDetail>(`/api/admin/courses/${encodeURIComponent(id!)}`, { signal }),
  });
}
