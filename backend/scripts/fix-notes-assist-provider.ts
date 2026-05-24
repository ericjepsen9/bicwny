// 修复 notes_assist 场景的 provider 指向
//
// 跑：cd backend && npx tsx scripts/fix-notes-assist-provider.ts
//
// 背景：上一个 seed 脚本 (seed-notes-assist-scenario.ts) 把 notes_assist 的 primary
// 硬编码成 provider_minimax（国内版 · api.minimax.chat · 需要 MINIMAX_API_KEY）·
// 但生产环境实际配的是 MINIMAX_M27_API_KEY（海外版 · api.minimax.io · provider 名
// 'minimax-m27'）· 导致所有 provider 因 no_api_key 被 skip · 调用返回 502。
//
// 本脚本按 isConfigured() 探测顺序选第一个有 API key 的 provider 当 primary ·
// 另一个有 key 的当 fallback · 让 notes_assist 立刻可用。
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

async function main() {
  const prisma = new PrismaClient();
  try {
    // 按运行时实际 env 探测哪些 provider 真的能用
    const envProbe = [
      { name: 'minimax-m27', envKey: 'MINIMAX_M27_API_KEY' },
      { name: 'minimax', envKey: 'MINIMAX_API_KEY' },
      { name: 'claude', envKey: 'ANTHROPIC_API_KEY' },
    ];
    const usable = envProbe.filter(p => !!process.env[p.envKey]);
    if (usable.length === 0) {
      console.error('❌ 没有任何 LLM provider 的 API key 在 env 中 · 先填 .env');
      process.exit(1);
    }
    console.log('✓ env 中有 key 的 provider:', usable.map(p => p.name).join(', '));

    // 从 DB 取这些 provider 的 row
    const dbProviders = await prisma.llmProviderConfig.findMany({
      where: { name: { in: usable.map(p => p.name) }, isEnabled: true },
    });
    const byName = new Map(dbProviders.map(p => [p.name, p]));

    // 按 usable 顺序选 primary / fallback（minimax-m27 优先 · 你之前部署的就是它）
    const ordered = usable.map(p => byName.get(p.name)).filter((x): x is NonNullable<typeof x> => !!x);
    if (ordered.length === 0) {
      console.error('❌ DB LlmProviderConfig 里没有匹配的 isEnabled provider');
      process.exit(1);
    }
    const primary = ordered[0]!;
    const fallback = ordered[1] ?? null;

    console.log('  primary:', primary.name, '(' + primary.defaultModel + ')');
    console.log('  fallback:', fallback ? fallback.name + ' (' + fallback.defaultModel + ')' : '(none)');

    const updated = await prisma.llmScenarioConfig.update({
      where: { scenario: 'notes_assist' },
      data: {
        primaryProviderId: primary.id,
        primaryModel: primary.defaultModel,
        fallbackProviderId: fallback?.id ?? null,
        fallbackModel: fallback?.defaultModel ?? null,
      },
    });
    console.log('✓ notes_assist scenario 已更新:', {
      primary: updated.primaryModel,
      fallback: updated.fallbackModel,
    });
    console.log('\n下一步：浏览器重试「📑 用本课全文生成 AI 草稿」即可（无需重启 PM2）');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
