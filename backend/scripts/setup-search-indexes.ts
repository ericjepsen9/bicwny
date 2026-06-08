// 全文搜索索引 · pg_trgm + GIN（可选 · 加速 ILIKE）
// P2 #24
//
// 用法：
//   cd backend && npm run db:search:setup
//
// 行为：
//   1) 尝试 CREATE EXTENSION IF NOT EXISTS pg_trgm
//      （需要 superuser · 托管数据库可能受限 · 报错时跳过 · 走 seq scan 也能用）
//   2) 给搜索热点列加 GIN gin_trgm_ops 索引（CREATE INDEX IF NOT EXISTS · 幂等）
//   3) 不破坏数据 · 不需要在 deploy 流程必跑 · 数据量小时跳过
//
// 性能：
//   pg_trgm 装上后 · 标题/source 等短列 ILIKE '%...%' 走索引能从 ~200ms 降到 <10ms
//   长 referenceText 不建议加 trigram 索引 · 体积大且更新慢 · 默认不加
//
// 退出码：成功 0 · 失败 1
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

interface IndexSpec {
  table: string;
  column: string;
  /** 索引名 · 不指定按规则生成 */
  name?: string;
}

const INDEXES: IndexSpec[] = [
  // Course
  { table: 'Course', column: 'title' },
  { table: 'Course', column: 'titleTraditional' },
  { table: 'Course', column: 'author' },
  // Lesson
  { table: 'Lesson', column: 'title' },
  { table: 'Lesson', column: 'teachingSummary' },
  // Question
  { table: 'Question', column: 'questionText' },
  { table: 'Question', column: 'source' },
];

function indexName(spec: IndexSpec): string {
  return spec.name || `idx_trgm_${spec.table}_${spec.column}`.toLowerCase();
}

async function main() {
  // 1) 尝试装扩展
  let trgm = false;
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    trgm = true;
    console.log('✓ pg_trgm extension enabled');
  } catch (e) {
    console.warn(`⚠ pg_trgm install failed (continuing without): ${(e as Error).message}`);
  }

  if (!trgm) {
    console.log('Skipping GIN index creation (pg_trgm unavailable). Search still works via seq-scan ILIKE.');
    return;
  }

  // 2) 加索引
  let added = 0;
  let skipped = 0;
  for (const spec of INDEXES) {
    const name = indexName(spec);
    // 用 LOWER(col) gin_trgm_ops 让 ILIKE 走索引
    // 注：GIN 索引不能直接索引 NULL 列 · 加 COALESCE 兜底
    const sql = `CREATE INDEX IF NOT EXISTS "${name}" ON "${spec.table}" USING gin (LOWER(COALESCE("${spec.column}", '')) gin_trgm_ops)`;
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`✓ ${name}`);
      added++;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('already exists')) {
        skipped++;
      } else {
        console.error(`✗ ${name}: ${msg}`);
      }
    }
  }
  console.log(`\nDone: ${added} created, ${skipped} already exist.`);
}

main()
  .catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
