// 服务器启动入口
// 构建 app → listen → 启动调度器 → 绑定优雅停机信号 → 兜底未捕获异常。
import { buildApp } from './app.js';
import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { startScheduler, stopScheduler } from './modules/scheduler/cron.js';

const app = await buildApp();

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error({ err }, '启动失败');
  process.exit(1);
}

// 生产无 Sentry DSN = 5xx 只落库无人主动告警（审计 4.3）· 启动时大声提醒，避免静默裸奔
if (config.NODE_ENV === 'production' && !config.SENTRY_DSN_BACKEND) {
  app.log.warn('SENTRY_DSN_BACKEND 未配置 · 5xx/未捕获异常无主动告警（仅落 ErrorLog 表）· 强烈建议配置');
}

// 启动通知调度器（每 60s tick · 推送 ClassSession 三档提醒）
// env CRON_ENABLED=false 时 no-op
startScheduler(prisma);

// 优雅停机：SIGTERM / SIGINT
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    app.log.info({ sig }, '收到停机信号，开始关闭…');
    try {
      stopScheduler();
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, '关闭过程出错');
      process.exit(1);
    }
  });
}

// 兜底：进程级未捕获异常不静默退出
process.on('uncaughtException', (err) => {
  app.log.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  app.log.fatal({ reason }, 'unhandledRejection');
  process.exit(1);
});
