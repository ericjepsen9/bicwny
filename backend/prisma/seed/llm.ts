import type { PrismaClient } from '@prisma/client';
import { PROMPT_TEMPLATE_ID, PROVIDER_IDS, SCENARIO_ID } from './ids.js';

const OPEN_GRADING_PROMPT = `你是佛法题库的评分助手，负责评估学员对开放题的作答。
评分依据：参考答案与若干关键要点（keyPoints），每个要点附有 signals 作为关键词线索。

【题目】
{{question}}

【参考答案】
{{referenceAnswer}}

【关键要点（JSON）】
{{keyPoints}}

【学员作答】
{{studentAnswer}}

【评分步骤】
1. 逐一对照 keyPoints：检查学员作答是否触及该要点的核心意涵。signals 仅作为关键词提示，不要机械地以字面匹配为唯一标准；同义表述、意译、举例说明均可视为触及。
2. 综合覆盖要点数量与表述质量，打一个 0–100 的整数分：
   - 80–100：覆盖绝大多数要点且表达通顺
   - 60–79：覆盖过半要点，但有重要遗漏或表述模糊
   - 40–59：只触及少数要点
   - 0–39：基本未理解题意
3. 给出不超过 100 字的中文反馈，先肯定再建议，不指责。

【输出格式 —— 严格 JSON，不要使用 markdown 代码块】
{
  "score": <0-100 整数>,
  "covered": [<被覆盖要点的 point 字段>],
  "missing": [<未覆盖要点的 point 字段>],
  "feedback": "<中文反馈，不超过 100 字>"
}`;

export async function seedLlmProviders(prisma: PrismaClient) {
  // 主通路：MiniMax 包年套餐（配额额度按实际套餐填；当前为占位值，Admin 后台可改）
  await prisma.llmProviderConfig.upsert({
    where: { name: 'minimax' },
    update: {},
    create: {
      id: PROVIDER_IDS.minimax,
      name: 'minimax',
      displayName: 'MiniMax（主通路 · 包年）',
      baseUrl: 'https://api.minimax.chat/v1',
      apiKeyEnv: 'MINIMAX_API_KEY',
      defaultModel: 'abab6.5s-chat',
      isEnabled: true,
      role: 'primary',
      priority: 1,
      yearlyTokenQuota: BigInt(100_000_000),
      monthlyTokenQuota: BigInt(8_500_000),
      dailyRequestQuota: 10_000,
      rpmLimit: 60,
      concurrencyLimit: 5,
      reservePercent: 5,
      overagePolicy: 'fallback',
      inputCostPer1k: 0.00028,
      outputCostPer1k: 0.00042,
    },
  });

  // 兜底：Claude Haiku，pay-as-you-go，预算上限由 LLM_FALLBACK_MONTHLY_BUDGET_USD 控制
  await prisma.llmProviderConfig.upsert({
    where: { name: 'claude' },
    update: {},
    create: {
      id: PROVIDER_IDS.claude,
      name: 'claude',
      displayName: 'Claude Haiku 4.5（兜底 · 按量付费）',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      defaultModel: 'claude-haiku-4-5',
      isEnabled: true,
      role: 'fallback',
      priority: 50,
      yearlyTokenQuota: null,
      monthlyTokenQuota: null,
      dailyRequestQuota: null,
      rpmLimit: 100,
      concurrencyLimit: 10,
      reservePercent: 0,
      overagePolicy: 'pay_as_you_go',
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.005,
    },
  });

  console.log('  ✓ 2 LLM providers (minimax primary · claude fallback)');
}

export async function seedLlmPromptTemplate(prisma: PrismaClient) {
  await prisma.llmPromptTemplate.upsert({
    where: { scenario_version: { scenario: 'open_grading', version: 'v3.1' } },
    update: {},
    create: {
      id: PROMPT_TEMPLATE_ID,
      scenario: 'open_grading',
      version: 'v3.1',
      content: OPEN_GRADING_PROMPT,
      isActive: true,
    },
  });
  console.log('  ✓ 1 prompt template (open_grading v3.1)');
}

export async function seedLlmScenario(prisma: PrismaClient) {
  await prisma.llmScenarioConfig.upsert({
    where: { scenario: 'open_grading' },
    update: {},
    create: {
      id: SCENARIO_ID,
      scenario: 'open_grading',
      primaryProviderId: PROVIDER_IDS.minimax,
      primaryModel: 'abab6.5s-chat',
      fallbackProviderId: PROVIDER_IDS.claude,
      fallbackModel: 'claude-haiku-4-5',
      temperature: 0.3,
      maxTokens: 1500,
      promptTemplateId: PROMPT_TEMPLATE_ID,
      estimatedTokensPerCall: 1200,
    },
  });
  console.log('  ✓ 1 scenario config (open_grading)');
}

export async function seedLlm(prisma: PrismaClient) {
  await seedLlmProviders(prisma);
  await seedLlmPromptTemplate(prisma);
  await seedLlmScenario(prisma);
}
