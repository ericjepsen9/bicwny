// 环境变量加载 + Zod 校验 + 类型化 config 对象
// 启动时若必需变量缺失会直接 exit，避免半死不活的运行状态。
import 'dotenv/config';
import { z } from 'zod';

const PLACEHOLDER_JWT_SECRETS = new Set([
  'dev_secret_replace_in_production',
  'replace_me_in_production',
  'change_me',
  'secret',
]);

// 把 .env 里写了 KEY= 的空字符串预处理成 undefined，让 .optional() 真正生效
// （否则 z.string().url() 收到 "" 会报「Invalid url」拒绝启动）
for (const k of Object.keys(process.env)) {
  if (process.env[k] === '') delete process.env[k];
}

const envSchema = z
  .object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1).default('dev_secret_replace_in_production'),

  // MiniMax（主通路）—— 缺省则 Gateway 健康检查会把它标为 down
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_GROUP_ID: z.string().optional(),
  MINIMAX_BASE_URL: z.string().url().default('https://api.minimax.chat/v1'),
  MINIMAX_MODEL: z.string().default('abab6.5s-chat'),

  // Claude（兜底）—— 缺省则仅用主通路，额度耗尽后无兜底
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5'),

  // LLM Gateway 阈值（DB 配置优先，env 仅兜底默认）
  LLM_YEARLY_RESERVE_PERCENT: z.coerce.number().min(0).max(100).default(5),
  LLM_FALLBACK_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(200),

  // CORS 白名单（逗号分隔；仅生产生效；dev 默认放行所有 origin）
  // 例：CORS_ORIGINS=https://app.example.com,https://admin.example.com
  CORS_ORIGINS: z.string().default(''),

  // 法本抓取：亚洲中转节点（admin 后台可切换出口为 local / asia）
  // 缺省 → 后台 settings 选 asia 时直接报错（避免静默走错路径）
  ASIA_RELAY_URL: z.string().url().optional(),
  ASIA_RELAY_TOKEN: z.string().min(16).optional(),

  // Dev 专用：Sprint 1 尚无真登录，直接注入 fake user id
  DEV_FAKE_USER_ID: z.string().default('dev_user_001'),

  // Web Push (VAPID) · 浏览器 + Capacitor WebView 推送通知
  // 用 `npx web-push generate-vapid-keys` 生成（一次性 · 永久使用）
  // 缺省时推送 API 报 NOT_CONFIGURED · 不影响其他功能
  // VAPID_SUBJECT 必须是 mailto: 或 https:// URI · 邮件最常见
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@juexue.local'),
  })
  // 生产强制 JWT_SECRET ≥ 32 字节 + 不能是占位值 → 启动时拒绝弱密钥
  .refine(
    (env) => {
      if (env.NODE_ENV !== 'production') return true;
      if (env.JWT_SECRET.length < 32) return false;
      if (PLACEHOLDER_JWT_SECRETS.has(env.JWT_SECRET)) return false;
      return true;
    },
    {
      message:
        'JWT_SECRET 在生产环境必须 ≥ 32 字节随机字符串且不得为占位值（用 `openssl rand -base64 48` 生成）',
      path: ['JWT_SECRET'],
    },
  );

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:\n',
    JSON.stringify(parsed.error.format(), null, 2),
  );
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;

export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
