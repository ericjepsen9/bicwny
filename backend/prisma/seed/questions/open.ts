import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, LESSONS } from '../ids.js';
import { type QuestionSeed, upsertQuestions } from './shared.js';

const questions: QuestionSeed[] = [
  {
    id: 'q_open_001',
    type: 'open',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_02,
    difficulty: 4,
    tags: ['菩提心', '思考'],
    questionText: '请用自己的话，简述菩提心为何能"刹那净除无始重罪"？',
    correctText:
      '参考要点：① 菩提心以"利益一切众生、愿证无上菩提"为所缘，心量无限广大；② 以广大心量能对治狭隘我执所造的罪业；③ 动机转移使"业"之报相亦随之转化；④ 如来种性由此生起，过去随顺流转之业失去延续根基。',
    wrongText: '请结合"动机广大"、"对治我执"、"如来种性"几个方向重新说说。',
    source: '《入行论·菩提心利益品》教义摘要',
    payload: {
      referenceAnswer:
        '菩提心以利益一切众生、愿成无上菩提为所缘，心量无限广大。此广大心足以对治狭隘我执所造的重罪；动机一转，业报随之净除；又能令如来种性于相续中生起，使往昔随轮回业失去延续之根基，故曰刹那能净无始之罪。',
      keyPoints: [
        {
          point: '心量广大 · 利益一切众生',
          signals: ['利益一切', '一切众生', '众生', '为利', '度众生', '广大'],
        },
        {
          point: '对治我执 / 自私心',
          signals: ['我执', '自私', '对治', '净除', '罪业', '净化', '转化'],
        },
        {
          point: '发起如来种性',
          signals: ['如来种性', '佛性', '种子', '因', '根基', '成佛', '佛果'],
        },
      ],
      minLength: 30,
      maxLength: 400,
      gradingHint: '宽松：只要涉及 2 个要点方向即可给及格；覆盖 3 个给优秀。',
      strictMode: false,
    },
  },
  {
    id: 'q_open_002',
    type: 'open',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_02,
    difficulty: 5,
    tags: ['发心', '思考', '综合'],
    questionText:
      '请结合课文，谈谈你对"为利有情愿成佛"这一发心的理解，以及它对你日常修学可能产生什么影响？',
    correctText:
      '参考要点：① "为利有情"——动机面向一切众生，非仅自了；② "愿成佛"——目标是圆满的佛果，超越声闻乘的自利解脱；③ 发心须真诚、坚固、能转化日常的身语意；④ 在日常修学中表现为：起心动念以众生利益为先、愿将所修善根回向一切众生、以菩提心贯穿闻思修行。',
    wrongText: '请补充 "为谁"、"成就什么" 与 "在生活中怎样落实" 这三个层次。',
    source: '《入行论·受持品》摄义',
    payload: {
      referenceAnswer:
        '"为利有情愿成佛"是大乘发心的核心：心之所缘是一切众生（为利有情），志之所求是无上佛果（愿成佛），故超越声闻自了之心。此心若于相续中真实生起，日常修学便以众生之利益为导向——起心动念时愿其离苦，所作善根皆回向一切众生，闻思修皆为速证菩提以救度众生，使修行不再仅为个人福乐，而成为广大利他之行。',
      keyPoints: [
        {
          point: '动机：为利有情 / 利益一切众生',
          signals: ['有情', '众生', '一切众生', '为利', '利他', '利益'],
        },
        {
          point: '目标：成就无上佛果',
          signals: ['成佛', '佛果', '菩提', '无上', '圆满', '究竟'],
        },
        {
          point: '落实：日常修学 / 回向 / 转化心念',
          signals: ['日常', '起心动念', '回向', '转化', '闻思', '行持', '生活', '落实'],
        },
        {
          point: '区别声闻自利',
          signals: ['声闻', '自了', '大乘', '广大', '超越', '小乘'],
        },
      ],
      minLength: 50,
      maxLength: 600,
      gradingHint: '中等：覆盖 2 要点及格，3 要点良好，4 要点圆满。',
      strictMode: false,
    },
  },
];

export async function seedOpen(prisma: PrismaClient) {
  await upsertQuestions(prisma, questions);
  console.log(`  ✓ ${questions.length} open-ended`);
}
