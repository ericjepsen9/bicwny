// coach 统计的返回类型 + 空状态构造器
export interface PerStudent {
  userId: string;
  dharmaName: string | null;
  answers: number;
  correctRate: number;
  lastActiveAt: Date | null;
}

export interface ByLesson {
  lessonId: string;
  title: string;
  answered: number;
  correctRate: number;
}

export interface ClassStats {
  memberCount: number;
  activeInWindow: number;
  totalAnswers: number;
  correctRate: number;
  windowDays: number;
  byLesson: ByLesson[];
  topStudents: PerStudent[];
  stragglers: PerStudent[];
}

export function emptyClassStats(windowDays: number): ClassStats {
  return {
    memberCount: 0,
    activeInWindow: 0,
    totalAnswers: 0,
    correctRate: 0,
    windowDays,
    byLesson: [],
    topStudents: [],
    stragglers: [],
  };
}
