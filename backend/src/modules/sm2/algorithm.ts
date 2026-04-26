// SM-2 算法（Wozniak 1990 简化版）
// 纯函数，不触 DB，便于单测。
// UI 采用四档自评 0-3 映射到经典 SM-2 的 quality 0-5。
import type { Sm2Status } from '@prisma/client';

export type Sm2Rating = 0 | 1 | 2 | 3;
//   0 = 重来 (Again, 未记住)
//   1 = 困难 (Hard)
//   2 = 良好 (Good)
//   3 = 简单 (Easy)

const QUALITY_MAP: Record<Sm2Rating, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };

export interface Sm2State {
  easeFactor: number;
  interval: number; // 天
  repetitions: number;
  status: Sm2Status;
}

export const INITIAL_STATE: Sm2State = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  status: 'new',
};

export interface Sm2Update extends Sm2State {
  dueDate: Date;
  lastRating: number;
}

/** 根据本次自评计算下次复习状态。 */
export function nextReview(
  prev: Sm2State,
  rating: Sm2Rating,
  now: Date = new Date(),
): Sm2Update {
  const q = QUALITY_MAP[rating];
  let easeFactor = prev.easeFactor;
  let interval = prev.interval;
  let repetitions = prev.repetitions;

  // EF 更新（无论答对答错，均按 q 调整）
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  // interval / reps 更新
  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else if (repetitions === 0) {
    interval = 1;
    repetitions = 1;
  } else if (repetitions === 1) {
    interval = 6;
    repetitions = 2;
  } else {
    interval = Math.max(1, Math.round(interval * easeFactor));
    repetitions += 1;
  }

  const status: Sm2Status =
    q < 3
      ? 'learning'
      : interval >= 21 && rating >= 2
        ? 'mastered'
        : repetitions >= 2
          ? 'review'
          : 'learning';

  // dueDate 计算约定：interval × 24 h（UTC 时刻平移）
  // 不引入用户时区，由前端按 user.timezone 渲染日期/时段
  // 副作用：UTC+8 用户在本地 23:00 答题、interval=1 → 下次到期为本地次日 23:00，
  //   学员在次日早晨打开 App 看不到该题（视为偏严格）。
  // 若产品要求"次日任意时间皆到期" → 改为归一到下一个用户本地午夜，需要同时
  //   在 listDueCards 的查询里也按用户 timezone 算 lte 边界，侵入较大；
  //   现版本保持 UTC 平移，前端文案显示具体到期时段而非"明日"二字以避免误解。
  const dueDate = new Date(now);
  dueDate.setUTCDate(dueDate.getUTCDate() + interval);

  return { easeFactor, interval, repetitions, status, dueDate, lastRating: rating };
}
