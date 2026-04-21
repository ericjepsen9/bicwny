// Fastify 应用工厂
// 组装 CORS / JWT / 全局错误处理 / 路由；
// 测试用例也能通过 buildApp() 拉一个隔离实例。
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { config, isDev } from './lib/config.js';
import { isAppError } from './lib/errors.js';
import { answeringRoutes } from './modules/answering/routes.js';
import { sm2Routes } from './modules/sm2/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: isDev ? 'info' : 'warn' },
  });

  // CORS：dev 全开；prod 走白名单（Sprint 5 接入 CORS_ORIGINS env）
  await app.register(cors, {
    origin: isDev ? true : false,
    credentials: true,
  });

  // JWT：Sprint 1 仅声明 secret；真登录 + preHandler 在 Sprint 5 接入
  await app.register(jwt, { secret: config.JWT_SECRET });

  // 全局错误处理
  app.setErrorHandler((err, req, reply) => {
    if (isAppError(err)) {
      req.log.warn({ code: err.code, message: err.message }, 'AppError');
      return reply.code(err.statusCode).send(err.toJSON());
    }
    req.log.error({ err }, 'Unhandled error');
    return reply
      .code(500)
      .send({ error: 'INTERNAL', message: '服务内部错误' });
  });

  app.setNotFoundHandler((req, reply) => {
    reply
      .code(404)
      .send({ error: 'NOT_FOUND', message: `路径不存在: ${req.url}` });
  });

  // 健康检查
  app.get('/health', async () => ({ ok: true, env: config.NODE_ENV }));

  // 业务路由
  await app.register(answeringRoutes);
  await app.register(sm2Routes);

  return app;
}
