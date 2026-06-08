import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, LESSONS } from '../ids.js';
import { type QuestionSeed, upsertQuestions } from './shared.js';

const questions: QuestionSeed[] = [
  {
    id: 'q_single_001',
    type: 'single',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_01,
    difficulty: 1,
    tags: ['基础', '作者'],
    questionText: '《入菩萨行论》的造论者是下列哪一位？',
    correctText: '寂天菩萨（Śāntideva）是《入菩萨行论》的造论者，印度那烂陀寺大德。',
    wrongText: '请留意作者身份：《入行论》系寂天菩萨所造。',
    source: '《入行论》传承记载',
    payload: {
      options: [
        { text: '龙树菩萨', correct: false },
        { text: '寂天菩萨', correct: true },
        { text: '月称论师', correct: false },
        { text: '宗喀巴大师', correct: false },
      ],
    },
  },
  {
    id: 'q_single_002',
    type: 'single',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_01,
    difficulty: 2,
    tags: ['宗派'],
    questionText: '《入行论》主要属于下列哪个宗派的论典？',
    correctText: '《入行论》为大乘中观派代表论典，阐明菩提心与二谛思想。',
    wrongText: '《入行论》属中观派，而非唯识或声闻部派论典。',
    source: '传统判教',
    payload: {
      options: [
        { text: '唯识派', correct: false },
        { text: '中观派', correct: true },
        { text: '说一切有部', correct: false },
        { text: '经量部', correct: false },
      ],
    },
  },
  {
    id: 'q_single_003',
    type: 'single',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_02,
    difficulty: 2,
    tags: ['菩提心', '功德'],
    questionText: '菩提心犹如"劫末火"，主要譬喻它能够：',
    correctText: '菩提心刹那能焚毁无始以来之重罪，故以劫末大火为喻。',
    wrongText: '此喻重在"净罪"之不共威力，非仅一般善法。',
    source: '《入行论·菩提心利益品》',
    payload: {
      options: [
        { text: '刹那净除无始重罪', correct: true },
        { text: '让身体得长寿', correct: false },
        { text: '使人增长世间财富', correct: false },
        { text: '消灭外在敌人', correct: false },
      ],
    },
  },
  {
    id: 'q_single_004',
    type: 'single',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_03,
    difficulty: 2,
    tags: ['愿行', '菩提心'],
    questionText: '寂天菩萨以何譬喻说明"愿菩提心"？',
    correctText: '愿菩提心如"欲行"，行菩提心如"正行"；前者发起志愿，后者真实付诸行动。',
    wrongText: '"欲行 / 正行"对应愿心 / 行心，是寂天菩萨经典的区分方式。',
    source: '《入行论》卷一',
    payload: {
      options: [
        { text: '欲行（欲往某地之心）', correct: true },
        { text: '烈火焚薪', correct: false },
        { text: '明镜照物', correct: false },
        { text: '雨润大地', correct: false },
      ],
    },
  },
  {
    id: 'q_single_005',
    type: 'single',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_01,
    difficulty: 1,
    tags: ['七支供'],
    questionText: '下列哪一项不属于"七支供养"？',
    correctText: '七支供为：顶礼、供养、忏悔、随喜、请转法轮、请佛住世、回向。"布施波罗蜜"不在其中。',
    wrongText: '布施属六度，而非七支供之一。',
    source: '《入行论·供养品》',
    payload: {
      options: [
        { text: '顶礼支', correct: false },
        { text: '随喜支', correct: false },
        { text: '布施波罗蜜支', correct: true },
        { text: '回向支', correct: false },
      ],
    },
  },
  {
    id: 'q_single_006',
    type: 'single',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_02,
    difficulty: 2,
    tags: ['受戒'],
    questionText: '"如昔诸善逝，先发菩提心"一偈中，"善逝"指的是：',
    correctText:
      '"善逝"是佛陀十号之一，指已远离生死、安住涅槃的如来。此偈明示行者当效法往昔诸佛发心。',
    wrongText: '善逝特指佛陀，非泛指一切圣者。',
    source: '《入行论·受持品》',
    payload: {
      options: [
        { text: '过去的阿罗汉', correct: false },
        { text: '诸佛如来', correct: true },
        { text: '初地菩萨', correct: false },
        { text: '在家居士', correct: false },
      ],
    },
  },
];

export async function seedSingle(prisma: PrismaClient) {
  await upsertQuestions(prisma, questions);
  console.log(`  ✓ ${questions.length} single-choice`);
}
