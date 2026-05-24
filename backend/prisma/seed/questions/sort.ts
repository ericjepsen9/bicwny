import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, LESSONS } from '../ids.js';
import { type QuestionSeed, upsertQuestions } from './shared.js';

const questions: QuestionSeed[] = [
  {
    id: 'q_sort_001',
    type: 'sort',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_01,
    difficulty: 2,
    tags: ['七支供', '次第'],
    questionText: '请将"七支供养"按传统次第排序：',
    correctText:
      '七支供次第：① 顶礼 ② 供养 ③ 忏悔 ④ 随喜 ⑤ 请转法轮 ⑥ 请佛住世 ⑦ 回向。',
    wrongText: '次第不可错乱：先顶礼供养，次忏悔随喜，后请法回向。',
    source: '《入行论·供养品》',
    payload: {
      items: [
        { text: '顶礼支', order: 1 },
        { text: '供养支', order: 2 },
        { text: '忏悔支', order: 3 },
        { text: '随喜支', order: 4 },
        { text: '请转法轮支', order: 5 },
        { text: '请佛住世支', order: 6 },
        { text: '回向支', order: 7 },
      ],
    },
  },
  {
    id: 'q_sort_002',
    type: 'sort',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_01,
    difficulty: 2,
    tags: ['修学次第'],
    questionText: '请将大乘修学的入门次第按先后顺序排列：',
    correctText:
      '① 亲近善知识 → ② 听闻正法 → ③ 如理思惟 → ④ 法随法行（修行） → ⑤ 发菩提心受戒。',
    wrongText: '次第不可颠倒：无善知识难得正法；无闻思则修行无依；菩提心以前三为基才能坚固。',
    source: '《菩提道次第》摄义',
    payload: {
      items: [
        { text: '亲近善知识', order: 1 },
        { text: '听闻正法', order: 2 },
        { text: '如理思惟', order: 3 },
        { text: '法随法行', order: 4 },
        { text: '发菩提心受戒', order: 5 },
      ],
    },
  },
  {
    id: 'q_sort_003',
    type: 'sort',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_02,
    difficulty: 3,
    tags: ['受戒仪轨'],
    questionText: '受持菩提心戒的基本仪轨次第是？',
    correctText:
      '① 七支供净除障碍积集资粮 → ② 皈依三宝 → ③ 发愿菩提心 → ④ 正受行菩提心戒 → ⑤ 回向。',
    wrongText: '须先供养忏悔积资净障，再皈依、发心、受戒，最后回向。',
    source: '《入行论·受持品》',
    payload: {
      items: [
        { text: '修七支供以积资净障', order: 1 },
        { text: '皈依三宝', order: 2 },
        { text: '发起愿菩提心', order: 3 },
        { text: '正受行菩提心戒', order: 4 },
        { text: '回向一切众生', order: 5 },
      ],
    },
  },
];

export async function seedSort(prisma: PrismaClient) {
  await upsertQuestions(prisma, questions);
  console.log(`  ✓ ${questions.length} sort`);
}
