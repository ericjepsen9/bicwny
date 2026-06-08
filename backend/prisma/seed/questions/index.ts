import type { PrismaClient } from '@prisma/client';
import { seedFill } from './fill.js';
import { seedMatch } from './match.js';
import { seedMulti } from './multi.js';
import { seedOpen } from './open.js';
import { seedSingle } from './single.js';
import { seedSort } from './sort.js';

export async function seedQuestions(prisma: PrismaClient) {
  await seedSingle(prisma);
  await seedFill(prisma);
  await seedMulti(prisma);
  await seedOpen(prisma);
  await seedSort(prisma);
  await seedMatch(prisma);
}
