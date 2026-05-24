// 日志保留清理（审计 · 监控盲区②）
//   ErrorLog（含高频 slow_query/slow_request）+ NotificationDispatchLog 只增不删 → 无限膨胀。
//   每 24h 跑一次 deleteMany 清理过期行。
//   AuditLog 单独旋钮 · 默认永不自动删（合规留痕）· 需要时设 AUDIT_RETENTION_DAYS 启用。
//
//   env：
//     LOG_RETENTION_DAYS    默认 30 · ErrorLog + DispatchLog 保留天数（<=0 关闭）
//     AUDIT_RETENTION_DAYS  默认 0  · AuditLog 保留天数（0 = 永不删 · 归档由运维离线处理）
import type { PrismaClient } from '@prisma/client';
import { reportJobError } from './job-monitor.js';

const DAY_MS = 86_400_000;

export async function pruneOldLogs(prisma: PrismaClient): Promise<void> {
  const logDays = parseInt(process.env.LOG_RETENTION_DAYS || '30', 10);
  const auditDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '0', 10);
  const now = Date.now();

  if (logDays > 0) {
    const cutoff = new Date(now - logDays * DAY_MS);
    try {
      // DispatchLog 用 pushedAt · ErrorLog 用 createdAt
      const [el, dl] = await Promise.all([
        prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        prisma.notificationDispatchLog.deleteMany({ where: { pushedAt: { lt: cutoff } } }),
      ]);
      if (el.count > 0 || dl.count > 0) {
        console.log(`[log-retention] pruned ErrorLog=${el.count} DispatchLog=${dl.count} (>${logDays}d)`);
      }
    } catch (e) {
      reportJobError('log-retention', 'prune ErrorLog/DispatchLog failed', e, { logDays });
    }
  }

  if (auditDays > 0) {
    const cutoff = new Date(now - auditDays * DAY_MS);
    try {
      const al = await prisma.auditLog.deleteMany({ where: { timestamp: { lt: cutoff } } });
      if (al.count > 0) console.log(`[log-retention] pruned AuditLog=${al.count} (>${auditDays}d)`);
    } catch (e) {
      reportJobError('log-retention', 'prune AuditLog failed', e, { auditDays });
    }
  }
}
