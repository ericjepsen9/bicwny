// Prisma Client 单例 + 慢查询日志
// - 开发模式挂 globalThis，避免 tsx --watch 热重载泄漏连接
// - 监听 query 事件：耗时 >= SLOW_QUERY_MS 打 warn
//   日志不含 reqId（Prisma 层不感知调用方），但 SQL 前 200 字 + 耗时足够定位
//
// 连接池 / 超时 / 断线恢复（生产部署 checklist）：
//   通过 DATABASE_URL query 参数配置：
//     ?connect_timeout=5            连接建立超时（默认 5s）
//     ?pool_timeout=10              池里取连接超时（默认 10s）
//     ?connection_limit=10          单 client 最大连接数（默认 num_cpus*2+1）
//     ?statement_timeout=30000      单条 SQL 上限 30s（PG 服务端强制，慢查询直接 abort）
//   Prisma 自身不重试连接断开，依赖应用层重试 / 健康检查重启 pod
//   建议在生产 .env：
//     DATABASE_URL=postgresql://.../db?connect_timeout=5&pool_timeout=10&statement_timeout=30000
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
    if (e.duration < SLOW_QUERY_MS) return;

    const preview = truncate(e.query, QUERY_PREVIEW);
    console.warn(
      JSON.stringify({
        level: 'warn',
        kind: 'slow_query',
        durationMs: e.duration,
        query: preview,
        paramsLen: e.params?.length ?? 0,
        timestamp: e.timestamp,
      }),
    );

    // 防递归：写 ErrorLog 本身的 INSERT 不再回写 ErrorLog
    if (!e.query.includes('"ErrorLog"')) {
      // 延迟导入避免顶层循环引用
      import('./error-log.js')
        .then(({ writeErrorLog }) => {
          writeErrorLog({
            kind: 'slow_query',
            message: `slow query ${e.duration}ms`,
            context: {
              durationMs: e.duration,
              query: preview,
              paramsLen: e.params?.length ?? 0,
            },
          });
        })
        .catch(() => {
          /* ignore */
        });
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

/**
 * 包装 Serializable 事务：遇 P2034（序列化失败 / 写冲突 / 死锁）自动重试。
 * 多处 Serializable 事务的注释承诺「让一方 abort 重试」· 此处兑现。
 * 默认最多重试 3 次（共 4 次尝试）· 退避带抖动避免活锁。
 */
export async function withSerializableRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as Prisma.PrismaClientKnownRequestError)?.code;
      if (code === 'P2034' && attempt < retries) {
        await new Promise((r) => setTimeout(r, 10 * (attempt + 1) + Math.random() * 10));
        continue;
      }
      throw e;
    }
  }
}
