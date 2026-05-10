// 藏历公共类型 · 与 Prisma TibetanDay 模型对齐
export type TibetanTag = '十斋日' | '飞幡日' | '八吉同聚' | '九凶同聚';

export interface TibetanDayDto {
  date: string; // 'YYYY-MM-DD'
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: TibetanTag[];
  auspicious: boolean;
  events: string[];
  publicHoliday: string | null;
}
