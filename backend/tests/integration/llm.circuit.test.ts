// 熔断器状态机集成：isCircuitOpen（纯函数）+ recordFailure/recordSuccess（DB 事务）
// resetDb 保留 LlmProviderConfig，因此这里用独立名字的 provider，测试完毕清掉
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import {
  COOLDOWN_MS,
  ERROR_THRESHOLD,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
} from '../../src/modules/llm/circuit.js';

const TEST_PROVIDER_NAME = 'itest_circuit_provider';

async function createTestProvider() {
  return prisma.llmProviderConfig.create({
    data: {
      name: TEST_PROVIDER_NAME,
      displayName: 'Circuit Test Provider',
      baseUrl: 'https://example.invalid/v1',
      apiKeyEnv: 'ITEST_NEVER_SET',
      defaultModel: 'test-model',
      isEnabled: false,
    },
  });
}

beforeAll(async () => {
  // 可能上一轮残留
  await prisma.llmProviderConfig.deleteMany({ where: { name: TEST_PROVIDER_NAME } });
});
afterAll(async () => {
  await prisma.llmProviderConfig.deleteMany({ where: { name: TEST_PROVIDER_NAME } });
});
beforeEach(async () => {
  await prisma.llmProviderConfig.deleteMany({ where: { name: TEST_PROVIDER_NAME } });
});

describe('isCircuitOpen (pure)', () => {
  it('null → 关闭', () => {
    expect(isCircuitOpen({ circuitOpenUntil: null })).toBe(false);
  });
  it('未来时间 → 开启', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const future = new Date('2026-01-01T00:00:30Z');
    expect(isCircuitOpen({ circuitOpenUntil: future }, at)).toBe(true);
  });
  it('过去时间 → 关闭（冷却结束）', () => {
    const at = new Date('2026-01-01T00:00:30Z');
    const past = new Date('2026-01-01T00:00:00Z');
    expect(isCircuitOpen({ circuitOpenUntil: past }, at)).toBe(false);
  });
  it('等于当前时间 → 关闭（> 而非 >=）', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    expect(isCircuitOpen({ circuitOpenUntil: at }, at)).toBe(false);
  });
});

describe('recordFailure · 阈值内不开熔断', () => {
  it(`前 ${ERROR_THRESHOLD - 1} 次失败 · circuitOpenUntil 保持 null`, async () => {
    const p = await createTestProvider();
    for (let i = 0; i < ERROR_THRESHOLD - 1; i++) {
      await recordFailure(p.id);
    }
    const after = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.consecutiveErrors).toBe(ERROR_THRESHOLD - 1);
    expect(after.circuitOpenUntil).toBeNull();
    expect(after.healthStatus).toBe('healthy');
    expect(after.lastErrorAt).not.toBeNull();
  });
});

describe('recordFailure · 达阈值开熔断', () => {
  it(`第 ${ERROR_THRESHOLD} 次失败 → circuitOpenUntil ≈ now+${COOLDOWN_MS}ms · healthStatus=degraded`, async () => {
    const p = await createTestProvider();
    const now = new Date();
    for (let i = 0; i < ERROR_THRESHOLD; i++) {
      await recordFailure(p.id, now);
    }
    const after = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.consecutiveErrors).toBe(ERROR_THRESHOLD);
    expect(after.circuitOpenUntil).not.toBeNull();
    // 允许 1 秒误差（受 DB round-trip 影响）
    const deltaMs = (after.circuitOpenUntil as Date).getTime() - (now.getTime() + COOLDOWN_MS);
    expect(Math.abs(deltaMs)).toBeLessThan(1000);
    expect(after.healthStatus).toBe('degraded');
  });

  it(`超过阈值继续累计 · circuitOpenUntil 每次刷新`, async () => {
    const p = await createTestProvider();
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-01T00:00:30Z');
    for (let i = 0; i < ERROR_THRESHOLD; i++) await recordFailure(p.id, t1);
    const first = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    await recordFailure(p.id, t2);
    const second = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    expect(second.consecutiveErrors).toBe(ERROR_THRESHOLD + 1);
    expect((second.circuitOpenUntil as Date).getTime())
      .toBeGreaterThan((first.circuitOpenUntil as Date).getTime());
  });
});

describe('recordSuccess · 全面复位', () => {
  it('熔断中 · success 应清计数 + 清 circuitOpenUntil + healthy', async () => {
    const p = await createTestProvider();
    for (let i = 0; i < ERROR_THRESHOLD; i++) await recordFailure(p.id);

    const open = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    expect(open.circuitOpenUntil).not.toBeNull();

    await recordSuccess(p.id);
    const after = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.consecutiveErrors).toBe(0);
    expect(after.circuitOpenUntil).toBeNull();
    expect(after.healthStatus).toBe('healthy');
    expect(after.lastSuccessAt).not.toBeNull();
  });

  it('阈值前 success · 立即归零（避免「偶发错+长期累计」假阳性）', async () => {
    const p = await createTestProvider();
    await recordFailure(p.id);
    await recordFailure(p.id); // 2 < threshold(3)
    await recordSuccess(p.id);
    const after = await prisma.llmProviderConfig.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.consecutiveErrors).toBe(0);
  });
});
