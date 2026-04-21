// 觉学 JueXue · Seed 脚本
// 运行：npm run prisma:seed
// Sprint 1 第 1 步（分 5 小步）：
//   1.1 骨架：user + course + 2 chapters + 5 lessons   ✓
//   1.2 single + fill 题                                ✓
//   1.3 multi + open 题                                  ✓
//   1.4 sort + match 题                                  ← 当前
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
// 1.3  题目 · multi + open
// ═══════════════════════════════════════════════════════════════

async function seedMultiQuestions() {
  const qs: QuestionSeed[] = [
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
      wrongText:
        '愿心仅发志愿尚未付诸实修；行心必须在受持戒律、修六度后才算具足。',
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
      wrongText:
        '持戒、禅定属六度；"供养"与"忏悔"才是七支之二。',
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
  await upsertQuestions(qs);
  console.log(`  ✓ ${qs.length} multi-choice`);
}

async function seedOpenQuestions() {
  const qs: QuestionSeed[] = [
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
      wrongText:
        '请补充 "为谁"、"成就什么" 与 "在生活中怎样落实" 这三个层次。',
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
  await upsertQuestions(qs);
  console.log(`  ✓ ${qs.length} open-ended`);
}

// ═══════════════════════════════════════════════════════════════
// 1.4  题目 · sort + match
// ═══════════════════════════════════════════════════════════════

async function seedSortQuestions() {
  const qs: QuestionSeed[] = [
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
      wrongText:
        '次第不可颠倒：无善知识难得正法；无闻思则修行无依；菩提心以前三为基才能坚固。',
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
      wrongText:
        '须先供养忏悔积资净障，再皈依、发心、受戒，最后回向。',
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
  await upsertQuestions(qs);
  console.log(`  ✓ ${qs.length} sort`);
}

async function seedMatchQuestions() {
  const qs: QuestionSeed[] = [
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
  await upsertQuestions(qs);
  console.log(`  ✓ ${qs.length} match`);
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
  await seedMultiQuestions();
  await seedOpenQuestions();
  await seedSortQuestions();
  await seedMatchQuestions();
  // TODO 1.5: LLM providers + scenario + prompt template
  console.log('\n✅ Seed 1.4 done (20/20 questions — LLM config pending)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
