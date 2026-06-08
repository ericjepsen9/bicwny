// 一次性脚本：补齐 notes_assist LLM 场景配置
//
// 跑：cd backend && npx tsx scripts/seed-notes-assist-scenario.ts
//
// 背景：notes_assist 场景在 prisma/seed/llm.ts 已定义 · 但 prod DB 未重新 seed
// 导致 /api/notes/llm-assist 调用 gateway.chat('notes_assist', ...) 时
// 抛 NOT_FOUND「LLM 场景配置未找到: notes_assist」(HTTP 404)。
// 本脚本只 upsert 这一行 · 不动其它 LLM 配置 · 不动 provider。
import { PrismaClient } from '@prisma/client';

const PROVIDER_IDS = {
  minimax: 'provider_minimax',
  claude: 'provider_claude',
} as const;
const NOTES_ASSIST_SCENARIO_ID = 'scenario_notes_assist';

async function main() {
  const prisma = new PrismaClient();
  try {
    const minimax = await prisma.llmProviderConfig.findUnique({ where: { name: 'minimax' } });
    const claude = await prisma.llmProviderConfig.findUnique({ where: { name: 'claude' } });
    if (!minimax) {
      console.error('❌ 缺 minimax provider · 请先跑 prisma seed 或在 admin 后台配置');
      process.exit(1);
    }

    const result = await prisma.llmScenarioConfig.upsert({
      where: { scenario: 'notes_assist' },
      update: {},
      create: {
        id: NOTES_ASSIST_SCENARIO_ID,
        scenario: 'notes_assist',
        primaryProviderId: minimax.id ?? PROVIDER_IDS.minimax,
        primaryModel: minimax.defaultModel ?? 'abab6.5s-chat',
        fallbackProviderId: claude?.id ?? null,
        fallbackModel: claude?.defaultModel ?? null,
        temperature: 0.4,
        maxTokens: 2000,
        promptTemplateId: null,
        estimatedTokensPerCall: 800,
      },
    });
    console.log('✓ notes_assist scenario ready:', {
      id: result.id,
      primary: `${minimax.name}/${result.primaryModel}`,
      fallback: claude ? `${claude.name}/${result.fallbackModel}` : '(none)',
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
