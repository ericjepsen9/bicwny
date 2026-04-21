// Prisma Client 单例 + 慢查询日志
// - 开发模式挂 globalThis，避免 tsx --watch 热重载泄漏连接
// - 监听 query 事件：耗时 >= SLOW_QUERY_MS 打 warn
//   日志不含 reqId（Prisma 层不感知调用方），但 SQL 前 200 字 + 耗时足够定位
import { PrismaClient, type Prisma } from '@prisma/client';

const SLOW_QUERY_MS = 500;
const QUERY_PREVIEW = 200;

const isProd = process.env.NODE_ENV === 'production';

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'warn' },
      { emit: 'stdout', level: 'error' },
    ],
  });

  client.$on('query', (e: Prisma.QueryEvent) => {
    if (e.duration >= SLOW_QUERY_MS) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          kind: 'slow_query',
          durationMs: e.duration,
          query: truncate(e.query, QUERY_PREVIEW),
          paramsLen: e.params?.length ?? 0,
          timestamp: e.timestamp,
        }),
      );
    }
  });

  return client;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (!isProd) {
  globalForPrisma.prisma = prisma;
}
