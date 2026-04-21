// Fastify 应用工厂
// 组装 CORS / JWT / 全局错误处理 / 路由；
// 测试用例也能通过 buildApp() 拉一个隔离实例。
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { jwtOptional } from './lib/auth.js';
import { config, isDev } from './lib/config.js';
import { isAppError } from './lib/errors.js';
import { answeringRoutes } from './modules/answering/routes.js';
import { mistakesRoutes } from './modules/answering/mistakes.routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { adminClassRoutes } from './modules/class/admin.routes.js';
import { coachClassRoutes } from './modules/class/coach.routes.js';
import { studentClassRoutes } from './modules/class/student.routes.js';
import { coachStatsRoutes } from './modules/coach/routes.js';
import { favoritesRoutes } from './modules/favorites/routes.js';
import { learningRoutes } from './modules/learning/routes.js';
import { adminQuestionRoutes } from './modules/questions/admin.routes.js';
import { coachQuestionRoutes } from './modules/questions/coach.routes.js';
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

  // JWT：Sprint 2 接入真登录。全局 onRequest 钩子尝试验签，拿不到也不报错；
  //      路由级用 requireRole / requireUserId 判断
  await app.register(jwt, { secret: config.JWT_SECRET });
  app.addHook('onRequest', jwtOptional);

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
  await app.register(authRoutes);
  await app.register(adminClassRoutes);
  await app.register(coachClassRoutes);
  await app.register(studentClassRoutes);
  await app.register(coachStatsRoutes);
  await app.register(coachQuestionRoutes);
  await app.register(adminQuestionRoutes);
  await app.register(learningRoutes);
  await app.register(favoritesRoutes);
  await app.register(answeringRoutes);
  await app.register(mistakesRoutes);
  await app.register(sm2Routes);

  return app;
}
