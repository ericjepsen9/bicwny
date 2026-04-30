// 健康检查（公开，无需鉴权 —— 供 uptime monitor 访问）
//   GET /health              简易 { ok, env }
//   GET /health/detailed     DB ping + LLM providers 健康 + 内存 + uptime
// 只返公开字段（不泄漏 API Key / quota 具体值等敏感项）
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';

const TAGS = ['Health'];

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', {
    schema: { tags: TAGS, summary: '简易健康检查（公开）' },
  }, async () => ({ ok: true, env: config.NODE_ENV }));

  // 公开配置 · 前端 boot 时拉一次 · 用来配 Sentry / 其他客户端监控
  // 不暴露任何 secret · DSN 暴露给前端是 Sentry 设计支持的（throttle 在服务端做）
  app.get('/api/config/public', {
    schema: { tags: TAGS, summary: '前端公开配置（Sentry DSN 等）' },
  }, async () => ({
    data: {
      sentryDsn: config.SENTRY_DSN_FRONTEND || null,
      sentryEnv: config.NODE_ENV,
      sentryRelease: config.SENTRY_RELEASE,
    },
  }));

  app.get('/health/detailed', {
    schema: { tags: TAGS, summary: '详细健康检查：DB ping + LLM providers + 内存 + uptime' },
  }, async () => {
    const [dbOk, providers] = await Promise.all([pingDb(), providerHealth()]);
    const mem = process.memoryUsage();
    return {
      ok: dbOk && providers.every((p) => !p.isDown),
      env: config.NODE_ENV,
      uptimeSec: Math.round(process.uptime()),
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
      },
      db: { ok: dbOk },
      llm: { providers },
      checkedAt: new Date().toISOString(),
    };
  });
};

async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

interface ProviderSnapshot {
  name: string;
  role: string;
  isEnabled: boolean;
  healthStatus: string;
  circuitOpen: boolean;
  isDown: boolean;
}

async function providerHealth(): Promise<ProviderSnapshot[]> {
  const now = new Date();
  try {
    const list = await prisma.llmProviderConfig.findMany({
      select: {
        name: true,
        role: true,
        isEnabled: true,
        healthStatus: true,
        circuitOpenUntil: true,
      },
    });
    return list.map((p) => {
      const circuitOpen = !!p.circuitOpenUntil && p.circuitOpenUntil > now;
      return {
        name: p.name,
        role: p.role,
        isEnabled: p.isEnabled,
        healthStatus: p.healthStatus,
        circuitOpen,
        isDown:
          !p.isEnabled || p.healthStatus === 'down' || circuitOpen,
      };
    });
  } catch {
    return [];
  }
}
