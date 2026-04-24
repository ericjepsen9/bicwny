// 成就徽章 · 从 UserAnswer / SM-2 / streak 派生（无独立 DB 表）
// 每枚徽章有一个门槛函数 test(metrics) → { unlocked, progress }
// progress 是 0-1 之间的值，前端可据此画进度条
import { myProgress, type MyProgress } from '../answering/progress.service.js';

export type BadgeCategory = 'activity' | 'streak' | 'accuracy' | 'mastery' | 'breadth';

export interface BadgeDef {
  id: string;
  category: BadgeCategory;
  titleSc: string;
  titleTc: string;
  descSc: string;
  descTc: string;
  test: (m: MyProgress) => { unlocked: boolean; progress: number; current: number; target: number };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function countTest(
  target: number,
  getter: (m: MyProgress) => number,
): BadgeDef['test'] {
  return (m) => {
    const current = getter(m);
    return {
      unlocked: current >= target,
      progress: clamp01(current / target),
      current,
      target,
    };
  };
}

export const BADGES: BadgeDef[] = [
  // 活跃 · 累计答题
  {
    id: 'first_answer',
    category: 'activity',
    titleSc: '初入学堂',
    titleTc: '初入學堂',
    descSc: '完成第一道题',
    descTc: '完成第一道題',
    test: countTest(1, (m) => m.totalAnswers),
  },
  {
    id: 'hundred_answers',
    category: 'activity',
    titleSc: '百题精进',
    titleTc: '百題精進',
    descSc: '累计答题满 100 道',
    descTc: '累計答題滿 100 道',
    test: countTest(100, (m) => m.totalAnswers),
  },
  {
    id: 'thousand_answers',
    category: 'activity',
    titleSc: '千题大士',
    titleTc: '千題大士',
    descSc: '累计答题满 1000 道',
    descTc: '累計答題滿 1000 道',
    test: countTest(1000, (m) => m.totalAnswers),
  },

  // 连续打卡
  {
    id: 'streak_3',
    category: 'streak',
    titleSc: '三日精勤',
    titleTc: '三日精勤',
    descSc: '连续答题 3 日',
    descTc: '連續答題 3 日',
    test: countTest(3, (m) => m.streak.longest),
  },
  {
    id: 'streak_7',
    category: 'streak',
    titleSc: '七日恒心',
    titleTc: '七日恒心',
    descSc: '连续答题 7 日',
    descTc: '連續答題 7 日',
    test: countTest(7, (m) => m.streak.longest),
  },
  {
    id: 'streak_30',
    category: 'streak',
    titleSc: '月度坚持',
    titleTc: '月度堅持',
    descSc: '连续答题 30 日',
    descTc: '連續答題 30 日',
    test: countTest(30, (m) => m.streak.longest),
  },

  // 正确率（需至少 50 道样本）
  {
    id: 'accuracy_80',
    category: 'accuracy',
    titleSc: '闻思明朗',
    titleTc: '聞思明朗',
    descSc: '累计 50 题且正确率 ≥ 80%',
    descTc: '累計 50 題且正確率 ≥ 80%',
    test: (m) => {
      const qualified = m.totalAnswers >= 50 && m.correctRate >= 0.8;
      return {
        unlocked: qualified,
        progress: clamp01(Math.min(m.totalAnswers / 50, m.correctRate / 0.8)),
        current: Math.round(m.correctRate * 100),
        target: 80,
      };
    },
  },
  {
    id: 'accuracy_95',
    category: 'accuracy',
    titleSc: '慧眼如炬',
    titleTc: '慧眼如炬',
    descSc: '累计 100 题且正确率 ≥ 95%',
    descTc: '累計 100 題且正確率 ≥ 95%',
    test: (m) => {
      const qualified = m.totalAnswers >= 100 && m.correctRate >= 0.95;
      return {
        unlocked: qualified,
        progress: clamp01(Math.min(m.totalAnswers / 100, m.correctRate / 0.95)),
        current: Math.round(m.correctRate * 100),
        target: 95,
      };
    },
  },

  // SM-2 熟记
  {
    id: 'sm2_10_mastered',
    category: 'mastery',
    titleSc: '十卡熟记',
    titleTc: '十卡熟記',
    descSc: 'SM-2 已掌握 10 张',
    descTc: 'SM-2 已掌握 10 張',
    test: countTest(10, (m) => m.sm2.mastered),
  },
  {
    id: 'sm2_100_mastered',
    category: 'mastery',
    titleSc: '百卡通达',
    titleTc: '百卡通達',
    descSc: 'SM-2 已掌握 100 张',
    descTc: 'SM-2 已掌握 100 張',
    test: countTest(100, (m) => m.sm2.mastered),
  },

  // 广度
  {
    id: 'first_course',
    category: 'breadth',
    titleSc: '法本初学',
    titleTc: '法本初學',
    descSc: '在 1 门法本中答过题',
    descTc: '在 1 門法本中答過題',
    test: countTest(1, (m) => m.byCourse.length),
  },
  {
    id: 'three_courses',
    category: 'breadth',
    titleSc: '三藏广闻',
    titleTc: '三藏廣聞',
    descSc: '在 3 门法本中答过题',
    descTc: '在 3 門法本中答過題',
    test: countTest(3, (m) => m.byCourse.length),
  },
];

export interface BadgeStatus {
  id: string;
  category: BadgeCategory;
  titleSc: string;
  titleTc: string;
  descSc: string;
  descTc: string;
  unlocked: boolean;
  progress: number;
  current: number;
  target: number;
}

export interface AchievementsResp {
  totalBadges: number;
  unlockedCount: number;
  badges: BadgeStatus[];
  metrics: {
    totalAnswers: number;
    correctRate: number;
    streakCurrent: number;
    streakLongest: number;
    sm2Mastered: number;
    coursesCovered: number;
  };
}

export async function getAchievements(userId: string): Promise<AchievementsResp> {
  const m = await myProgress(userId);
  const badges: BadgeStatus[] = BADGES.map((b) => {
    const r = b.test(m);
    return {
      id: b.id,
      category: b.category,
      titleSc: b.titleSc,
      titleTc: b.titleTc,
      descSc: b.descSc,
      descTc: b.descTc,
      unlocked: r.unlocked,
      progress: r.progress,
      current: r.current,
      target: r.target,
    };
  });
  return {
    totalBadges: badges.length,
    unlockedCount: badges.filter((b) => b.unlocked).length,
    badges,
    metrics: {
      totalAnswers: m.totalAnswers,
      correctRate: m.correctRate,
      streakCurrent: m.streak.current,
      streakLongest: m.streak.longest,
      sm2Mastered: m.sm2.mastered,
      coursesCovered: m.byCourse.length,
    },
  };
}
