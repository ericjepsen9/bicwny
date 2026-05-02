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

export interface StudentSummary {
  totalAnswers: number;
  correctRate: number;
  firstAnswerAt: Date | null;
  lastActiveAt: Date | null;
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
}
