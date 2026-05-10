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

  // ── 2026 年 4 月 · 禅心 · 苦行月(1-17) / 具香月(18+) ──────────────────────
  {
    date: '2026-04-01',
    lunar: '二月十四', tibetan: '二月十五', tibetanMonth: '苦行月',
    tags: ['十斋日'], auspicious: true,
    events: ['阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
  },
  {
    date: '2026-04-02',
    lunar: '二月十五', tibetan: '二月十六', tibetanMonth: '苦行月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛涅槃日(汉)'],
  },
  {
    date: '2026-04-03',
    lunar: '二月十六', tibetan: '二月十七', tibetanMonth: '苦行月',
  },
  {
    date: '2026-04-04',
    lunar: '二月十七', tibetan: '二月闰十七', tibetanMonth: '苦行月',
    isIntercalary: true,
  },
  {
    date: '2026-04-05',
    lunar: '二月十八', tibetan: '二月十八', tibetanMonth: '苦行月',
    tags: ['十斋日'], auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
    publicHoliday: '清明节',
  },
  {
    date: '2026-04-06',
    lunar: '二月十九', tibetan: '二月十九', tibetanMonth: '苦行月',
    tags: ['飞幡日'], auspicious: true,
    events: ['观世音菩萨圣诞日(汉)', '理发吉日：增胜善法'],
  },
  {
    date: '2026-04-07',
    lunar: '二月二十', tibetan: '二月二十', tibetanMonth: '苦行月',
  },
  {
    date: '2026-04-08',
    lunar: '二月廿一', tibetan: '二月廿一', tibetanMonth: '苦行月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍', '普贤菩萨圣诞日(汉)'],
  },
  {
    date: '2026-04-09',
    lunar: '二月廿二', tibetan: '二月廿二', tibetanMonth: '苦行月',
    tags: ['八吉同聚'],
  },
  {
    date: '2026-04-10',
    lunar: '二月廿三', tibetan: '二月廿三', tibetanMonth: '苦行月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-04-11',
    lunar: '二月廿四', tibetan: '二月廿四', tibetanMonth: '苦行月',
    tags: ['十斋日'],
  },
  {
    date: '2026-04-12',
    lunar: '二月廿五', tibetan: '二月廿五', tibetanMonth: '苦行月',
    auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-04-13',
    lunar: '二月廿六', tibetan: '二月廿六', tibetanMonth: '苦行月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-04-14',
    lunar: '二月廿七', tibetan: '二月廿七', tibetanMonth: '苦行月',
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-04-15',
    lunar: '二月廿八', tibetan: '二月廿八', tibetanMonth: '苦行月',
    tags: ['十斋日'],
  },
  {
    date: '2026-04-16',
    lunar: '二月廿九', tibetan: '二月廿九', tibetanMonth: '苦行月',
    tags: ['十斋日'],
  },
  {
    date: '2026-04-17',
    lunar: '三月初一', tibetan: '二月三十', tibetanMonth: '苦行月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-04-18',
    lunar: '三月初二', tibetan: '三月初一', tibetanMonth: '具香月',
    auspicious: true,
    events: ['时轮金刚新年', '禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-04-19',
    lunar: '三月初三', tibetan: '三月初二', tibetanMonth: '具香月',
    auspicious: true,
    events: ['布袋和尚坐化日(汉)'],
  },
  {
    date: '2026-04-20',
    lunar: '三月初四', tibetan: '三月初三', tibetanMonth: '具香月',
    events: ['理发吉日：家族增长财富'],
    publicHoliday: '谷雨',
  },
  {
    date: '2026-04-21',
    lunar: '三月初五', tibetan: '三月初四', tibetanMonth: '具香月',
    tags: ['飞幡日'],
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-04-22',
    lunar: '三月初六', tibetan: '三月初六', tibetanMonth: '具香月',
  },
  {
    date: '2026-04-23',
    lunar: '三月初七', tibetan: '三月初七', tibetanMonth: '具香月',
  },
  {
    date: '2026-04-24',
    lunar: '三月初八', tibetan: '三月初八', tibetanMonth: '具香月',
    tags: ['十斋日'], auspicious: true,
    events: ['药师佛加持日,作何善恶成千倍', '理发吉日：长寿'],
  },
  {
    date: '2026-04-25',
    lunar: '三月初九', tibetan: '三月初九', tibetanMonth: '具香月',
    tags: ['九凶同聚'],
    events: ['理发吉日：易遇佳人'],
  },
  {
    date: '2026-04-26',
    lunar: '三月初十', tibetan: '三月初十', tibetanMonth: '具香月',
    auspicious: true,
    events: ['莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-04-27',
    lunar: '三月十一', tibetan: '三月十一', tibetanMonth: '具香月',
    events: ['理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-04-28',
    lunar: '三月十二', tibetan: '三月十二', tibetanMonth: '具香月',
  },
  {
    date: '2026-04-29',
    lunar: '三月十三', tibetan: '三月十三', tibetanMonth: '具香月',
    events: ['理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-04-30',
    lunar: '三月十四', tibetan: '三月十四', tibetanMonth: '具香月',
    tags: ['十斋日'],
    events: ['理发吉日：财物增多'],
  },

  // ── 2026 年 5 月 · 自在 · 具香月(1-16) / 萨嘎月(17+) ──────────────────────
  {
    date: '2026-05-01',
    lunar: '三月十五', tibetan: '三月十五', tibetanMonth: '具香月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛转时轮金刚法轮', '阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
    publicHoliday: '劳动节',
  },
  {
    date: '2026-05-02',
    lunar: '三月十六', tibetan: '三月十六', tibetanMonth: '具香月',
    tags: ['飞幡日'], auspicious: true,
    events: ['准提菩萨圣诞日(汉)', '禅宗二祖慧可大师圆寂日(汉)'],
  },
  {
    date: '2026-05-03',
    lunar: '三月十七', tibetan: '三月十七', tibetanMonth: '具香月',
    tags: ['八吉同聚'],
  },
  {
    date: '2026-05-04',
    lunar: '三月十八', tibetan: '三月十八', tibetanMonth: '具香月',
    tags: ['十斋日'], auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
    publicHoliday: '青年节',
  },
  {
    date: '2026-05-05',
    lunar: '三月十九', tibetan: '三月十九', tibetanMonth: '具香月',
    events: ['理发吉日：增胜善法'],
    publicHoliday: '立夏',
  },
  {
    date: '2026-05-06',
    lunar: '三月二十', tibetan: '三月二十', tibetanMonth: '具香月',
  },
  {
    date: '2026-05-07',
    lunar: '三月廿一', tibetan: '三月廿一', tibetanMonth: '具香月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-05-08',
    lunar: '三月廿二', tibetan: '三月廿二', tibetanMonth: '具香月',
  },
  {
    date: '2026-05-09',
    lunar: '三月廿三', tibetan: '三月闰廿二', tibetanMonth: '具香月',
    isIntercalary: true,
    tags: ['十斋日'],
  },
  {
    date: '2026-05-10',
    lunar: '三月廿四', tibetan: '三月廿三', tibetanMonth: '具香月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
    publicHoliday: '母亲节',
  },
  {
    date: '2026-05-11',
    lunar: '三月廿五', tibetan: '三月廿四', tibetanMonth: '具香月',
  },
  {
    date: '2026-05-12',
    lunar: '三月廿六', tibetan: '三月廿五', tibetanMonth: '具香月',
    auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-05-13',
    lunar: '三月廿七', tibetan: '三月廿六', tibetanMonth: '具香月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-05-14',
    lunar: '三月廿八', tibetan: '三月廿七', tibetanMonth: '具香月',
    tags: ['十斋日'],
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-05-15',
    lunar: '三月廿九', tibetan: '三月廿八', tibetanMonth: '具香月',
    tags: ['十斋日'],
  },
  {
    date: '2026-05-16',
    lunar: '三月三十', tibetan: '三月三十', tibetanMonth: '具香月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-05-17',
    lunar: '四月初一', tibetan: '四月初一', tibetanMonth: '萨嘎月',
    tags: ['十斋日', '飞幡日'], auspicious: true,
    events: ['禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-05-18',
    lunar: '四月初二', tibetan: '四月初二', tibetanMonth: '萨嘎月',
  },
  {
    date: '2026-05-19',
    lunar: '四月初三', tibetan: '四月初三', tibetanMonth: '萨嘎月',
    events: ['理发吉日：家族增长财富'],
  },
  {
    date: '2026-05-20',
    lunar: '四月初四', tibetan: '四月初四', tibetanMonth: '萨嘎月',
    auspicious: true,
    events: ['文殊菩萨圣诞日(汉)', '理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-05-21',
    lunar: '四月初五', tibetan: '四月初五', tibetanMonth: '萨嘎月',
    events: ['理发吉日：聚集广大财富'],
    publicHoliday: '小满',
  },
  {
    date: '2026-05-22',
    lunar: '四月初六', tibetan: '四月初六', tibetanMonth: '萨嘎月',
  },
  {
    date: '2026-05-23',
    lunar: '四月初七', tibetan: '四月初七', tibetanMonth: '萨嘎月',
    tags: ['九凶同聚'], auspicious: true,
  },
  {
    date: '2026-05-24',
    lunar: '四月初八', tibetan: '四月初八', tibetanMonth: '萨嘎月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛诞辰日', '金刚萨埵法会开始', '药师佛加持日,作何善恶成千倍', '释迦牟尼佛圣诞日(汉)', '道宣律师诞辰日(汉)', '理发吉日：长寿'],
    publicHoliday: '浴佛节',
  },
  {
    date: '2026-05-25',
    lunar: '四月初九', tibetan: '四月初九', tibetanMonth: '萨嘎月',
    events: ['金刚萨埵法会', '理发吉日：易遇佳人'],
  },
  {
    date: '2026-05-26',
    lunar: '四月初十', tibetan: '四月初十', tibetanMonth: '萨嘎月',
    auspicious: true,
    events: ['金刚萨埵法会', '莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-05-27',
    lunar: '四月十一', tibetan: '四月十一', tibetanMonth: '萨嘎月',
    events: ['金刚萨埵法会', '理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-05-28',
    lunar: '四月十二', tibetan: '四月十二', tibetanMonth: '萨嘎月',
    tags: ['八吉同聚'],
    events: ['金刚萨埵法会'],
  },
  {
    date: '2026-05-29',
    lunar: '四月十三', tibetan: '四月十三', tibetanMonth: '萨嘎月',
    tags: ['飞幡日'], auspicious: true,
    events: ['金刚萨埵法会', '理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-05-30',
    lunar: '四月十四', tibetan: '四月十四', tibetanMonth: '萨嘎月',
    tags: ['十斋日'],
    events: ['金刚萨埵法会结束', '理发吉日：财物增多'],
  },
  {
    date: '2026-05-31',
    lunar: '四月十五', tibetan: '四月十五', tibetanMonth: '萨嘎月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛成道日涅槃日,作何善恶成百万倍', '阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
    publicHoliday: '卫塞节',
  },

  // ── 2026 年 6 月 · 利他 · 萨嘎月(1-15) / 作净月(16+) ──────────────────────
  {
    date: '2026-06-01',
    lunar: '四月十六', tibetan: '四月十六', tibetanMonth: '萨嘎月',
    publicHoliday: '儿童节',
  },
  {
    date: '2026-06-02',
    lunar: '四月十七', tibetan: '四月十七', tibetanMonth: '萨嘎月',
  },
  {
    date: '2026-06-03',
    lunar: '四月十八', tibetan: '四月十八', tibetanMonth: '萨嘎月',
    tags: ['十斋日'], auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
  },
  {
    date: '2026-06-04',
    lunar: '四月十九', tibetan: '四月十九', tibetanMonth: '萨嘎月',
    events: ['理发吉日：增胜善法'],
  },
  {
    date: '2026-06-05',
    lunar: '四月二十', tibetan: '四月二十', tibetanMonth: '萨嘎月',
  },
  {
    date: '2026-06-06',
    lunar: '四月廿一', tibetan: '四月廿一', tibetanMonth: '萨嘎月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-06-07',
    lunar: '四月廿二', tibetan: '四月廿二', tibetanMonth: '萨嘎月',
  },
  {
    date: '2026-06-08',
    lunar: '四月廿三', tibetan: '四月廿三', tibetanMonth: '萨嘎月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-06-09',
    lunar: '四月廿四', tibetan: '四月廿四', tibetanMonth: '萨嘎月',
    tags: ['八吉同聚', '十斋日'],
  },
  {
    date: '2026-06-10',
    lunar: '四月廿五', tibetan: '四月廿五', tibetanMonth: '萨嘎月',
    auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-06-11',
    lunar: '四月廿六', tibetan: '四月廿六', tibetanMonth: '萨嘎月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-06-12',
    lunar: '四月廿七', tibetan: '四月廿七', tibetanMonth: '萨嘎月',
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-06-13',
    lunar: '四月廿八', tibetan: '四月廿八', tibetanMonth: '萨嘎月',
    tags: ['十斋日'], auspicious: true,
    events: ['药王菩萨圣诞日(汉)'],
  },
  {
    date: '2026-06-14',
    lunar: '四月廿九', tibetan: '四月廿九', tibetanMonth: '萨嘎月',
    tags: ['十斋日'], auspicious: true,
    events: ['全知麦彭尊者圆寂纪念日'],
  },
  {
    date: '2026-06-15',
    lunar: '五月初一', tibetan: '四月三十', tibetanMonth: '萨嘎月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-06-16',
    lunar: '五月初二', tibetan: '五月初一', tibetanMonth: '作净月',
    auspicious: true,
    events: ['禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-06-17',
    lunar: '五月初三', tibetan: '五月初三', tibetanMonth: '作净月',
    events: ['理发吉日：家族增长财富'],
  },
  {
    date: '2026-06-18',
    lunar: '五月初四', tibetan: '五月初四', tibetanMonth: '作净月',
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-06-19',
    lunar: '五月初五', tibetan: '五月初五', tibetanMonth: '作净月',
    tags: ['九凶同聚'],
    events: ['理发吉日：聚集广大财富'],
    publicHoliday: '端午节',
  },
  {
    date: '2026-06-20',
    lunar: '五月初六', tibetan: '五月初六', tibetanMonth: '作净月',
  },
  {
    date: '2026-06-21',
    lunar: '五月初七', tibetan: '五月初七', tibetanMonth: '作净月',
    tags: ['八吉同聚'],
    publicHoliday: '夏至·父亲节',
  },
  {
    date: '2026-06-22',
    lunar: '五月初八', tibetan: '五月初八', tibetanMonth: '作净月',
    tags: ['十斋日'], auspicious: true,
    events: ['药师佛加持日,作何善恶成千倍', '理发吉日：长寿'],
  },
  {
    date: '2026-06-23',
    lunar: '五月初九', tibetan: '五月初九', tibetanMonth: '作净月',
    events: ['理发吉日：易遇佳人'],
  },
  {
    date: '2026-06-24',
    lunar: '五月初十', tibetan: '五月初十', tibetanMonth: '作净月',
    tags: ['飞幡日'], auspicious: true,
    events: ['莲花生大师诞辰日', '莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-06-25',
    lunar: '五月十一', tibetan: '五月十一', tibetanMonth: '作净月',
    events: ['理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-06-26',
    lunar: '五月十二', tibetan: '五月十二', tibetanMonth: '作净月',
  },
  {
    date: '2026-06-27',
    lunar: '五月十三', tibetan: '五月十三', tibetanMonth: '作净月',
    auspicious: true,
    events: ['伽蓝菩萨圣诞日(汉)', '理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-06-28',
    lunar: '五月十四', tibetan: '五月十四', tibetanMonth: '作净月',
    tags: ['十斋日'],
    events: ['理发吉日：财物增多'],
  },
  {
    date: '2026-06-29',
    lunar: '五月十五', tibetan: '五月十五', tibetanMonth: '作净月',
    tags: ['十斋日'], auspicious: true,
    events: ['阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
  },
  {
    date: '2026-06-30',
    lunar: '五月十六', tibetan: '五月十六', tibetanMonth: '作净月',
  },

  // ── 2026 年 7 月 · 一日为师终身为父 · 作净月(1-14) / 明净月(15+) ────────────
  {
    date: '2026-07-01',
    lunar: '五月十七', tibetan: '五月十七', tibetanMonth: '作净月',
  },
  {
    date: '2026-07-02',
    lunar: '五月十八', tibetan: '五月闰十七', tibetanMonth: '作净月',
    isIntercalary: true,
    tags: ['十斋日'],
  },
  {
    date: '2026-07-03',
    lunar: '五月十九', tibetan: '五月十八', tibetanMonth: '作净月',
    auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
  },
  {
    date: '2026-07-04',
    lunar: '五月二十', tibetan: '五月十九', tibetanMonth: '作净月',
    tags: ['八吉同聚'],
    events: ['理发吉日：增胜善法'],
  },
  {
    date: '2026-07-05',
    lunar: '五月廿一', tibetan: '五月二十', tibetanMonth: '作净月',
  },
  {
    date: '2026-07-06',
    lunar: '五月廿二', tibetan: '五月廿一', tibetanMonth: '作净月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-07-07',
    lunar: '五月廿三', tibetan: '五月廿二', tibetanMonth: '作净月',
    tags: ['十斋日', '飞幡日'], auspicious: true,
    publicHoliday: '小暑',
  },
  {
    date: '2026-07-08',
    lunar: '五月廿四', tibetan: '五月廿三', tibetanMonth: '作净月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-07-09',
    lunar: '五月廿五', tibetan: '五月廿四', tibetanMonth: '作净月',
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-07-10',
    lunar: '五月廿六', tibetan: '五月廿六', tibetanMonth: '作净月',
    events: ['理发吉日：增上安乐'],
  },
  {
    date: '2026-07-11',
    lunar: '五月廿七', tibetan: '五月廿七', tibetanMonth: '作净月',
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-07-12',
    lunar: '五月廿八', tibetan: '五月廿八', tibetanMonth: '作净月',
    tags: ['十斋日'],
  },
  {
    date: '2026-07-13',
    lunar: '五月廿九', tibetan: '五月廿九', tibetanMonth: '作净月',
    tags: ['十斋日'],
  },
  {
    date: '2026-07-14',
    lunar: '六月初一', tibetan: '五月三十', tibetanMonth: '作净月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-07-15',
    lunar: '六月初二', tibetan: '六月初一', tibetanMonth: '明净月',
    auspicious: true,
    events: ['地藏法会开始', '禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-07-16',
    lunar: '六月初三', tibetan: '六月初二', tibetanMonth: '明净月',
    tags: ['八吉同聚'], auspicious: true,
    events: ['地藏法会', '韦驮菩萨圣诞日(汉)'],
  },
  {
    date: '2026-07-17',
    lunar: '六月初四', tibetan: '六月初三', tibetanMonth: '明净月',
    tags: ['九凶同聚'],
    events: ['地藏法会', '理发吉日：家族增长财富'],
  },
  {
    date: '2026-07-18',
    lunar: '六月初五', tibetan: '六月初四', tibetanMonth: '明净月',
    auspicious: true,
    events: ['地藏法会', '释迦牟尼佛初转法轮日', '理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-07-19',
    lunar: '六月初六', tibetan: '六月初五', tibetanMonth: '明净月',
    auspicious: true,
    events: ['地藏法会', '蒋扬钦哲旺波尊者诞辰日', '理发吉日：聚集广大财富'],
  },
  {
    date: '2026-07-20',
    lunar: '六月初七', tibetan: '六月初六', tibetanMonth: '明净月',
    events: ['地藏法会'],
  },
  {
    date: '2026-07-21',
    lunar: '六月初八', tibetan: '六月初七', tibetanMonth: '明净月',
    tags: ['十斋日', '飞幡日'],
    events: ['地藏法会'],
  },
  {
    date: '2026-07-22',
    lunar: '六月初九', tibetan: '六月初八', tibetanMonth: '明净月',
    auspicious: true,
    events: ['地藏法会结束', '药师佛加持日,作何善恶成千倍', '理发吉日：长寿'],
  },
  {
    date: '2026-07-23',
    lunar: '六月初十', tibetan: '六月初九', tibetanMonth: '明净月',
    events: ['理发吉日：易遇佳人'],
    publicHoliday: '大暑',
  },
  {
    date: '2026-07-24',
    lunar: '六月十一', tibetan: '六月初十', tibetanMonth: '明净月',
    auspicious: true,
    events: ['莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-07-25',
    lunar: '六月十二', tibetan: '六月十一', tibetanMonth: '明净月',
    events: ['理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-07-26',
    lunar: '六月十三', tibetan: '六月十二', tibetanMonth: '明净月',
  },
  {
    date: '2026-07-27',
    lunar: '六月十四', tibetan: '六月十三', tibetanMonth: '明净月',
    tags: ['十斋日'],
    events: ['理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-07-28',
    lunar: '六月十五', tibetan: '六月十四', tibetanMonth: '明净月',
    tags: ['八吉同聚', '十斋日'],
    events: ['理发吉日：财物增多'],
  },
  {
    date: '2026-07-29',
    lunar: '六月十六', tibetan: '六月十五', tibetanMonth: '明净月',
    auspicious: true,
    events: ['释迦牟尼佛入胎日,作何善恶成百万倍', '阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
  },
  {
    date: '2026-07-30',
    lunar: '六月十七', tibetan: '六月十六', tibetanMonth: '明净月',
  },
  {
    date: '2026-07-31',
    lunar: '六月十八', tibetan: '六月十七', tibetanMonth: '明净月',
    tags: ['十斋日'],
  },

  // ── 2026 年 8 月 · 8乐有涯 · 明净月(1-12) / 具醉月(13+) ───────────────────
  {
    date: '2026-08-01',
    lunar: '六月十九', tibetan: '六月十八', tibetanMonth: '明净月',
    auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍', '观世音菩萨成道日(汉)'],
    publicHoliday: '建军节',
  },
  {
    date: '2026-08-02',
    lunar: '六月二十', tibetan: '六月十九', tibetanMonth: '明净月',
    tags: ['飞幡日'],
    events: ['理发吉日：增胜善法'],
  },
  {
    date: '2026-08-03',
    lunar: '六月廿一', tibetan: '六月二十', tibetanMonth: '明净月',
  },
  {
    date: '2026-08-04',
    lunar: '六月廿二', tibetan: '六月廿一', tibetanMonth: '明净月',
    auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-08-05',
    lunar: '六月廿三', tibetan: '六月廿二', tibetanMonth: '明净月',
    tags: ['十斋日'],
  },
  {
    date: '2026-08-06',
    lunar: '六月廿四', tibetan: '六月廿三', tibetanMonth: '明净月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-08-07',
    lunar: '六月廿五', tibetan: '六月廿四', tibetanMonth: '明净月',
    publicHoliday: '立秋',
  },
  {
    date: '2026-08-08',
    lunar: '六月廿六', tibetan: '六月廿五', tibetanMonth: '明净月',
    auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-08-09',
    lunar: '六月廿七', tibetan: '六月廿六', tibetanMonth: '明净月',
    tags: ['八吉同聚'],
    events: ['喇荣五明佛学院护法节', '理发吉日：增上安乐'],
  },
  {
    date: '2026-08-10',
    lunar: '六月廿八', tibetan: '六月廿七', tibetanMonth: '明净月',
    tags: ['十斋日'],
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-08-11',
    lunar: '六月廿九', tibetan: '六月廿九', tibetanMonth: '明净月',
    tags: ['十斋日'],
  },
  {
    date: '2026-08-12',
    lunar: '六月三十', tibetan: '六月三十', tibetanMonth: '明净月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍', '日全食,食甚1点47分'],
  },
  {
    date: '2026-08-13',
    lunar: '七月初一', tibetan: '七月初一', tibetanMonth: '具醉月',
    tags: ['十斋日'], auspicious: true,
    events: ['禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-08-14',
    lunar: '七月初二', tibetan: '七月初二', tibetanMonth: '具醉月',
  },
  {
    date: '2026-08-15',
    lunar: '七月初三', tibetan: '七月初三', tibetanMonth: '具醉月',
    events: ['理发吉日：家族增长财富'],
  },
  {
    date: '2026-08-16',
    lunar: '七月初四', tibetan: '七月初四', tibetanMonth: '具醉月',
    tags: ['飞幡日'],
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-08-17',
    lunar: '七月初五', tibetan: '七月初五', tibetanMonth: '具醉月',
    events: ['理发吉日：聚集广大财富'],
  },
  {
    date: '2026-08-18',
    lunar: '七月初六', tibetan: '七月初六', tibetanMonth: '具醉月',
  },
  {
    date: '2026-08-19',
    lunar: '七月初七', tibetan: '七月初七', tibetanMonth: '具醉月',
    publicHoliday: '七夕节',
  },
  {
    date: '2026-08-20',
    lunar: '七月初八', tibetan: '七月初八', tibetanMonth: '具醉月',
    tags: ['十斋日'], auspicious: true,
    events: ['药师佛加持日,作何善恶成千倍', '理发吉日：长寿'],
  },
  {
    date: '2026-08-21',
    lunar: '七月初九', tibetan: '七月初九', tibetanMonth: '具醉月',
    tags: ['八吉同聚'],
    events: ['理发吉日：易遇佳人'],
  },
  {
    date: '2026-08-22',
    lunar: '七月初十', tibetan: '七月初十', tibetanMonth: '具醉月',
    auspicious: true,
    events: ['莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-08-23',
    lunar: '七月十一', tibetan: '七月十一', tibetanMonth: '具醉月',
    events: ['理发吉日：增上智慧和世聪'],
    publicHoliday: '处暑',
  },
  {
    date: '2026-08-24',
    lunar: '七月十二', tibetan: '七月十二', tibetanMonth: '具醉月',
  },
  {
    date: '2026-08-25',
    lunar: '七月十三', tibetan: '七月十三', tibetanMonth: '具醉月',
    auspicious: true,
    events: ['大势至菩萨圣诞日(汉)', '理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-08-26',
    lunar: '七月十四', tibetan: '七月十四', tibetanMonth: '具醉月',
    tags: ['十斋日'],
    events: ['理发吉日：财物增多'],
  },
  {
    date: '2026-08-27',
    lunar: '七月十五', tibetan: '七月闰十四', tibetanMonth: '具醉月',
    isIntercalary: true,
    tags: ['十斋日'], auspicious: true,
    events: ['佛欢喜日/僧自恣日(汉)'],
    publicHoliday: '盂兰盆节',
  },
  {
    date: '2026-08-28',
    lunar: '七月十六', tibetan: '七月十五', tibetanMonth: '具醉月',
    auspicious: true,
    events: ['阿弥陀佛加持日,作何善恶成百万倍', '月偏食,初亏10点33分,复圆13点52分', '理发吉日：福报增上'],
  },
  {
    date: '2026-08-29',
    lunar: '七月十七', tibetan: '七月十六', tibetanMonth: '具醉月',
    tags: ['飞幡日'],
  },
  {
    date: '2026-08-30',
    lunar: '七月十八', tibetan: '七月十七', tibetanMonth: '具醉月',
    tags: ['十斋日'],
  },
  {
    date: '2026-08-31',
    lunar: '七月十九', tibetan: '七月十八', tibetanMonth: '具醉月',
    auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
  },

  // ── 2026 年 9 月 · 具醉月(1-11) / 具贤月(12+) ─────────────────────────────
  {
    date: '2026-09-01',
    lunar: '七月二十', tibetan: '七月十九', tibetanMonth: '具醉月',
    events: ['理发吉日：增胜善法'],
  },
  {
    date: '2026-09-02',
    lunar: '七月廿一', tibetan: '七月廿一', tibetanMonth: '具醉月',
    tags: ['八吉同聚'], auspicious: true,
    events: ['地藏菩萨加持日,作何善恶成亿倍'],
  },
  {
    date: '2026-09-03',
    lunar: '七月廿二', tibetan: '七月廿二', tibetanMonth: '具醉月',
  },
  {
    date: '2026-09-04',
    lunar: '七月廿三', tibetan: '七月廿三', tibetanMonth: '具醉月',
    tags: ['十斋日'],
    events: ['理发吉日：增上财富'],
  },
  {
    date: '2026-09-05',
    lunar: '七月廿四', tibetan: '七月廿四', tibetanMonth: '具醉月',
    tags: ['十斋日'],
    events: ['龙树菩萨圣诞日(汉)'],
  },
  {
    date: '2026-09-06',
    lunar: '七月廿五', tibetan: '七月廿五', tibetanMonth: '具醉月',
    auspicious: true,
    events: ['空行母荟供日,作何善恶成十万倍'],
  },
  {
    date: '2026-09-07',
    lunar: '七月廿六', tibetan: '七月廿六', tibetanMonth: '具醉月',
    events: ['理发吉日：增上安乐'],
    publicHoliday: '白露',
  },
  {
    date: '2026-09-08',
    lunar: '七月廿七', tibetan: '七月廿七', tibetanMonth: '具醉月',
    events: ['理发吉日：诸事吉祥'],
  },
  {
    date: '2026-09-09',
    lunar: '七月廿八', tibetan: '七月廿八', tibetanMonth: '具醉月',
    tags: ['十斋日'],
  },
  {
    date: '2026-09-10',
    lunar: '七月廿九', tibetan: '七月廿九', tibetanMonth: '具醉月',
    tags: ['九凶同聚', '十斋日'], auspicious: true,
    events: ['地藏王菩萨圣诞日(汉)'],
    publicHoliday: '教师节',
  },
  {
    date: '2026-09-11',
    lunar: '八月初一', tibetan: '七月三十', tibetanMonth: '具醉月',
    tags: ['十斋日'], auspicious: true,
    events: ['释迦牟尼佛加持日,作何善恶成九亿倍'],
  },
  {
    date: '2026-09-12',
    lunar: '八月初二', tibetan: '八月初一', tibetanMonth: '具贤月',
    tags: ['飞幡日'], auspicious: true,
    events: ['禅定胜王佛加持日,作何善恶成百倍'],
  },
  {
    date: '2026-09-13',
    lunar: '八月初三', tibetan: '八月初二', tibetanMonth: '具贤月',
    auspicious: true,
    events: ['禅宗六祖慧能大师圆寂日(汉)'],
  },
  {
    date: '2026-09-14',
    lunar: '八月初四', tibetan: '八月初三', tibetanMonth: '具贤月',
    events: ['理发吉日：家族增长财富'],
  },
  {
    date: '2026-09-15',
    lunar: '八月初五', tibetan: '八月初四', tibetanMonth: '具贤月',
    tags: ['八吉同聚'],
    events: ['理发吉日：怀业增上，容光焕发'],
  },
  {
    date: '2026-09-16',
    lunar: '八月初六', tibetan: '八月初五', tibetanMonth: '具贤月',
    events: ['理发吉日：聚集广大财富'],
  },
  {
    date: '2026-09-17',
    lunar: '八月初七', tibetan: '八月初六', tibetanMonth: '具贤月',
  },
  {
    date: '2026-09-18',
    lunar: '八月初八', tibetan: '八月初七', tibetanMonth: '具贤月',
    tags: ['十斋日'],
  },
  {
    date: '2026-09-19',
    lunar: '八月初九', tibetan: '八月初八', tibetanMonth: '具贤月',
    auspicious: true,
    events: ['药师佛加持日,作何善恶成千倍', '理发吉日：长寿'],
  },
  {
    date: '2026-09-20',
    lunar: '八月初十', tibetan: '八月初九', tibetanMonth: '具贤月',
    events: ['理发吉日：易遇佳人'],
  },
  {
    date: '2026-09-21',
    lunar: '八月十一', tibetan: '八月初十', tibetanMonth: '具贤月',
    auspicious: true,
    events: ['莲师荟供日,作何善恶成十万倍', '理发吉日：增上欢喜'],
  },
  {
    date: '2026-09-22',
    lunar: '八月十二', tibetan: '八月十一', tibetanMonth: '具贤月',
    events: ['理发吉日：增上智慧和世聪'],
  },
  {
    date: '2026-09-23',
    lunar: '八月十三', tibetan: '八月十二', tibetanMonth: '具贤月',
    publicHoliday: '秋分',
  },
  {
    date: '2026-09-24',
    lunar: '八月十四', tibetan: '八月十三', tibetanMonth: '具贤月',
    tags: ['十斋日', '飞幡日'],
    events: ['理发吉日：精进于佛法修持，最上'],
  },
  {
    date: '2026-09-25',
    lunar: '八月十五', tibetan: '八月十四', tibetanMonth: '具贤月',
    tags: ['十斋日'], auspicious: true,
    events: ['月光菩萨圣诞日(汉)', '理发吉日：财物增多'],
    publicHoliday: '中秋节',
  },
  {
    date: '2026-09-26',
    lunar: '八月十六', tibetan: '八月十五', tibetanMonth: '具贤月',
    auspicious: true,
    events: ['阿弥陀佛加持日,作何善恶成百万倍', '理发吉日：福报增上'],
  },
  {
    date: '2026-09-27',
    lunar: '八月十七', tibetan: '八月十六', tibetanMonth: '具贤月',
    tags: ['八吉同聚'],
  },
  {
    date: '2026-09-28',
    lunar: '八月十八', tibetan: '八月十七', tibetanMonth: '具贤月',
    tags: ['十斋日'],
  },
  {
    date: '2026-09-29',
    lunar: '八月十九', tibetan: '八月十八', tibetanMonth: '具贤月',
    auspicious: true,
    events: ['观世音菩萨加持日,作何善恶成千万倍'],
  },
  {
    date: '2026-09-30',
    lunar: '八月二十', tibetan: '八月十九', tibetanMonth: '具贤月',
    auspicious: true,
    events: ['鸠摩罗什圆寂日(汉)', '理发吉日：增胜善法'],
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
