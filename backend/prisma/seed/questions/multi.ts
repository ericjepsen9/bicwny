import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, LESSONS } from '../ids.js';
import { type QuestionSeed, upsertQuestions } from './shared.js';

const questions: QuestionSeed[] = [
  {
    id: 'q_multi_001',
    type: 'multi',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_02,
    difficulty: 3,
    tags: ['菩提心', '功德', '多选'],
    questionText: '关于菩提心之功德，下列哪些说法正确？（可多选）',
    correctText:
      '菩提心能刹那净除重罪、是一切善法之根本、能引导行者速得佛果；但并非只对出家众有效，也不能替代闻思修的渐进次第。',
    wrongText:
      '菩提心对在家众同样殊胜；菩提心不能取代闻思修，而是为闻思修注入大乘动机。',
    source: '《入行论·菩提心利益品》摄义',
    payload: {
      scoringMode: 'partial',
      options: [
        { text: '菩提心能刹那净除无始重罪', correct: true },
        { text: '菩提心是一切大乘善法之根本', correct: true },
        { text: '菩提心只对出家众有效，在家众无份', correct: false },
        { text: '发菩提心可速疾圆成佛果', correct: true },
        { text: '发菩提心即可取代闻思修，无需再渐次学习', correct: false },
      ],
    },
  },
  {
    id: 'q_multi_002',
    type: 'multi',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_03,
    difficulty: 3,
    tags: ['愿行', '多选'],
    questionText: '关于愿菩提心与行菩提心的区别，下列哪些正确？',
    correctText:
      '愿心是发起欲证菩提、度众生之志愿；行心是受菩萨戒、实际修持六度；二者如"欲行"与"正行"；行心必以愿心为基，非全然独立。',
    wrongText: '愿心仅发志愿尚未付诸实修；行心必须在受持戒律、修六度后才算具足。',
    source: '《入行论》卷一',
    payload: {
      scoringMode: 'partial',
      options: [
        { text: '愿心是发"为度众生愿成佛"之志愿', correct: true },
        { text: '行心是受菩萨戒、实际修六度', correct: true },
        { text: '愿心与行心可以同时具足，不必先后', correct: true },
        { text: '愿心与行心完全独立，互不相依', correct: false },
        { text: '只要发愿就自动具足行心，无需受戒', correct: false },
      ],
    },
  },
  {
    id: 'q_multi_003',
    type: 'multi',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_01,
    difficulty: 2,
    tags: ['七支供', '多选'],
    questionText: '下列哪些属于"七支供养"的内容？',
    correctText:
      '七支供：顶礼、供养、忏悔、随喜、请转法轮、请佛住世、回向。"持戒"与"禅定"属六度，不在七支内。',
    wrongText: '持戒、禅定属六度；"供养"与"忏悔"才是七支之二。',
    source: '《入行论·供养品》',
    payload: {
      scoringMode: 'partial',
      options: [
        { text: '顶礼支', correct: true },
        { text: '忏悔支', correct: true },
        { text: '持戒支', correct: false },
        { text: '请转法轮支', correct: true },
        { text: '禅定支', correct: false },
        { text: '回向支', correct: true },
      ],
    },
  },
];

export async function seedMulti(prisma: PrismaClient) {
  await upsertQuestions(prisma, questions);
  console.log(`  ✓ ${questions.length} multi-choice`);
}
