// 藏历 2026 · 静态数据（来源：藏历日历图 · Claude 读图录入）
//   - 藏历 12 个月名：庄严月(十一月) · 满意月(十二月) · 神变月(正月) · 苦行月(二月)
//     具香月(三月) · 作净月(四月) · 萨嘎月(五月) ……（其余月名待对应图后补）
//   - 字段语义见 src/modules/tibetan/types.ts 与 schema.prisma TibetanDay
//   - idempotent upsert by date
//   - 已录入：2026-01 ~ 2026-03（共 91 天）
import type { Prisma, PrismaClient } from '@prisma/client';

type TibetanTag = '十斋日' | '飞幡日' | '八吉同聚' | '九凶同聚';

interface DaySpec {
  date: string;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary?: boolean;
  tags?: TibetanTag[];
  auspicious?: boolean;
  events?: string[];
  publicHoliday?: string | null;
}

export const DAYS: DaySpec[] = [
  // ── 2026 年 1 月 · 般若 · 满意月（含 1-18 庄严月 · 19+ 满意月） ─────────────
  {
    date: '2026-01-01',
    lunar: '十一月十三', tibetan: '十一月十三', tibetanMonth: '庄严月',
    tags: ['八吉同聚'], auspicious: true,
    events: ['法王如意宝涅槃法会开始', '唐代高僧慈恩大师(窥基法师)圆寂纪念日(汉)', '理发吉日：精进于佛法修持，最上'],
    publicHoliday: '元旦',
  },
  {
    date: '2026-01-02',
    lunar: '十一月十四', tibetan: '十一月十四', tibetanMonth: '庄严月',
    tags: ['十斋日'], auspicious: true,
    events: ['法王如意宝涅槃法会', '萨迦班智达圆寂纪念日', '理发吉日：财物增多'],
  },
  {
    date: '2026-01-03',
    lunar: '十一月十五', tibetan: '十一月十五', tibetanMonth: '庄严月',
    tags: ['十斋日'], auspicious: true,
    events: ['法王如意宝涅槃法会', '阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
  },
  {
    date: '2026-01-04',
    lunar: '十一月十六', tibetan: '十一月十六', tibetanMonth: '庄严月',
    tags: ['飞幡日'],
    events: ['法王如意宝涅槃法会'],
  },
  {
    date: '2026-01-05',
    lunar: '十一月十七', tibetan: '十一月十七', tibetanMonth: '庄严月',
    auspicious: true,
    events: ['法王如意宝涅槃法会', '阿弥陀佛圣诞日(汉)', '净宗二祖善导法师圆寂日(汉)'],
    publicHoliday: '小寒',
  },
  {
    date: '2026-01-06',
    lunar: '十一月十八', tibetan: '十一月十八', tibetanMonth: '庄严月',
    tags: ['十斋日'], auspicious: true,
    events: ['法王如意宝涅槃法会', '观世音菩萨加持日,作何善恶成千万倍'],
  },
  {
    date: '2026-01-07',
    lunar: '十一月十九', tibetan: '十一月十九', tibetanMonth: '庄严月',
    auspicious: true,
    events: ['法王如意宝涅槃法会结束', '日光菩萨圣诞日(汉)', '理发吉日：增胜善法'],
  },
  {
    date: '2026-01-08',
    lunar: '十一月二十', tibetan: '十一月二十', tibetanMonth: '庄严月',
  },
  {
    date: '2026-01-09',
    lunar: '十一月廿一', tibetan: '十一月廿一', tibetanMonth: '庄严月',
    tags: ['九凶同聚'],
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-01-10',
    lunar: '十一月廿二', tibetan: '十一月廿二', tibetanMonth: '庄严月',
  },
  {
    date: '2026-01-11',
    lunar: '十一月廿三', tibetan: '十一月廿三', tibetanMonth: '庄严月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-01-12',
    lunar: '十一月廿四', tibetan: '十一月廿四', tibetanMonth: '庄严月',
    tags: ['十斋日'],
  },
  {
    date: '2026-01-13',
    lunar: '十一月廿五', tibetan: '十一月廿五', tibetanMonth: '庄严月',
    tags: ['八吉同聚'], auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-01-14',
    lunar: '十一月廿六', tibetan: '十一月廿六', tibetanMonth: '庄严月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-01-15',
    lunar: '十一月廿七', tibetan: '十一月廿七', tibetanMonth: '庄严月',
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-01-16',
    lunar: '十一月廿八', tibetan: '十一月廿八', tibetanMonth: '庄严月',
    tags: ['十斋日'],
  },
  {
    date: '2026-01-17',
    lunar: '十一月廿九', tibetan: '十一月廿九', tibetanMonth: '庄严月',
    tags: ['十斋日'],
  },
  {
    date: '2026-01-18',
    lunar: '十一月三十', tibetan: '十一月三十', tibetanMonth: '庄严月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-01-19',
    lunar: '十二月初一', tibetan: '十二月初一', tibetanMonth: '满意月',
    tags: ['十斋日', '飞幡日'], auspicious: true,
    events: ['禅定胜王佛加持日,作何善恶成百倍', '神变月(汉)'],
    publicHoliday: '大寒',
  },
  {
    date: '2026-01-20',
    lunar: '十二月初二', tibetan: '十二月初二', tibetanMonth: '满意月',
    auspicious: true,
    events: ['门措上师诞生日'],
  },
  {
    date: '2026-01-21',
    lunar: '十二月初三', tibetan: '十二月初三', tibetanMonth: '满意月',
    events: ['理发吉日：家族增长财富'],
  },
  {
    date: '2026-01-22',
    lunar: '十二月初四', tibetan: '十二月初四', tibetanMonth: '满意月',
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-01-23',
    lunar: '十二月初五', tibetan: '十二月初五', tibetanMonth: '满意月',
    events: ['理发吉日：聚集广大财富'],
  },
  {
    date: '2026-01-24',
    lunar: '十二月初六', tibetan: '十二月初六', tibetanMonth: '满意月',
  },
  {
    date: '2026-01-25',
    lunar: '十二月初七', tibetan: '十二月初七', tibetanMonth: '满意月',
  },
  {
    date: '2026-01-26',
    lunar: '十二月初八', tibetan: '十二月初八', tibetanMonth: '满意月',
    tags: ['八吉同聚', '十斋日'], auspicious: true,
    events: ['药师佛加持日,作何善恶成千倍', '释迦牟尼佛成道日(汉)', '理发吉日：长寿'],
    publicHoliday: '腊八节',
  },
  {
    date: '2026-01-27',
    lunar: '十二月初九', tibetan: '十二月初九', tibetanMonth: '满意月',
    events: ['理发吉日：易遇佳人'],
  },
  {
    date: '2026-01-28',
    lunar: '十二月初十', tibetan: '十二月初十', tibetanMonth: '满意月',
    auspicious: true,
    events: ['莲师荟供日,作何善恶成十万', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-01-29',
    lunar: '十二月十一', tibetan: '十二月十一', tibetanMonth: '满意月',
    events: ['理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-01-30',
    lunar: '十二月十二', tibetan: '十二月十二', tibetanMonth: '满意月',
  },
  {
    date: '2026-01-31',
    lunar: '十二月十三', tibetan: '十二月十三', tibetanMonth: '满意月',
    events: ['理发吉日：财物增多'],
  },

  // ── 2026 年 2 月 · 精进闻思 · 满意月 / 神变月（2/18 藏历新年起） ───────────
  {
    date: '2026-02-01',
    lunar: '十二月十四', tibetan: '十二月十五', tibetanMonth: '满意月',
    tags: ['十斋日'], auspicious: true,
    events: ['阿弥陀佛加持日,作何善恶成百万倍', '格萨尔王诞辰纪念日', '理发吉日：福报增上'],
  },
  {
    date: '2026-02-02',
    lunar: '十二月十五', tibetan: '十二月十六', tibetanMonth: '满意月',
    tags: ['十斋日'],
  },
  {
    date: '2026-02-03',
    lunar: '十二月十六', tibetan: '十二月十七', tibetanMonth: '满意月',
  },
  {
    date: '2026-02-04',
    lunar: '十二月十七', tibetan: '十二月十八', tibetanMonth: '满意月',
    auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍', '全知龙钦巴(无垢光)尊者圆寂纪念日', '晋美林巴尊者诞生纪念日'],
    publicHoliday: '立春',
  },
  {
    date: '2026-02-05',
    lunar: '十二月十八', tibetan: '十二月十九', tibetanMonth: '满意月',
    tags: ['九凶同聚', '十斋日'],
    events: ['理发吉日：增胜善法'],
  },
  {
    date: '2026-02-06',
    lunar: '十二月十九', tibetan: '十二月二十', tibetanMonth: '满意月',
    tags: ['八吉同聚'],
  },
  {
    date: '2026-02-07',
    lunar: '十二月二十', tibetan: '十二月廿一', tibetanMonth: '满意月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-02-08',
    lunar: '十二月廿一', tibetan: '十二月廿二', tibetanMonth: '满意月',
  },
  {
    date: '2026-02-09',
    lunar: '十二月廿二', tibetan: '十二月廿三', tibetanMonth: '满意月',
    auspicious: true,
    events: ['文殊菩萨成道日(汉)', '理发吉日：增上财富'],
  },
  {
    date: '2026-02-10',
    lunar: '十二月廿三', tibetan: '十二月廿四', tibetanMonth: '满意月',
    tags: ['十斋日'],
    events: ['监斋菩萨圣诞日(汉)'],
    publicHoliday: '北小年',
  },
  {
    date: '2026-02-11',
    lunar: '十二月廿四', tibetan: '十二月闰廿五', tibetanMonth: '满意月',
    isIntercalary: true,
    tags: ['十斋日'],
    events: ['空行母荟供日,作何善恶成十万倍'],
    publicHoliday: '南小年',
  },
  {
    date: '2026-02-12',
    lunar: '十二月廿五', tibetan: '十二月廿五', tibetanMonth: '满意月',
  },
  {
    date: '2026-02-13',
    lunar: '十二月廿六', tibetan: '十二月廿六', tibetanMonth: '满意月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-02-14',
    lunar: '十二月廿七', tibetan: '十二月廿七', tibetanMonth: '满意月',
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-02-15',
    lunar: '十二月廿八', tibetan: '十二月廿八', tibetanMonth: '满意月',
    tags: ['十斋日'],
  },
  {
    date: '2026-02-16',
    lunar: '十二月廿九', tibetan: '十二月廿九', tibetanMonth: '满意月',
    tags: ['十斋日'], auspicious: true,
    events: ['华严菩萨圣诞日(汉)'],
    publicHoliday: '除夕',
  },
  {
    date: '2026-02-17',
    lunar: '正月初一', tibetan: '十二月三十', tibetanMonth: '满意月',
    auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍', '日环食,食甚20点13分', '弥勒菩萨圣诞日(汉)'],
    publicHoliday: '春节',
  },
  {
    date: '2026-02-18',
    lunar: '正月初二', tibetan: '正月初一', tibetanMonth: '神变月',
    auspicious: true,
    events: ['持明法会开始', '禅定胜王佛加持日,作何善恶成百倍'],
    publicHoliday: '藏历新年·雨水',
  },
  {
    date: '2026-02-19',
    lunar: '正月初三', tibetan: '正月初二', tibetanMonth: '神变月',
    events: ['持明法会'],
  },
  {
    date: '2026-02-20',
    lunar: '正月初四', tibetan: '正月初三', tibetanMonth: '神变月',
    tags: ['八吉同聚'], auspicious: true,
    events: ['圣者法王如意宝圣诞纪念日', '理发吉日：家族增长财富'],
  },
  {
    date: '2026-02-21',
    lunar: '正月初五', tibetan: '正月初四', tibetanMonth: '神变月',
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-02-22',
    lunar: '正月初六', tibetan: '正月初五', tibetanMonth: '神变月',
    events: ['定光佛圣诞日(汉)', '理发吉日：聚集广大财富'],
  },
  {
    date: '2026-02-23',
    lunar: '正月初七', tibetan: '正月初六', tibetanMonth: '神变月',
    events: ['持明法会'],
  },
  {
    date: '2026-02-24',
    lunar: '正月初八', tibetan: '正月初七', tibetanMonth: '神变月',
    tags: ['十斋日'], auspicious: true,
    events: ['持明法会', '药师佛加持日,作何善恶成千倍', '理发吉日：长寿'],
  },
  {
    date: '2026-02-25',
    lunar: '正月初九', tibetan: '正月初八', tibetanMonth: '神变月',
    events: ['持明法会'],
  },
  {
    date: '2026-02-26',
    lunar: '正月初十', tibetan: '正月初九', tibetanMonth: '神变月',
    auspicious: true,
    events: ['持明法会', '莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-02-27',
    lunar: '正月十一', tibetan: '正月初十', tibetanMonth: '神变月',
    tags: ['飞幡日'],
    events: ['持明法会', '理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-02-28',
    lunar: '正月十二', tibetan: '正月十一', tibetanMonth: '神变月',
    events: ['持明法会'],
  },

  // ── 2026 年 3 月 · ༀ་ཨ་ར་པ་ཙ་ན་དྷཱིཿ · 神变月 / 苦行月（3/19 起苦行月） ─────
  {
    date: '2026-03-01',
    lunar: '正月十三', tibetan: '正月十三', tibetanMonth: '神变月',
    tags: ['九凶同聚'],
    events: ['持明法会', '理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-03-02',
    lunar: '正月十四', tibetan: '正月十四', tibetanMonth: '神变月',
    tags: ['十斋日'], auspicious: true,
    events: ['持明法会', '米拉日巴尊者圆寂纪念日', '理发吉日：财物增多'],
  },
  {
    date: '2026-03-03',
    lunar: '正月十五', tibetan: '正月十五', tibetanMonth: '神变月',
    tags: ['八吉同聚', '十斋日'], auspicious: true,
    events: ['神变日', '持明法会', '阿弥陀佛加持日,作何善恶成百万倍', '月全食,初亏17点49分,复圆21点17分', '理发吉日：福报增上'],
  },
  {
    date: '2026-03-04',
    lunar: '正月十六', tibetan: '正月十六', tibetanMonth: '神变月',
    auspicious: true,
    events: ['持明法会结束'],
  },
  {
    date: '2026-03-05',
    lunar: '正月十七', tibetan: '正月十七', tibetanMonth: '神变月',
    publicHoliday: '惊蛰',
  },
  {
    date: '2026-03-06',
    lunar: '正月十八', tibetan: '正月十八', tibetanMonth: '神变月',
    tags: ['十斋日'], auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
  },
  {
    date: '2026-03-07',
    lunar: '正月十九', tibetan: '正月十九', tibetanMonth: '神变月',
    events: ['理发吉日：增胜善法'],
  },
  {
    date: '2026-03-08',
    lunar: '正月二十', tibetan: '正月二十', tibetanMonth: '神变月',
    publicHoliday: '妇女节',
  },
  {
    date: '2026-03-09',
    lunar: '正月廿一', tibetan: '正月廿一', tibetanMonth: '神变月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-03-10',
    lunar: '正月廿二', tibetan: '正月廿二', tibetanMonth: '神变月',
    tags: ['飞幡日'],
  },
  {
    date: '2026-03-11',
    lunar: '正月廿三', tibetan: '正月廿三', tibetanMonth: '神变月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-03-12',
    lunar: '正月廿四', tibetan: '正月廿四', tibetanMonth: '神变月',
    publicHoliday: '植树节',
  },
  {
    date: '2026-03-13',
    lunar: '正月廿五', tibetan: '正月廿五', tibetanMonth: '神变月',
    auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-03-14',
    lunar: '正月廿六', tibetan: '正月廿六', tibetanMonth: '神变月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-03-15',
    lunar: '正月廿七', tibetan: '正月廿七', tibetanMonth: '神变月',
    tags: ['八吉同聚'],
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-03-16',
    lunar: '正月廿八', tibetan: '正月廿八', tibetanMonth: '神变月',
    tags: ['十斋日'],
  },
  {
    date: '2026-03-17',
    lunar: '正月廿九', tibetan: '正月廿九', tibetanMonth: '神变月',
    tags: ['十斋日'],
  },
  {
    date: '2026-03-18',
    lunar: '正月三十', tibetan: '正月三十', tibetanMonth: '神变月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-03-19',
    lunar: '二月初一', tibetan: '二月初一', tibetanMonth: '苦行月',
    tags: ['十斋日'], auspicious: true,
    events: ['禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-03-20',
    lunar: '二月初二', tibetan: '二月初二', tibetanMonth: '苦行月',
    publicHoliday: '龙抬头',
  },
  {
    date: '2026-03-21',
    lunar: '二月初三', tibetan: '二月初三', tibetanMonth: '苦行月',
    events: ['理发吉日：家族增长财富'],
  },
  {
    date: '2026-03-22',
    lunar: '二月初四', tibetan: '二月初四', tibetanMonth: '苦行月',
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-03-23',
    lunar: '二月初五', tibetan: '二月初五', tibetanMonth: '苦行月',
    auspicious: true,
    events: ['玄奘法师圆寂日(汉)', '理发吉日：聚集广大财富'],
  },
  {
    date: '2026-03-24',
    lunar: '二月初六', tibetan: '二月初六', tibetanMonth: '苦行月',
  },
  {
    date: '2026-03-25',
    lunar: '二月初七', tibetan: '二月初七', tibetanMonth: '苦行月',
    tags: ['飞幡日'],
    events: ['长寿法会开始'],
  },
  {
    date: '2026-03-26',
    lunar: '二月初八', tibetan: '二月初八', tibetanMonth: '苦行月',
    tags: ['十斋日'], auspicious: true,
    events: ['长寿法会', '药师佛加持日,作何善恶成千倍', '释迦牟尼佛出家日(汉)', '迦安法师圆寂日(汉)', '理发吉日：长寿'],
  },
  {
    date: '2026-03-27',
    lunar: '二月初九', tibetan: '二月初九', tibetanMonth: '苦行月',
    events: ['长寿法会', '理发吉日：易遇佳人'],
  },
  {
    date: '2026-03-28',
    lunar: '二月初十', tibetan: '二月初十', tibetanMonth: '苦行月',
    tags: ['八吉同聚'], auspicious: true,
    events: ['长寿法会结束', '莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-03-29',
    lunar: '二月十一', tibetan: '二月十一', tibetanMonth: '苦行月',
    tags: ['九凶同聚'],
    events: ['理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-03-30',
    lunar: '二月十二', tibetan: '二月十三', tibetanMonth: '苦行月',
    events: ['理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-03-31',
    lunar: '二月十三', tibetan: '二月十四', tibetanMonth: '苦行月',
    events: ['理发吉日：财物增多'],
  },
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
