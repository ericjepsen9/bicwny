// 示范账号：admin · coach · student
// 密码用 hashPassword 生成，生产环境请改密码。
// Sprint 1 的 dev_user_001 保留为无密码 student，继续走 dev 回退。
import type { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../../src/modules/auth/hash.js';

interface DemoAccount {
  id: string;
  email: string;
  dharmaName: string;
  role: UserRole;
  password: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'user_admin_001',
    email: 'admin@juexue.app',
    dharmaName: '管理员',
    role: 'admin',
    password: 'admin123456',
  },
  {
    id: 'user_coach_001',
    email: 'coach@juexue.app',
    dharmaName: '示范辅导员',
    role: 'coach',
    password: 'coach123456',
  },
  {
    id: 'user_student_001',
    email: 'student@juexue.app',
    dharmaName: '示范学员',
    role: 'student',
    password: 'student12345',
  },
];

export async function seedAccounts(prisma: PrismaClient) {
  for (const a of DEMO_ACCOUNTS) {
    const passwordHash = await hashPassword(a.password);
    await prisma.user.upsert({
      where: { id: a.id },
      update: {}, // 幂等：已存在则不覆盖密码
      create: {
        id: a.id,
        email: a.email,
        dharmaName: a.dharmaName,
        role: a.role,
        passwordHash,
      },
    });
  }
  console.log(`  ✓ ${DEMO_ACCOUNTS.length} demo accounts (admin / coach / student)`);
}
