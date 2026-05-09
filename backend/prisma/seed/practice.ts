// 修学计数 · 平台预置数据
//   - 5 个固定大类（PracticeCategory）· key 不可改 · 前端按 key 显示
//   - 每个大类下若干平台预置子项（PracticeProject scope=user owner=null isBuiltin=true）
//     用 isBuiltin=true + scope=user + ownerId=null 表示「平台预置 · 全员可见」
//   - 这些数据 idempotent · upsert by key/name
import type { PrismaClient } from '@prisma/client';

interface CategorySpec {
  key: string;
  name: string;
  emoji: string;
  displayOrder: number;
  builtin: { name: string; emoji?: string }[];
}

const CATEGORIES: CategorySpec[] = [
  {
    key: 'mantra',
    name: '持咒',
    emoji: '📿',
    displayOrder: 1,
    builtin: [
      { name: '百字明' },
      { name: '莲师心咒' },
      { name: '观音心咒' },
      { name: '文殊心咒' },
      { name: '绿度母心咒' },
    ],
  },
  {
    key: 'prostration',
    name: '礼拜',
    emoji: '🙏',
    displayOrder: 2,
    builtin: [
      { name: '大礼拜' },
      { name: '磕长头' },
      { name: '顶礼三宝' },
    ],
  },
  {
    key: 'recite',
    name: '诵经',
    emoji: '📖',
    displayOrder: 3,
    builtin: [
      { name: '心经' },
      { name: '金刚经' },
      { name: '普贤行愿品' },
      { name: '楞严咒' },
      { name: '大悲咒' },
    ],
  },
  {
    key: 'mandala',
    name: '供曼扎',
    emoji: '🪷',
    displayOrder: 4,
    builtin: [
      { name: '七支供' },
      { name: '三十七供' },
    ],
  },
  {
    key: 'meditation',
    name: '观修',
    emoji: '🧘',
    displayOrder: 5,
    builtin: [
      { name: '四加行' },
      { name: '出离心' },
      { name: '菩提心' },
      { name: '空性' },
      { name: '上师瑜伽' },
    ],
  },
];

export async function seedPracticeCategories(prisma: PrismaClient) {
  for (const c of CATEGORIES) {
    const cat = await prisma.practiceCategory.upsert({
      where: { key: c.key },
      update: { name: c.name, emoji: c.emoji, displayOrder: c.displayOrder },
      create: { key: c.key, name: c.name, emoji: c.emoji, displayOrder: c.displayOrder },
    });
    // 平台预置子项 · isBuiltin=true · scope=user · ownerId=null（特殊语义：全员可见）
    for (let i = 0; i < c.builtin.length; i++) {
      const it = c.builtin[i]!;
      // 用 categoryId + name + isBuiltin 唯一识别（schema 没有该 unique · 走 findFirst → upsert by id）
      const existing = await prisma.practiceProject.findFirst({
        where: { categoryId: cat.id, name: it.name, isBuiltin: true },
      });
      if (existing) {
        await prisma.practiceProject.update({
          where: { id: existing.id },
          data: { displayOrder: i, emoji: it.emoji ?? null },
        });
      } else {
        await prisma.practiceProject.create({
          data: {
            categoryId: cat.id,
            name: it.name,
            emoji: it.emoji ?? null,
            scope: 'user', // 平台预置走 user scope · ownerId=null 表示全员可见
            ownerId: null,
            isBuiltin: true,
            displayOrder: i,
          },
        });
      }
    }
  }
  console.log(`  ✓ Practice 大类 ${CATEGORIES.length} + 子项 ${CATEGORIES.reduce((s, c) => s + c.builtin.length, 0)}`);
}
