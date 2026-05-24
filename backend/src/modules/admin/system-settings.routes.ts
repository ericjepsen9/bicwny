// Admin 系统设置路由（全部 admin guard）
//   GET  /api/admin/system/scraper-via  → { value: 'local' | 'asia', relayConfigured: boolean }
//   PUT  /api/admin/system/scraper-via  body: { value: 'local' | 'asia' }
//
// 法本抓取出口切换：
//   - local：本服务器 fetch（现有行为；被站方封 IP 时不可用）
//   - asia：经亚洲中转节点 fetch（需要 ASIA_RELAY_URL / ASIA_RELAY_TOKEN 已配置）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole, requireUserId } from '../../lib/auth.js';
import { config } from '../../lib/config.js';
import { BadRequest } from '../../lib/errors.js';
import { getSetting, setSetting } from './system-settings.service.js';

const adminGuard = requireRole('admin');

const fetchViaBody = z.object({
  value: z.enum(['local', 'asia']),
});

const TAGS = ['Admin'];
const SEC = [{ bearerAuth: [] as string[] }];

function isRelayConfigured(): boolean {
  return Boolean(config.ASIA_RELAY_URL && config.ASIA_RELAY_TOKEN);
}

export const adminSystemSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/system/scraper-via', {
    preHandler: adminGuard,
    schema: {
      tags: TAGS,
      summary: '读取法本抓取出口节点（local / asia）+ 中转配置状态',
      security: SEC,
    },
  }, async () => {
    const value = await getSetting('scraper.fetchVia');
    return { data: { value, relayConfigured: isRelayConfigured() } };
  });

  app.put('/api/admin/system/scraper-via', {
    preHandler: adminGuard,
    schema: {
      tags: TAGS,
      summary: '切换法本抓取出口节点（local / asia）· 写 AuditLog',
      security: SEC,
    },
  }, async (req) => {
    const parsed = fetchViaBody.safeParse(req.body);
    if (!parsed.success) throw BadRequest('参数不合法', parsed.error.flatten());

    // 切到 asia 但 relay 未配置 → 拒绝（避免 admin 切完发现无法抓取）
    if (parsed.data.value === 'asia' && !isRelayConfigured()) {
      throw BadRequest(
        '亚洲中转节点未配置：请先在服务端 .env 设置 ASIA_RELAY_URL 与 ASIA_RELAY_TOKEN',
      );
    }

    const adminId = requireUserId(req);
    await setSetting('scraper.fetchVia', parsed.data.value, adminId);
    return { data: { value: parsed.data.value, relayConfigured: isRelayConfigured() } };
  });
};
