// 内容 seed 运行器 · CLI
//   npm run content:seed                运行所有未应用的 seed
//   npm run content:seed -- --dry-run   只列出待运行 · 不写库
//   npm run content:seed -- --force     hash 变了也覆盖
//
// seed 文件约定：放在 backend/prisma/seed/content-versioned/*.ts
//   导出 default { name, run(tx, ctx) }（SeedDef 子集）
//   命名建议 'V202604_xxx.ts' · runner 按文件名升序应用
//
// 与 npm run prisma:seed 区别：
//   prisma:seed = 重置数据库后铺底数据（开发 reset 用）
//   content:seed = 增量内容版本（生产追加 / A-B 实验题库）
//
// 退出码：成功 0 · 任何 seed 失败 1 · 没找到目录或无文件 2
import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSeed, type SeedDef } from '../src/lib/content-seed.js';
import { prisma } from '../src/lib/prisma.js';

const SEED_DIR = resolve(process.cwd(), 'prisma/seed/content-versioned');

interface CliOpts {
  dryRun: boolean;
  force: boolean;
  appliedBy?: string;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { dryRun: false, force: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a.startsWith('--applied-by=')) opts.appliedBy = a.slice('--applied-by='.length);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  let files: string[];
  try {
    files = readdirSync(SEED_DIR)
      .filter((f) => /\.(ts|mjs|js)$/.test(f) && !f.endsWith('.d.ts'))
      .sort();
  } catch {
    console.log(`📁 ${SEED_DIR} not found · 没有需要应用的 seed`);
    process.exit(2);
  }

  if (files.length === 0) {
    console.log('📦 No seed files found.');
    process.exit(2);
  }

  console.log(`🌱 Found ${files.length} seed file(s) in ${SEED_DIR}`);

  let applied = 0;
  let skipped = 0;

  for (const f of files) {
    const fullPath = join(SEED_DIR, f);
    const url = pathToFileURL(fullPath).href;
    let mod: { default?: Partial<SeedDef> } | undefined;
    try {
      mod = await import(url);
    } catch (e) {
      console.error(`  ✗ ${f} import failed: ${(e as Error).message}`);
      process.exit(1);
    }
    const def = mod?.default;
    if (!def || !def.name || typeof def.run !== 'function') {
      console.error(`  ✗ ${f} missing default export { name, run(tx, ctx) }`);
      process.exit(1);
    }
    if (opts.dryRun) {
      const existing = await prisma.contentSeed.findUnique({ where: { name: def.name } });
      console.log(
        `  ${existing ? '○' : '·'} ${def.name}${existing ? ' (already applied)' : ' (would apply)'}`,
      );
      continue;
    }

    const fullDef: SeedDef = {
      name: def.name,
      run: def.run,
      sourcePath: fullPath,
      force: opts.force,
      appliedBy: opts.appliedBy,
    };

    try {
      const r = await runSeed(fullDef);
      if (r.skipped) {
        console.log(`  ○ ${def.name} (skipped · already applied)`);
        skipped++;
      } else {
        console.log(
          `  ✓ ${def.name} (releases: ${r.releases}${r.hashChanged ? ' · hash changed' : ''})`,
        );
        applied++;
      }
    } catch (e) {
      console.error(`  ✗ ${def.name} failed: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\nDone: ${applied} applied, ${skipped} skipped${opts.dryRun ? ' (dry-run)' : ''}`);
}

main()
  .catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
