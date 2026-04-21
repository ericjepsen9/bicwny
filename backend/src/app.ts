// Fastify 应用工厂
// 组装 CORS / JWT / 全局错误处理 / 路由；
// 测试用例也能通过 buildApp() 拉一个隔离实例。
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { getUserId, jwtOptional } from './lib/auth.js';
import { config, isDev } from './lib/config.js';
import { writeErrorLog } from './lib/error-log.js';
import { isAppError } from './lib/errors.js';
import { genReqId, REQUEST_ID_HEADER } from './lib/request-id.js';
import { registerTimingHooks } from './lib/timing.js';
import { answeringRoutes } from './modules/answering/routes.js';
import { mistakesRoutes } from './modules/answering/mistakes.routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { adminAuditRoutes } from './modules/admin/audit.routes.js';
import { adminLogsRoutes } from './modules/admin/logs.routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminClassRoutes } from './modules/class/admin.routes.js';
import { coachClassRoutes } from './modules/class/coach.routes.js';
import { studentClassRoutes } from './modules/class/student.routes.js';
import { coachStatsRoutes } from './modules/coach/routes.js';
import { favoritesRoutes } from './modules/favorites/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { learningRoutes } from './modules/learning/routes.js';
import { llmAdminRoutes } from './modules/llm/admin.routes.js';
import { llmScenarioAdminRoutes } from './modules/llm/scenario.admin.routes.js';
import { adminQuestionRoutes } from './modules/questions/admin.routes.js';
import { coachQuestionRoutes } from './modules/questions/coach.routes.js';
import { reportsRoutes } from './modules/reports/routes.js';
import { sm2Routes } from './modules/sm2/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: isDev ? 'info' : 'warn' },
    // req.id 自动挂到每条 req.log 记录；x-request-id 入站则沿用
    genReqId,
    requestIdHeader: REQUEST_ID_HEADER,
    requestIdLogLabel: 'reqId',
  });

  // 响应回传 x-request-id，客户端可据此反查
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header(REQUEST_ID_HEADER, req.id);
    return payload;
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

  // jwtOptional 之后：把 userId 挂到 req.log 的 child 上
  app.addHook('onRequest', async (req) => {
    const uid = getUserId(req);
    if (uid) req.log = req.log.child({ userId: uid });
  });

  // 请求耗时 + 慢请求告警（onResponse 阶段）
  registerTimingHooks(app);

  // 全局错误处理 · 5xx / 未捕获异常异步落 ErrorLog（4xx 用户错不落库避免刷屏）
  app.setErrorHandler((err, req, reply) => {
    const userId = getUserId(req) ?? undefined;
    const requestId = String(req.id);
    const baseContext = { method: req.method, url: req.url };

    if (isAppError(err)) {
      req.log.warn({ code: err.code, message: err.message }, 'AppError');
      if (err.statusCode >= 500) {
        writeErrorLog({
          kind: 'error',
          message: err.message,
          stack: err.stack,
          context: {
            ...baseContext,
            code: err.code,
            statusCode: err.statusCode,
            details: err.details,
          },
          userId,
          requestId,
        });
      }
      return reply.code(err.statusCode).send(err.toJSON());
    }

    req.log.error({ err }, 'Unhandled error');
    writeErrorLog({
      kind: 'error',
      message: err.message ?? String(err),
      stack: err.stack,
      context: baseContext,
      userId,
      requestId,
    });
    return reply
      .code(500)
      .send({ error: 'INTERNAL', message: '服务内部错误' });
  });

  app.setNotFoundHandler((req, reply) => {
    reply
      .code(404)
      .send({ error: 'NOT_FOUND', message: `路径不存在: ${req.url}` });
  });

  // 健康检查（公开，支持 /health/detailed）
  await app.register(healthRoutes);

  // 业务路由
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(adminAuditRoutes);
  await app.register(adminLogsRoutes);
  await app.register(adminClassRoutes);
  await app.register(coachClassRoutes);
  await app.register(studentClassRoutes);
  await app.register(coachStatsRoutes);
  await app.register(coachQuestionRoutes);
  await app.register(adminQuestionRoutes);
  await app.register(llmAdminRoutes);
  await app.register(llmScenarioAdminRoutes);
  await app.register(learningRoutes);
  await app.register(favoritesRoutes);
  await app.register(answeringRoutes);
  await app.register(mistakesRoutes);
  await app.register(reportsRoutes);
  await app.register(sm2Routes);

  return app;
}
