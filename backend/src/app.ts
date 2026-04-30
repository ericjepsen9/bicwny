// Fastify 应用工厂
// 组装 CORS / JWT / 全局错误处理 / 路由；
// 测试用例也能通过 buildApp() 拉一个隔离实例。
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { getUserId, jwtOptional } from './lib/auth.js';
import { config, isDev } from './lib/config.js';
import { writeErrorLog } from './lib/error-log.js';
import { attachSentryToFastify, captureError, initSentry } from './lib/sentry.js';
import { isAppError } from './lib/errors.js';
import { genReqId, REQUEST_ID_HEADER } from './lib/request-id.js';
import { registerTimingHooks } from './lib/timing.js';
import { answeringRoutes } from './modules/answering/routes.js';
import { mistakesRoutes } from './modules/answering/mistakes.routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { authSessionsRoutes } from './modules/auth/sessions.routes.js';
import { adminAuditRoutes } from './modules/admin/audit.routes.js';
import { adminContentRoutes } from './modules/admin/content.routes.js';
import { adminLogsRoutes } from './modules/admin/logs.routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminSystemSettingsRoutes } from './modules/admin/system-settings.routes.js';
import { adminClassRoutes } from './modules/class/admin.routes.js';
import { coachClassRoutes } from './modules/class/coach.routes.js';
import { studentClassRoutes } from './modules/class/student.routes.js';
import { coachStatsRoutes } from './modules/coach/routes.js';
import { adminCoursesRoutes } from './modules/courses/admin.routes.js';
import { adminCoursesCoverRoutes } from './modules/courses/cover.routes.js';
import { adminCoursesImportRoutes } from './modules/courses/import.routes.js';
import { favoritesRoutes } from './modules/favorites/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { searchRoutes } from './modules/search/routes.js';
import { learningRoutes } from './modules/learning/routes.js';
import { llmAdminRoutes } from './modules/llm/admin.routes.js';
import { llmScenarioAdminRoutes } from './modules/llm/scenario.admin.routes.js';
import { achievementsRoutes } from './modules/achievements/routes.js';
import { notificationsRoutes } from './modules/notifications/routes.js';
import { pushRoutes } from './modules/push/routes.js';
import { analyticsRoutes } from './modules/analytics/routes.js';
import { experimentsRoutes } from './modules/experiments/routes.js';
import { adminQuestionRoutes } from './modules/questions/admin.routes.js';
import { coachQuestionRoutes } from './modules/questions/coach.routes.js';
import { reportsRoutes } from './modules/reports/routes.js';
import { sm2Routes } from './modules/sm2/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  // 在创建 fastify 实例之前初始化 Sentry · 让所有后续 throw 都被捕获
  initSentry();

  const app = Fastify({
    // Fastify 默认 bodyLimit = 1 MB · admin 法本 commit 的 chapters JSON 可能 3-5 MB
    // 设 25 MB 与 nginx client_max_body_size 一致 · 单文件上限仍由 @fastify/multipart 兜底 20 MB
    bodyLimit: 25 * 1024 * 1024,
    logger: {
      level: isDev ? 'info' : 'warn',
      // 防敏感字段泄漏到日志：refreshToken / token / password / apiKey 一律打码
      // Fastify 默认不记录 body，但启用 reqSerializer + body 日志的部署可能会 → 预防
      redact: {
        paths: [
          'req.body.refreshToken',
          'req.body.password',
          'req.body.newPassword',
          'req.body.currentPassword',
          'req.body.token',
          'req.headers.authorization',
          'req.headers.cookie',
        ],
        censor: '***',
        remove: false,
      },
    },
    // req.id 自动挂到每条 req.log 记录；x-request-id 入站则沿用
    genReqId,
    requestIdHeader: REQUEST_ID_HEADER,
    requestIdLogLabel: 'reqId',
  });

  // 响应回传 x-request-id，客户端可据此反查
  // 同时按方法 + 路径 + 状态加 Cache-Control · 让 webview / CDN 命中本地缓存
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header(REQUEST_ID_HEADER, req.id);
    // 已显式设过的不覆盖（路由内 reply.header('Cache-Control', ...) 优先）
    if (!reply.getHeader('Cache-Control')) {
      const status = reply.statusCode;
      const method = req.method;
      // 仅对 2xx GET 加缓存头 · 其他全部 no-store
      if (method === 'GET' && status >= 200 && status < 300) {
        const url = req.url || '';
        // /api/courses · /api/courses/:slug · /api/my/* 都是用户态数据
        //   private + Vary: Authorization · 防止 CDN 跨用户串
        //   max-age=60s · stale-while-revalidate=300s
        //   首屏体感不会过 stale · 后台静默更新
        if (/^\/api\/(courses|my\/|sm2\/(stats|due)|favorites|mistakes|notifications|achievements)/.test(url)) {
          reply.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
          reply.header('Vary', 'Authorization');
        } else {
          // 其他 GET（包括 /api/health · /api/auth/me 等敏感的）短保险
          reply.header('Cache-Control', 'private, no-cache');
        }
      } else {
        // 写操作 / 4xx 5xx 一律不缓存 · 防止 webview 把错误页缓存住
        reply.header('Cache-Control', 'no-store');
      }
    }
    return payload;
  });

  // CORS：dev 全开；prod 读 CORS_ORIGINS 白名单（逗号分隔）
  // 留空 → 同源部署（nginx 反代）· 不允许任何跨域
  const corsWhitelist = config.CORS_ORIGINS
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: isDev
      ? true
      : corsWhitelist.length > 0
        ? corsWhitelist
        : false,
    credentials: true,
  });

  // 安全 headers：HSTS / X-Frame-Options / X-Content-Type-Options / 等
  // contentSecurityPolicy 默认严格，但 Swagger UI 需要 inline script → dev 关掉，prod 走默认
  await app.register(helmet, {
    contentSecurityPolicy: isDev ? false : undefined,
    crossOriginEmbedderPolicy: false, // 不阻挡跨域资源（前端可能用 CDN）
  });

  // 文件上传 · admin 法本导入用 (PDF / DOCX) · 单文件 20 MB
  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 1,
    },
  });

  // OpenAPI · /openapi.json + /docs
  // 路由通过 schema.* 自描述；未标注的路由仅列出 path+method
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: '觉学 JueXue API',
        description: '觉学学习平台后端 API · 答题 / SM-2 / LLM Gateway / 题库 CRUD',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'dev' },
      ],
      tags: [
        { name: 'Auth', description: '注册 · 登录 · /me · 改密 · 注销' },
        { name: 'Learning', description: '课程 · 课时 · 报名 · 进度' },
        { name: 'Answering', description: '题目 · 提交 · 错题本 · 进度聚合' },
        { name: 'SM-2', description: '记忆卡调度' },
        { name: 'Favorites', description: '题目收藏' },
        { name: 'Reports', description: '题目举报（学员提交）' },
        { name: 'Classes', description: '班级与成员' },
        { name: 'Coach', description: '辅导员侧 CRUD + LLM 造题' },
        { name: 'Admin', description: '管理员审核 / 用户 / 班级 / 大盘 / LLM 管理' },
        { name: 'Notifications', description: '本人站内通知' },
        { name: 'Achievements', description: '本人徽章墙（从答题数据派生）' },
        { name: 'Health', description: '健康检查' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  // 规范位置的 JSON（/docs/json 是 swagger-ui 内部路径，/openapi.json 做别名方便外部消费）
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  // JWT：Sprint 2 接入真登录。全局 onRequest 钩子尝试验签，拿不到也不报错；
  //      路由级用 requireRole / requireUserId 判断
  await app.register(jwt, { secret: config.JWT_SECRET });
  app.addHook('onRequest', jwtOptional);

  // Rate-limit：单租户私有部署（admin guard 已是入口屏障）默认关闭全局限流
  // 公网多租户部署 → 设 GLOBAL_RATE_LIMIT_PER_MIN=600（或更高）启用
  // 路由级限流（如 login / forgot 防暴力破解）仍照常生效（不依赖全局）
  // 测试模式下永远禁用（避免集成测试撞限速）
  const globalLimit = parseInt(process.env.GLOBAL_RATE_LIMIT_PER_MIN || '0', 10);
  if (config.NODE_ENV !== 'test' && globalLimit > 0) {
    await app.register(rateLimit, {
      global: true,
      max: globalLimit,
      timeWindow: '1 minute',
      keyGenerator: (req) => {
        const uid = getUserId(req);
        return uid ? `u:${uid}` : `ip:${req.ip}`;
      },
    });
  } else {
    // 必须 register 一次（哪怕 global:false），否则路由级 config.rateLimit 不生效
    await app.register(rateLimit, { global: false, max: 1_000_000, timeWindow: '1 minute' });
  }

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
        // 仅 5xx AppError 上报 Sentry · 4xx 业务错不上报
        captureError(err, req, {
          code: err.code, statusCode: err.statusCode, details: err.details,
        });
      }
      return reply.code(err.statusCode).send(err.toJSON());
    }

    // fastify 原生 validation 错误 (AJV) — statusCode=400 · code=FST_ERR_VALIDATION
    // OpenAPI 接入后会走这条路径；映射为 BAD_REQUEST 而非 500
    if ((err as { validation?: unknown }).validation) {
      const fe = err as unknown as {
        message: string;
        statusCode?: number;
        validation: unknown;
        validationContext?: string;
      };
      req.log.warn({ validation: fe.validation }, 'validation error');
      return reply.code(fe.statusCode ?? 400).send({
        error: 'BAD_REQUEST',
        message: fe.message,
        details: { context: fe.validationContext, issues: fe.validation },
      });
    }

    req.log.error({ err }, 'Unhandled error');
    const e = err instanceof Error ? err : new Error(String(err));
    writeErrorLog({
      kind: 'error',
      message: e.message,
      stack: e.stack,
      context: baseContext,
      userId,
      requestId,
    });
    // Sentry 捕获 5xx + 未知异常（DSN 没配则 no-op）
    captureError(e, req, { ...baseContext, statusCode: 500 });
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
  await app.register(searchRoutes);

  // 业务路由
  await app.register(authRoutes);
  await app.register(authSessionsRoutes);
  await app.register(adminRoutes);
  await app.register(adminSystemSettingsRoutes);
  await app.register(adminAuditRoutes);
  await app.register(adminContentRoutes);
  await app.register(adminLogsRoutes);
  await app.register(adminClassRoutes);
  await app.register(coachClassRoutes);
  await app.register(studentClassRoutes);
  await app.register(coachStatsRoutes);
  await app.register(coachQuestionRoutes);
  await app.register(adminQuestionRoutes);
  await app.register(llmAdminRoutes);
  await app.register(llmScenarioAdminRoutes);
  await app.register(adminCoursesRoutes);
  await app.register(adminCoursesCoverRoutes);
  await app.register(adminCoursesImportRoutes);
  await app.register(learningRoutes);
  await app.register(favoritesRoutes);
  await app.register(answeringRoutes);
  await app.register(mistakesRoutes);
  await app.register(reportsRoutes);
  await app.register(sm2Routes);
  await app.register(notificationsRoutes);
  await app.register(achievementsRoutes);
  await app.register(pushRoutes);
  await app.register(analyticsRoutes);
  await app.register(experimentsRoutes);

  // shutdown 时把 Sentry buffer flush 出去 · 防止 5xx 没报上去就退出
  attachSentryToFastify(app);

  return app;
}
