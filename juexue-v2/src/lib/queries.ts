// 觉学 v2 · 共享 React Query hooks
// 所有 GET 数据走这里 · queryKey 统一约定 · staleTime 5min（main.tsx 默认）
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  category: string | null;
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

// useCourseDetail · 论典详情
//   默认 = 全树（含 referenceText）· 单课原文几十~几百 KB · 整书可达 MB
//   传 { lite: true } · 后端跳过 referenceText / teachingSummary · TOC / 进度叠加场景用
//   传 { lessonId } · 单 lesson 模式 · 只有该 lesson 带原文 · 其他仍返回 id/title
//   queryKey 包含 mode 以区分缓存
export function useCourseDetail(
  slug: string | null | undefined,
  opts?: { lite?: boolean; lessonId?: string },
) {
  const lite = !!opts?.lite;
  const lessonId = opts?.lessonId;
  return useQuery({
    enabled: !!slug,
    queryKey: ['/api/courses', slug, lessonId ? `lesson:${lessonId}` : (lite ? 'lite' : 'full')],
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams();
      if (lite) qs.set('lite', '1');
      if (lessonId) qs.set('lessonId', lessonId);
      const path = '/api/courses/' + encodeURIComponent(slug!) + (qs.toString() ? '?' + qs.toString() : '');
      // 后端返回 { course, overlay } 包装 · api.* 已剥外层 { data: ... }
      // 兼容两种 shape：直接是 CourseDetail · 或 { course, overlay }
      const r = await api.get<CourseDetail | { course: CourseDetail; overlay?: unknown }>(path, { signal });
      if (r && typeof r === 'object' && 'course' in r && (r as { course?: unknown }).course) {
        return (r as { course: CourseDetail }).course;
      }
      return r as CourseDetail;
    },
  });
}

// ── 我的报名 ──
export interface Enrollment {
  courseId: string;
  enrolledAt: string;
  lastStudiedAt: string | null;
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

// ── 更新报名进度 · currentLessonId 记忆"上次阅读位置" ──
export function useUpdateEnrollmentProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { courseId: string; currentLessonId?: string | null; addCompletedLessonId?: string }) => {
      const { courseId, ...body } = vars;
      return api.patch(`/api/enrollments/${encodeURIComponent(courseId)}/progress`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/enrollments'] });
    },
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
  | 'sort' | 'match' | 'flip' | 'verse' | 'chain'
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

// 智能练习选题 · SM-2 + 错题 + 已学课时混合 · 可限到某 course / 仅错题 / 单题
export function useSmartPractice(opts: {
  enabled: boolean;
  limit?: number;
  courseId?: string;
  onlyMistakes?: boolean;
  /** 单题模式 · 错题详情"再练这一道" */
  questionId?: string;
}) {
  const q: string[] = [];
  if (opts.limit) q.push('limit=' + opts.limit);
  if (opts.courseId) q.push('courseId=' + encodeURIComponent(opts.courseId));
  if (opts.onlyMistakes) q.push('onlyMistakes=true');
  if (opts.questionId) q.push('questionId=' + encodeURIComponent(opts.questionId));
  return useQuery({
    enabled: opts.enabled,
    refetchOnMount: 'always',
    queryKey: [
      '/api/quiz/smart-practice',
      opts.limit ?? 10,
      opts.courseId ?? '',
      opts.onlyMistakes ?? false,
      opts.questionId ?? '',
    ],
    queryFn: ({ signal }) => api.get<QuestionPublic[]>(
      '/api/quiz/smart-practice' + (q.length ? '?' + q.join('&') : ''),
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
  isRead: boolean;
  createdAt: string;
  link?: string | null;       // 应用内路径（如 /class/:id）· 点击跳转用
  revokedAt?: string | null;  // 撤回时间 · 前端置灰 + 删除线
}

// ── 系统公告（spec §3.6）──
export interface SystemAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: 'normal' | 'urgent' | 'critical';
  expiresAt: string;
  revokedAt: string | null;
  contentHash: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export function useSystemAnnouncement(id: string | null | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['/api/system-announcements', id],
    queryFn: ({ signal }) => api.get<SystemAnnouncement>(`/api/system-announcements/${encodeURIComponent(id!)}`, { signal }),
  });
}

// ── 法会 / 系统活动（spec §3.7）──
export interface DharmaAssembly {
  id: string;
  title: string;
  category: 'assembly' | 'system_session' | 'memorial';
  startAt: string;
  endAt: string;
  description: string;
  coverImage: string | null;
  externalLink: string | null;
  deletedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export function useDharmaAssembly(id: string | null | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['/api/assemblies', id],
    queryFn: ({ signal }) => api.get<DharmaAssembly>(`/api/assemblies/${encodeURIComponent(id!)}`, { signal }),
  });
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

// 游标分页版（审计）· 收件箱"加载更多"用 · key 前缀仍是 ['/api/notifications']
//   → PushSync / 乐观更新的 invalidate 仍命中
export const NOTIF_PAGE_SIZE = 30;
export function useInfiniteNotifications(opts?: { unreadOnly?: boolean }) {
  const unreadOnly = opts?.unreadOnly ?? false;
  return useInfiniteQuery({
    queryKey: ['/api/notifications', 'infinite', unreadOnly],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const q = [`limit=${NOTIF_PAGE_SIZE}`];
      if (unreadOnly) q.push('unreadOnly=1');
      if (pageParam) q.push('cursor=' + encodeURIComponent(pageParam));
      return api.get<NotificationItem[]>('/api/notifications?' + q.join('&'), { signal });
    },
    // 满页才有下一页 · 游标 = 末条 id（后端 orderBy createdAt,id 已确定性）
    getNextPageParam: (last) => (last.length === NOTIF_PAGE_SIZE ? last[last.length - 1]?.id : undefined),
  });
}
export function useUnreadNotifCount() {
  return useQuery({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: async ({ signal }) => {
      const r = await api.get<{ count: number }>('/api/notifications/unread-count', { signal });
      return r?.count ?? 0;
    },
    // 红点要新鲜（审计）· 覆盖全局 5min staleTime · 回到 tab 时刷新；
    // app 开着时收到 push 由 SW postMessage → PushSync 主动失效（即时）
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
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
export type BadgeCategory = 'activity' | 'streak' | 'accuracy' | 'mastery' | 'breadth';
export interface Badge {
  id: string;
  category: BadgeCategory;
  titleSc: string;
  titleTc: string;
  descSc: string;
  descTc: string;
  unlocked: boolean;
  /** 0..1 进度比例 */
  progress: number;
  current: number;
  target: number;
}
export interface AchievementsResp {
  totalBadges: number;
  unlockedCount: number;
  badges: Badge[];
  metrics: {
    totalAnswers: number;
    correctRate: number;
    streakCurrent: number;
    streakLongest: number;
    sm2Mastered: number;
    coursesCovered: number;
  };
}
export function useAchievements() {
  return useQuery({
    queryKey: ['/api/achievements'],
    queryFn: ({ signal }) => api.get<AchievementsResp>('/api/achievements', { signal }),
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

export interface DailyPoint {
  date: string;     // 'YYYY-MM-DD'
  count: number;
  correct: number;
}

export interface CoachStudentDetail {
  user: { id: string; dharmaName: string; email: string; lastLoginAt: string | null; status: string };
  summary: {
    totalAnswers: number;
    correctRate: number;
    firstAnswerAt: string | null;
    lastActiveAt: string | null;
  };
  /** 最近 30 天每日答题（已按班级 courseId 过滤） */
  dailySeries: DailyPoint[];
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
  /** 修学计数（4 大类 · 隐藏观修）· 后端可选 · 老前端兼容 */
  practice?: {
    streak: number;
    totalCount: number;
    categories: Array<{
      categoryId: string;
      categoryKey: string;
      categoryName: string;
      emoji: string;
      totalCount: number;
      todayCount: number;
    }>;
  };
  /** 该班课程下完成的观修（≤ 50 条 · 倒序） */
  meditations?: Array<{
    meditationId: string;
    title: string;
    videoWatchedSec: number;
    completedAt: string;
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
    // 兼容老/新 shape：老后端返回 AdminUser[] · 新返回 { items, total }
    // 调用方用 Array.isArray() 做类型收窄
    queryFn: ({ signal }) => api.get<AdminUsersResp | AdminUser[]>('/api/admin/users?' + q.join('&'), { signal }),
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
  question?: {
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
    reviewStatus: string;
  };
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

// ── Admin · 闻思/章节/课时 三级 CRUD ──
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
  category: string | null;
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

// ── Admin · LLM 管理 ──
export type LlmRole = 'primary' | 'fallback' | 'disabled';
export type LlmHealth = 'healthy' | 'degraded' | 'down' | 'quota_exceeded';
export type OveragePolicy = 'stop' | 'pay_as_you_go' | 'fallback';

export interface LlmProvider {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  apiKeyEnvHint: string | null;
  defaultModel: string;
  isEnabled: boolean;
  role: LlmRole;
  priority: number;
  yearlyTokenQuota: string | null;
  monthlyTokenQuota: string | null;
  dailyRequestQuota: number | null;
  rpmLimit: number | null;
  concurrencyLimit: number | null;
  reservePercent: number;
  enabledFrom: string | null;
  enabledUntil: string | null;
  overagePolicy: OveragePolicy;
  healthStatus: LlmHealth;
  consecutiveErrors: number;
  circuitOpenUntil: string | null;
  lastErrorAt: string | null;
  lastSuccessAt: string | null;
  inputCostPer1k: number;
  outputCostPer1k: number;
  updatedAt: string;
  createdAt: string;
}

export function useAdminLlmProviders() {
  return useQuery({
    queryKey: ['/api/admin/llm/providers'],
    queryFn: ({ signal }) => api.get<LlmProvider[]>('/api/admin/llm/providers', { signal }),
  });
}

export interface LlmUsage {
  periodType: string;
  periodKey: string;
  byProvider: Array<{
    providerId: string;
    name: string;
    displayName: string;
    periodKey: string;
    tokenCount: number;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    errorCount: number;
    cost: number;
  }>;
  totals: {
    tokenCount: number;
    requestCount: number;
    errorCount: number;
    cost: number;
  };
}
export function useAdminLlmUsage(periodType: 'year' | 'month' | 'day' | 'hour' = 'month') {
  return useQuery({
    queryKey: ['/api/admin/llm/usage', periodType],
    queryFn: ({ signal }) => api.get<LlmUsage>(`/api/admin/llm/usage?periodType=${periodType}`, { signal }),
  });
}

export interface LlmLog {
  id: string;
  requestId: string;
  scenario: string;
  userId: string | null;
  coachId: string | null;
  providerUsed: string;
  providerTried: string[];
  switched: boolean;
  switchReason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  promptHash: string | null;
  timestamp: string;
}
export function useAdminLlmLogs(opts?: { success?: boolean; limit?: number; cursor?: string }) {
  const q: string[] = [];
  q.push('limit=' + (opts?.limit ?? 50));
  if (opts?.success === true) q.push('success=true');
  if (opts?.success === false) q.push('success=false');
  if (opts?.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
  return useQuery({
    queryKey: ['/api/admin/llm/logs', opts?.success ?? '', opts?.limit ?? 50, opts?.cursor ?? ''],
    queryFn: ({ signal }) => api.get<LlmLog[]>('/api/admin/llm/logs?' + q.join('&'), { signal }),
  });
}

// ── Admin · 单用户学习画像 ──────────────────────────────
export interface AdminUserLearning {
  account: {
    id: string;
    email: string | null;
    dharmaName: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
  };
  summary: {
    totalAnswers: number;
    correctAnswers: number;
    correctRate: number;
    firstAnswerAt: string | null;
    lastActiveAt: string | null;
  };
  dailySeries: DailyPoint[];
  sm2Progress: { new: number; learning: number; review: number; mastered: number; due: number; total: number };
  byCourse: Array<{
    courseId: string;
    title: string;
    coverEmoji: string;
    answered: number;
    correct: number;
    masteredCount: number;
    lastStudiedAt: string | null;
  }>;
  classMemberships: Array<{
    classId: string;
    className: string;
    role: 'coach' | 'student';
    joinedAt: string;
    coverEmoji: string;
  }>;
}

export function useAdminUserLearning(userId: string | null | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['/api/admin/users', userId, 'learning'],
    queryFn: ({ signal }) => api.get<AdminUserLearning>(`/api/admin/users/${encodeURIComponent(userId!)}/learning`, { signal }),
  });
}

// ── Admin · 观修 v1 ──
export interface AdminMeditation {
  id: string;
  lessonId: string | null;
  courseId: string | null;
  title: string;
  titleTraditional: string | null;
  description: string | null;
  authorName: string | null;
  videoUrl: string;
  videoDurationSec: number;
  /** v2 · 转换后的图片 URL 数组 · 学员侧主用 */
  slideImageUrls: string[] | null;
  /** v1 兼容 · PDF 原文件 · 老前端 fallback */
  slidesPdfUrl: string | null;
  isPublished: boolean;
  displayOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAdminMeditations(opts?: { courseId?: string; lessonId?: string; includeArchived?: boolean }) {
  const qs = new URLSearchParams();
  if (opts?.courseId) qs.set('courseId', opts.courseId);
  if (opts?.lessonId) qs.set('lessonId', opts.lessonId);
  if (opts?.includeArchived) qs.set('includeArchived', '1');
  const qStr = qs.toString();
  return useQuery({
    queryKey: ['/api/admin/meditations', qStr],
    queryFn: ({ signal }) => api.get<AdminMeditation[]>('/api/admin/meditations' + (qStr ? '?' + qStr : ''), { signal }),
  });
}

export function useAdminMeditationDetail(id: string | null | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['/api/admin/meditations', id],
    queryFn: ({ signal }) => api.get<AdminMeditation>(`/api/admin/meditations/${encodeURIComponent(id!)}`, { signal }),
  });
}

// ── Admin · 题目（按课时浏览 + 详情 · 跨 coach） ──
export interface AdminLessonQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  difficulty: number;
  tags: string[];
  visibility: 'public' | 'class_private' | 'draft';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  ownerClassId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  courseId: string;
  chapterId: string;
  lessonId: string;
}

export function useAdminLessonQuestions(lessonId: string | null | undefined) {
  return useQuery({
    enabled: !!lessonId,
    queryKey: ['/api/admin/lessons', lessonId, 'questions'],
    queryFn: ({ signal }) => api.get<AdminLessonQuestion[]>(`/api/admin/lessons/${encodeURIComponent(lessonId!)}/questions`, { signal }),
  });
}

export interface AdminQuestionDetail extends AdminLessonQuestion {
  correctText: string;
  wrongText: string;
  source: string;
  payload: Record<string, unknown>;
}

export function useAdminQuestionDetail(id: string | null | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['/api/admin/questions', id],
    queryFn: ({ signal }) => api.get<AdminQuestionDetail>(`/api/admin/questions/${encodeURIComponent(id!)}`, { signal }),
  });
}

// ── 学员观修 (v1) ──
export interface StudentMeditation {
  id: string;
  lessonId: string | null;
  courseId: string | null;
  title: string;
  titleTraditional: string | null;
  description: string | null;
  authorName: string | null;
  videoUrl: string;
  videoDurationSec: number;
  slideImageUrls: string[] | null;
  slidesPdfUrl: string | null;
  isPublished: boolean;
  displayOrder: number;
}

export interface MeditationDetailResp {
  meditation: StudentMeditation;
  latestSession?: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    videoWatchedSec: number;
    isCompleted: boolean;
  };
  totalCompletions: number;
}

/** 取课时关联的观修（如有 · 否则 null） */
export function useLessonMeditation(lessonId: string | null | undefined) {
  return useQuery({
    enabled: !!lessonId,
    queryKey: ['/api/lessons', lessonId, 'meditation'],
    queryFn: ({ signal }) => api.get<StudentMeditation | null>(`/api/lessons/${encodeURIComponent(lessonId!)}/meditation`, { signal }),
  });
}

/** 观修详情 + 最近 session + 完成次数 */
export function useMeditationDetail(meditationId: string | null | undefined) {
  return useQuery({
    enabled: !!meditationId,
    queryKey: ['/api/meditations', meditationId],
    queryFn: ({ signal }) => api.get<MeditationDetailResp>(`/api/meditations/${encodeURIComponent(meditationId!)}`, { signal }),
  });
}

/** 闻思下所有已发布观修（目录页批量用） · key: lessonId → meditation */
export function useCourseMeditations(courseId: string | null | undefined) {
  return useQuery({
    enabled: !!courseId,
    queryKey: ['/api/courses', courseId, 'meditations'],
    queryFn: ({ signal }) => api.get<StudentMeditation[]>(`/api/courses/${encodeURIComponent(courseId!)}/meditations`, { signal }),
  });
}

// ── 班级观修排行（v1） ──
export interface MeditationRankingRow {
  userId: string;
  dharmaName: string | null;
  count: number;
  totalSec: number;
}

export type MeditationRankingPeriod = 'week' | 'month' | 'all';

export function useClassMeditationRanking(
  classId: string | null | undefined,
  period: MeditationRankingPeriod = 'month',
) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/classes', classId, 'meditation-ranking', period],
    queryFn: ({ signal }) => api.get<MeditationRankingRow[]>(
      `/api/classes/${encodeURIComponent(classId!)}/meditation-ranking?period=${period}`,
      { signal },
    ),
  });
}

// ── Admin · 删除前依赖检查 ──
export interface ChapterDependencies { questionCount: number; lessonCount: number; }
export interface LessonDependencies { questionCount: number; meditationCount: number; }

export async function fetchChapterDependencies(chapterId: string): Promise<ChapterDependencies> {
  return api.get<ChapterDependencies>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/dependencies`);
}
export async function fetchLessonDependencies(lessonId: string): Promise<LessonDependencies> {
  return api.get<LessonDependencies>(`/api/admin/lessons/${encodeURIComponent(lessonId)}/dependencies`);
}

// ═══════════════════════════════════════════════════════════════
// 修学计数（持咒 / 礼拜 / 诵经 / 供曼扎 / 观修）
// ═══════════════════════════════════════════════════════════════

export interface PracticeCategory {
  id: string;
  key: string;
  name: string;
  emoji: string;
  displayOrder: number;
}

export interface PracticeProject {
  id: string;
  categoryId: string;
  name: string;
  emoji: string | null;
  scope: 'user' | 'class';
  classId: string | null;
  className: string | null;
  ownerId: string | null;
  isBuiltin: boolean;
  isMine: boolean;
  totalCount: number;
  todayCount: number;
}

export interface PracticeMakeupStatus {
  perWeek: number;
  usedThisWeek: number;
  remaining: number;
  windowDays: number;
  earliestDate: string;  // 可补的最早日（含）YYYY-MM-DD
  latestDate: string;    // 可补的最晚日（昨天）
  madeUpDates: string[]; // 窗口内已补签的目标日
}

export interface PracticeSummary {
  streak: number;
  makeup: PracticeMakeupStatus;
  today: string;
  categories: Array<{
    id: string;
    key: string;
    name: string;
    emoji: string;
    todayCount: number;
    totalCount: number;
  }>;
}

export interface PracticeHistory {
  dailySeries: Array<{ date: string; count: number }>;
  projectsSummary: Array<{
    projectId: string;
    projectName: string;
    projectEmoji: string | null;
    categoryId: string;
    totalCount: number;
  }>;
}

export interface PracticeGoal {
  id: string;
  projectId: string;
  dailyTarget: number;
  project: { id: string; name: string; emoji: string | null; categoryId: string };
}

export interface PracticeTask {
  id: string;
  scope: 'self' | 'class';
  mode: 'daily' | 'fixed';
  project: { id: string; name: string; emoji: string | null; categoryId: string };
  class: { id: string; name: string } | null;
  title: string | null;
  target: number;
  progress: number;
  startAt: string;
  endAt: string | null;
  isDone: boolean;
}

export function usePracticeCategories() {
  return useQuery({
    queryKey: ['/api/practice/categories'],
    queryFn: ({ signal }) => api.get<PracticeCategory[]>('/api/practice/categories', { signal }),
  });
}
export function usePracticeProjects() {
  return useQuery({
    queryKey: ['/api/practice/projects'],
    queryFn: ({ signal }) => api.get<PracticeProject[]>('/api/practice/projects', { signal }),
  });
}
export function usePracticeSummary() {
  return useQuery({
    queryKey: ['/api/practice/summary'],
    queryFn: ({ signal }) => api.get<PracticeSummary>('/api/practice/summary', { signal }),
  });
}
export function usePracticeHistory(projectId?: string) {
  return useQuery({
    queryKey: ['/api/practice/history', projectId ?? null],
    queryFn: ({ signal }) => api.get<PracticeHistory>(
      '/api/practice/history' + (projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''),
      { signal },
    ),
  });
}
// 补签某一天（保连续 · 每周 1 次 · 仅近 7 天）
export function usePracticeMakeup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.post<PracticeMakeupStatus>('/api/practice/makeup', { date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/practice/summary'] });
      qc.invalidateQueries({ queryKey: ['/api/practice/history'] });
    },
  });
}
export function usePracticeGoals() {
  return useQuery({
    queryKey: ['/api/practice/goals'],
    queryFn: ({ signal }) => api.get<PracticeGoal[]>('/api/practice/goals', { signal }),
  });
}
export function usePracticeTasks() {
  return useQuery({
    queryKey: ['/api/practice/tasks'],
    queryFn: ({ signal }) => api.get<PracticeTask[]>('/api/practice/tasks', { signal }),
  });
}

// ── 文本高亮 / 标记 ──────────────────────────
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';
export interface Highlight {
  id: string;
  lessonId: string;
  paragraphIndex: number;
  textStart: number;
  textEnd: number;
  anchorText: string;
  color: HighlightColor;
  createdAt: string;
}
export function useLessonHighlights(lessonId: string | null | undefined) {
  return useQuery({
    enabled: !!lessonId,
    queryKey: ['/api/lessons', lessonId, 'highlights'],
    queryFn: ({ signal }) => api.get<Highlight[]>(`/api/lessons/${encodeURIComponent(lessonId!)}/highlights`, { signal }),
  });
}


// ── 共修安排 ClassSession（v1 · 单次事件）──────────
export interface ClassSession {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  startAt: string;       // ISO
  durationMin: number;
  liveLink: string | null;
  editVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 辅导员侧 · 列表（未来 / 历史）
export function useClassSessions(classId: string | null | undefined, opts?: { past?: boolean }) {
  const past = !!opts?.past;
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/coach/classes', classId, 'sessions', past ? 'past' : 'upcoming'],
    queryFn: ({ signal }) => api.get<ClassSession[]>(
      `/api/coach/classes/${encodeURIComponent(classId!)}/sessions${past ? '?past=1' : ''}`,
      { signal },
    ),
  });
}

// 学员侧 · 我未来 N 分钟内所有事件
//   v2: 含 ClassSession + DharmaAssembly 联合
export interface UpcomingEvent {
  kind: 'class_session' | 'dharma_assembly';
  id: string;
  title: string;
  description: string | null;
  subtitle: string;       // 班级名 / 法会 category
  startAt: string;
  endAt?: string;
  durationMin?: number;
  liveLink?: string | null;
  editVersion?: number;
  classId?: string;
  category?: string;
  detailPath: string;
}

// 单场共修详情（push/banner 跳转目标）
export interface ClassSessionDetail {
  id: string;
  classId: string;
  className: string;
  title: string;
  description: string | null;
  startAt: string;
  durationMin: number;
  liveLink: string | null;
  editVersion: number;
}
export function useClassSessionDetail(classId: string | null | undefined, sessionId: string | null | undefined) {
  return useQuery({
    enabled: !!classId && !!sessionId,
    queryKey: ['/api/classes', classId, 'sessions', sessionId],
    queryFn: ({ signal }) => api.get<ClassSessionDetail>(
      `/api/classes/${encodeURIComponent(classId!)}/sessions/${encodeURIComponent(sessionId!)}`,
      { signal },
    ),
  });
}
export function useUpcomingEvents(withinMin = 60) {
  return useQuery({
    queryKey: ['/api/my/upcoming-events', withinMin],
    queryFn: ({ signal }) => api.get<UpcomingEvent[]>(
      `/api/my/upcoming-events?within=${withinMin}`, { signal },
    ),
    refetchInterval: 60_000,
  });
}

// 学员侧 · 首页卡 top-1
export function useTopHomeCard() {
  return useQuery({
    queryKey: ['/api/my/top-home-card'],
    queryFn: ({ signal }) => api.get<UpcomingEvent | null>('/api/my/top-home-card', { signal }),
    refetchInterval: 60_000,
  });
}

// ── 班级修学排行 · 学员侧 · 念诵/计数 ────────
export type PracticeRankingPeriod = 'week' | 'month' | 'all';
export interface PracticeRankingRow {
  userId: string;
  dharmaName: string | null;
  avatar: string | null;
  total: number;
}
export function useClassPracticeRanking(
  classId: string | null | undefined,
  period: PracticeRankingPeriod,
  categoryKey?: string,
) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/classes', classId, 'practice-ranking', period, categoryKey ?? ''],
    queryFn: ({ signal }) => {
      const qs = new URLSearchParams({ period });
      if (categoryKey) qs.set('categoryKey', categoryKey);
      return api.get<PracticeRankingRow[]>(
        `/api/classes/${encodeURIComponent(classId!)}/practice-ranking?${qs}`,
        { signal },
      );
    },
  });
}

// ── 班级综合修学排行（积分制）─────────────────────
export type StudyRankingPeriod = 'week' | 'month' | 'all';
export interface StudyRankingRow {
  userId: string;
  dharmaName: string | null;
  avatar: string | null;
  score: number;
  breakdown: {
    chanting: number;
    meditationCount: number;
    meditationMin: number;
    answerCount: number;
    readingLessons: number;
    activeDays: number;
  };
}
export function useClassStudyRanking(
  classId: string | null | undefined,
  period: StudyRankingPeriod,
) {
  return useQuery({
    enabled: !!classId,
    queryKey: ['/api/classes', classId, 'study-ranking', period],
    queryFn: ({ signal }) => api.get<StudyRankingRow[]>(
      `/api/classes/${encodeURIComponent(classId!)}/study-ranking?period=${period}`,
      { signal },
    ),
  });
}
