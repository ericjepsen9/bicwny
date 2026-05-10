// 藏历 2026 · 静态数据
//   - 数据来源：藏历日历图（admin 上传 · Claude 读图提取）
//   - 字段语义见 src/modules/tibetan/types.ts 与 schema.prisma TibetanDay
//   - idempotent upsert by date
//
// ⚠️ 当前为脚手架 · DAYS 仅含示例数据 · 完整 365 条待用户补图后填入
import type { Prisma, PrismaClient } from '@prisma/client';

type TibetanTag = '十斋日' | '飞幡日' | '八吉同聚' | '九凶同聚';

interface DaySpec {
  date: string; // 'YYYY-MM-DD'
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary?: boolean;
  tags?: TibetanTag[];
  auspicious?: boolean;
  events?: string[];
  publicHoliday?: string | null;
}

// 示例数据 · 待补全（用户重发图后统一替换）
export const DAYS: DaySpec[] = [
  // 2026 年 4 月（示例 · 占位）
  // {
  //   date: '2026-04-12',
  //   lunar: '二月廿五',
  //   tibetan: '二月廿四',
  //   tibetanMonth: '萨嘎月',
  //   tags: ['十斋日'],
  //   auspicious: true,
  //   events: ['释迦牟尼佛圣诞'],
  // },
];

export async function seedTibetan2026(prisma: PrismaClient) {
  if (DAYS.length === 0) {
    console.log('  · TibetanDay: 空数据集 · 跳过');
    return;
  }
  let upserts = 0;
  for (const d of DAYS) {
    const date = new Date(`${d.date}T00:00:00.000Z`);
    const data = {
      lunar: d.lunar,
      tibetan: d.tibetan,
      tibetanMonth: d.tibetanMonth,
      isIntercalary: d.isIntercalary ?? false,
      tags: (d.tags ?? []) as Prisma.InputJsonValue,
      auspicious: d.auspicious ?? false,
      events: (d.events ?? []) as Prisma.InputJsonValue,
      publicHoliday: d.publicHoliday ?? null,
    };
    await prisma.tibetanDay.upsert({
      where: { date },
      create: { date, ...data },
      update: data,
    });
    upserts += 1;
  }
  console.log(`  · TibetanDay: ${upserts} 天 upsert 完成`);
}
