// 单学员学修详情（辅导员点开学生看进度）
// 一次性并发拉：概览 / 近期答题 / 错题本 / SM-2 / 论典报名
// 权限在路由层（requireClassCoachAccess）确认，本函数不做班级校验。
export interface RecentAnswer {
  questionId: string;
  lessonTitle: string;
  isCorrect: boolean | null;
  score: number | null;
  answeredAt: Date;
}

export interface MistakeItem {
  questionId: string;
  questionText: string;
  wrongCount: number;
  lastWrongAt: Date;
}

export interface EnrollmentItem {
  courseId: string;
  title: string;
  lastStudiedAt: Date | null;
  completedAt: Date | null;
}

export interface PracticeSummaryItem {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  emoji: string;
  totalCount: number;
  todayCount: number;
}

export interface MeditationItem {
  meditationId: string;
  title: string;
  videoWatchedSec: number;
  completedAt: Date;
}

export interface StudentSummary {
  totalAnswers: number;
  correctRate: number;
  firstAnswerAt: Date | null;
  lastActiveAt: Date | null;
}

export interface DailyPoint {
  date: string; // 'YYYY-MM-DD' 服务器 local
  count: number;
  correct: number;
}

export interface StudentDetail {
  user: {
    id: string;
    email: string | null;
    dharmaName: string | null;
    lastLoginAt: Date | null;
    isActive: boolean;
  };
  summary: StudentSummary;
  /** 最近 30 天每日答题（已按班级 courseId 过滤） */
  dailySeries: DailyPoint[];
  recentAnswers: RecentAnswer[];
  mistakes: MistakeItem[];
  sm2Progress: {
    new: number;
    learning: number;
    review: number;
    mastered: number;
    due: number;
    total: number;
  };
  enrollments: EnrollmentItem[];
  /** 修学计数（按 4 大类聚合 · 隐藏「观修」大类） */
  practice: {
    streak: number;
    totalCount: number; // 全平台累计
    categories: PracticeSummaryItem[];
  };
  /** 该学员在本班课程下的已完成观修（不跨班 · 仅 class.courseId） */
  meditations: MeditationItem[];
}
