import type { PrismaClient } from '@prisma/client';
import { CHAPTERS, COURSE_ID, DEV_USER_ID, LESSONS } from './ids.js';

export async function seedUser(prisma: PrismaClient) {
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

export async function seedCourse(prisma: PrismaClient) {
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

export async function seedChapters(prisma: PrismaClient) {
  const chapters = [
    { id: CHAPTERS.ch01, order: 1, title: '菩提心利益品', titleTraditional: '菩提心利益品' },
    { id: CHAPTERS.ch03, order: 3, title: '受持菩提心品', titleTraditional: '受持菩提心品' },
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

export async function seedLessons(prisma: PrismaClient) {
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
      where: { chapterId_order: { chapterId: lesson.chapterId, order: lesson.order } },
      update: {},
      create: lesson,
    });
  }
  console.log(`  ✓ ${lessons.length} lessons`);
}

export async function seedContent(prisma: PrismaClient) {
  await seedUser(prisma);
  await seedCourse(prisma);
  await seedChapters(prisma);
  await seedLessons(prisma);
}
