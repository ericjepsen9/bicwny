import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, LESSONS } from '../ids.js';
import { type QuestionSeed, upsertQuestions } from './shared.js';

const questions: QuestionSeed[] = [
  {
    id: 'q_fill_001',
    type: 'fill',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_01,
    difficulty: 2,
    tags: ['暇满', '偈颂'],
    questionText: '请补全偈颂的关键字：',
    correctText: '"暇满人身极___得"—— 难。暇满人身依八有暇十圆满方能成立，故云极难。',
    wrongText: '依法本文字，应填"难"。',
    source: '《入行论》第一品偈',
    payload: {
      verseLines: ['暇满人身极＿＿得，', '既得能办人生利。'],
      correctWord: '难',
      options: ['难', '易', '可', '不'],
      verseSource: '《入行论·菩提心利益品》',
    },
  },
  {
    id: 'q_fill_002',
    type: 'fill',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_02,
    difficulty: 2,
    tags: ['菩提心', '偈颂'],
    questionText: '请补全偈颂的关键字：',
    correctText: '"菩提心如___末火"—— 劫。以劫末大火之势喻菩提心净罪之威力。',
    wrongText: '原偈为"劫末火"，非时、岁、火。',
    source: '《入行论·菩提心利益品》',
    payload: {
      verseLines: ['菩提心如＿＿末火，', '刹那能毁诸重罪。'],
      correctWord: '劫',
      options: ['劫', '时', '岁', '年'],
      verseSource: '《入行论·第一品》',
    },
  },
  {
    id: 'q_fill_003',
    type: 'fill',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_02,
    difficulty: 1,
    tags: ['受戒', '偈颂'],
    questionText: '请补全受菩提心戒之偈：',
    correctText: '"如昔诸___，先发菩提心"—— 善逝。行者当效法诸佛往昔发心。',
    wrongText: '偈文标准作"诸善逝"。',
    source: '《入行论·受持品》',
    payload: {
      verseLines: ['如昔诸＿＿，', '先发菩提心。'],
      correctWord: '善逝',
      options: ['善逝', '菩萨', '如来', '世尊'],
      verseSource: '《入行论·第三品》',
    },
  },
];

export async function seedFill(prisma: PrismaClient) {
  await upsertQuestions(prisma, questions);
  console.log(`  ✓ ${questions.length} fill-in-verse`);
}
