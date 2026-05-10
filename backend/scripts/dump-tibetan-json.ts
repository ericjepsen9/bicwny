// 导出 prisma/seed/tibetan-2026.ts 里的 DAYS 数组为标准 JSON
//   用途：admin 页 `📤 导入 JSON 覆盖` 直接上传 · 绕开 prisma:seed
//   运行：cd backend && npx tsx scripts/dump-tibetan-json.ts
//   输出：data/tibetan-2026.json
//   未来年（2027/2028…）的 JSON 由 Claude 读图生成 · 同样用 admin 导入
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAYS } from '../prisma/seed/tibetan-2026.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../data');
const outFile = resolve(outDir, 'tibetan-2026.json');

const normalized = DAYS.map((d) => ({
  date: d.date,
  lunar: d.lunar,
  tibetan: d.tibetan,
  tibetanMonth: d.tibetanMonth,
  isIntercalary: d.isIntercalary ?? false,
  tags: d.tags ?? [],
  auspicious: d.auspicious ?? false,
  events: d.events ?? [],
  publicHoliday: d.publicHoliday ?? null,
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(normalized, null, 2), 'utf8');
console.log(`✅ 写出 ${normalized.length} 天 → ${outFile}`);
