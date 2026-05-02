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
