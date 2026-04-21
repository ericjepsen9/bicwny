// 觉学 JueXue · Seed 入口
// 运行：npm run prisma:seed
// 详细数据在 ./seed/ 目录按领域拆分（content / accounts / questions/* / llm）。

import { PrismaClient } from '@prisma/client';
import { seedAccounts } from './seed/accounts.js';
import { seedContent } from './seed/content.js';
import { seedLlm } from './seed/llm.js';
import { seedQuestions } from './seed/questions/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding…\n');
  await seedContent(prisma);
  await seedAccounts(prisma);
  await seedQuestions(prisma);
  await seedLlm(prisma);
  console.log('\n✅ Seed done');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
