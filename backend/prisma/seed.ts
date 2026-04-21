// 觉学 JueXue · Seed 脚本
// 运行：npm run prisma:seed
// Sprint 1 第 1 步（分 5 小步）：
//   1.1 骨架：user + course + 2 chapters + 5 lessons   ✓
//   1.2 single + fill 题                                ← 当前
//   1.3 multi + open 题
//   1.4 sort + match 题
//   1.5 LLM providers + scenario + prompt 模板

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ───── 固定 ID（后续小步会引用） ─────
export const DEV_USER_ID = 'dev_user_001';
export const COURSE_ID = 'course_ruxinglun';
export const CHAPTERS = {
  ch01: 'ch_ruxinglun_01',
  ch03: 'ch_ruxinglun_03',
};
export const LESSONS = {
  l01_01: 'lesson_ruxinglun_01_01',
  l01_02: 'lesson_ruxinglun_01_02',
  l01_03: 'lesson_ruxinglun_01_03',
  l03_01: 'lesson_ruxinglun_03_01',
  l03_02: 'lesson_ruxinglun_03_02',
};

// ═══════════════════════════════════════════════════════════════
// 1.1  骨架
// ═══════════════════════════════════════════════════════════════

async function seedUser() {
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: 'dev@juexue.app',
      dharmaName: '测试同学',
      timezone: 'Asia/Taipei',
      locale: 'zh-Hans',
    },
  });
  console.log('  ✓ User: dev_user_001');
}

async function seedCourse() {
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {},
    create: {
      id: COURSE_ID,
      slug: 'ruxinglun',
      title: '入行论',
      titleTraditional: '入行論',
      author: '寂天菩萨',
      authorInfo: '印度那烂陀寺大德 · 中观派论师',
      description:
        '《入菩萨行论》为大乘佛教中观派代表作，系统阐述如何发起菩提心、修持六度、圆成佛果。',
      coverEmoji: '🪷',
      displayOrder: 1,
      isPublished: true,
      licenseInfo: 'CC BY-NC-SA 4.0 · 法本内容来源公开流通版',
    },
  });
  console.log('  ✓ Course: 入行论');
}

async function seedChapters() {
  const chapters = [
    {
      id: CHAPTERS.ch01,
      order: 1,
      title: '菩提心利益品',
      titleTraditional: '菩提心利益品',
    },
    {
      id: CHAPTERS.ch03,
      order: 3,
      title: '受持菩提心品',
      titleTraditional: '受持菩提心品',
    },
  ];
  for (const ch of chapters) {
    await prisma.chapter.upsert({
      where: { courseId_order: { courseId: COURSE_ID, order: ch.order } },
      update: {},
      create: { ...ch, courseId: COURSE_ID },
    });
  }
  console.log(`  ✓ ${chapters.length} chapters`);
}

async function seedLessons() {
  const lessons = [
    {
      id: LESSONS.l01_01,
      chapterId: CHAPTERS.ch01,
      order: 1,
      title: '第 1 课 · 论名 · 礼敬 · 立誓',
      referenceText: '暇满人身极难得，既得能办人生利。',
      teachingSummary:
        '开篇礼敬三宝与传承上师，说明造论目的：为自他相续生起并增上菩提心。',
    },
    {
      id: LESSONS.l01_02,
      chapterId: CHAPTERS.ch01,
      order: 2,
      title: '第 2 课 · 菩提心之功德',
      referenceText: '菩提心如劫末火，刹那能毁诸重罪。',
      teachingSummary:
        '菩提心能刹那净除无始以来的罪业，是解脱轮回、成就佛果的不共因。',
    },
    {
      id: LESSONS.l01_03,
      chapterId: CHAPTERS.ch01,
      order: 3,
      title: '第 3 课 · 愿行菩提心',
      referenceText: '如人尽了知，欲行正行别；如是智者知，二心次第别。',
      teachingSummary:
        '区分愿菩提心与行菩提心：前者如欲行，后者如正行，二者次第增上。',
    },
    {
      id: LESSONS.l03_01,
      chapterId: CHAPTERS.ch03,
      order: 1,
      title: '第 4 课 · 七支供养',
      referenceText: '我今无怙众生救，离诸怖畏诸导师。',
      teachingSummary:
        '顶礼、供养、忏悔、随喜、请转法轮、请佛住世、回向功德，积资净障之大门。',
    },
    {
      id: LESSONS.l03_02,
      chapterId: CHAPTERS.ch03,
      order: 2,
      title: '第 5 课 · 正受菩提心',
      referenceText: '如昔诸善逝，先发菩提心。',
      teachingSummary: '依仪轨正受菩提心戒，愿一切众生安住无上菩提。',
    },
  ];
  for (const lesson of lessons) {
    await prisma.lesson.upsert({
      where: {
        chapterId_order: { chapterId: lesson.chapterId, order: lesson.order },
      },
      update: {},
      create: lesson,
    });
  }
  console.log(`  ✓ ${lessons.length} lessons`);
}

// ═══════════════════════════════════════════════════════════════
// 1.2  题目 · single + fill
// ═══════════════════════════════════════════════════════════════

type QuestionSeed = Parameters<typeof prisma.question.upsert>[0]['create'];

async function upsertQuestions(questions: QuestionSeed[]) {
  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id! },
      update: {},
      create: { ...q, courseId: COURSE_ID },
    });
  }
}

async function seedSingleQuestions() {
  const qs: QuestionSeed[] = [
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
      correctText: '"善逝"是佛陀十号之一，指已远离生死、安住涅槃的如来。此偈明示行者当效法往昔诸佛发心。',
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
  await upsertQuestions(qs);
  console.log(`  ✓ ${qs.length} single-choice`);
}

async function seedFillQuestions() {
  const qs: QuestionSeed[] = [
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
  await upsertQuestions(qs);
  console.log(`  ✓ ${qs.length} fill-in-verse`);
}

// ═══════════════════════════════════════════════════════════════
// Entry
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('🌱 Seeding…\n');
  await seedUser();
  await seedCourse();
  await seedChapters();
  await seedLessons();
  await seedSingleQuestions();
  await seedFillQuestions();
  // TODO 1.3 – 1.5: multi/open/sort/match + LLM config
  console.log('\n✅ Seed 1.2 done (9/20 questions — multi/open/sort/match pending)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
