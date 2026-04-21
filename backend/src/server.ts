// 服务器启动入口
// 构建 app → listen → 绑定优雅停机信号 → 兜底未捕获异常。
import { buildApp } from './app.js';
import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';

const app = await buildApp();

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error({ err }, '启动失败');
  process.exit(1);
}

// 优雅停机：SIGTERM / SIGINT
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    app.log.info({ sig }, '收到停机信号，开始关闭…');
    try {
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
