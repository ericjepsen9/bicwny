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

// ── 错题数 / 收藏数（轻量 head 用）──
//   /api/mistakes 与 /api/favorites 默认返完整列表 · 这里仅取 length
export function useMistakeCount() {
  return useQuery({
    queryKey: ['/api/mistakes', 'count'],
    queryFn: async ({ signal }) => {
      const list = await api.get<unknown[]>('/api/mistakes', { signal });
      return Array.isArray(list) ? list.length : 0;
    },
  });
}
export function useFavoriteCount() {
  return useQuery({
    queryKey: ['/api/favorites', 'count'],
    queryFn: async ({ signal }) => {
      const list = await api.get<unknown[]>('/api/favorites?limit=500', { signal });
      return Array.isArray(list) ? list.length : 0;
    },
  });
}
