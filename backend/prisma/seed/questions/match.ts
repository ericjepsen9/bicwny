import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, LESSONS } from '../ids.js';
import { type QuestionSeed, upsertQuestions } from './shared.js';

const questions: QuestionSeed[] = [
  {
    id: 'q_match_001',
    type: 'match',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_02,
    difficulty: 2,
    tags: ['六度'],
    questionText: '请将"六度"与其核心含义配对：',
    correctText:
      '六度要义：布施—舍己利他；持戒—防非止恶；安忍—不瞋安住；精进—勤求善法；禅定—专注不散；智慧—通达实相。',
    wrongText: '请再核对每度的核心含义，不要张冠李戴。',
    source: '六度传统释义',
    payload: {
      left: [
        { id: 'L1', text: '布施度' },
        { id: 'L2', text: '持戒度' },
        { id: 'L3', text: '安忍度' },
        { id: 'L4', text: '禅定度' },
        { id: 'L5', text: '智慧度' },
      ],
      right: [
        { id: 'R1', text: '舍己所有利益他人', match: 'L1' },
        { id: 'R2', text: '防护三门不造恶业', match: 'L2' },
        { id: 'R3', text: '面对伤害安住不瞋', match: 'L3' },
        { id: 'R4', text: '心专一境不散乱', match: 'L4' },
        { id: 'R5', text: '通达诸法实相', match: 'L5' },
      ],
    },
  },
  {
    id: 'q_match_002',
    type: 'match',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch03,
    lessonId: LESSONS.l03_02,
    difficulty: 3,
    tags: ['佛陀十号'],
    questionText: '请将佛陀圣号与含义配对：',
    correctText:
      '如来：乘如实道来成正觉；应供：堪受天人供养；正遍知：遍知一切法；善逝：好去不还轮回；世间解：了解世间种种。',
    wrongText: '名号背后意涵不同，请细辨。',
    source: '佛陀十号释义',
    payload: {
      left: [
        { id: 'L1', text: '如来' },
        { id: 'L2', text: '应供' },
        { id: 'L3', text: '正遍知' },
        { id: 'L4', text: '善逝' },
        { id: 'L5', text: '世间解' },
      ],
      right: [
        { id: 'R1', text: '乘如实道而来，成等正觉', match: 'L1' },
        { id: 'R2', text: '堪受一切天人之供养', match: 'L2' },
        { id: 'R3', text: '遍知一切诸法实相', match: 'L3' },
        { id: 'R4', text: '善巧越过生死，不再来还', match: 'L4' },
        { id: 'R5', text: '彻底了解世间一切', match: 'L5' },
      ],
    },
  },
  {
    id: 'q_match_003',
    type: 'match',
    courseId: COURSE_ID,
    chapterId: CHAPTERS.ch01,
    lessonId: LESSONS.l01_02,
    difficulty: 3,
    tags: ['菩提心', '譬喻'],
    questionText: '请将菩提心之譬喻与其所表含义配对：',
    correctText:
      '如种子：能生佛果之因；如良田：能长一切善根；如摩尼宝：满足一切所求；如劫末火：刹那净除重罪。',
    wrongText: '譬喻对应功德不同，须细辨。',
    source: '《入行论·菩提心利益品》譬喻汇集',
    payload: {
      left: [
        { id: 'L1', text: '菩提心如种子' },
        { id: 'L2', text: '菩提心如良田' },
        { id: 'L3', text: '菩提心如摩尼宝' },
        { id: 'L4', text: '菩提心如劫末火' },
      ],
      right: [
        { id: 'R1', text: '能生一切佛果之因', match: 'L1' },
        { id: 'R2', text: '长养一切善根', match: 'L2' },
        { id: 'R3', text: '满足一切所求利益', match: 'L3' },
        { id: 'R4', text: '刹那烧尽无始重罪', match: 'L4' },
      ],
    },
  },
];

export async function seedMatch(prisma: PrismaClient) {
  await upsertQuestions(prisma, questions);
  console.log(`  ✓ ${questions.length} match`);
}
