// Vitest 运行前置：加载 .env 以便 Prisma / config 拿到 DATABASE_URL 等
// dotenv 不覆盖已有 env，生产/CI 注入的变量优先级更高
import 'dotenv/config';
