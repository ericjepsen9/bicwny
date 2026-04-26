// 错误 / 慢请求 / 慢查询 持久化（ErrorLog 表）
// Fire-and-forget：失败只打 console.warn，永不阻塞或异常冒泡。
// message 截 2000 字，stack 截 4000 字，防止巨型错误淹 DB。
import { Prisma, type LogKind } from '@prisma/client';
import { prisma } from './prisma.js';

const MESSAGE_MAX = 2000;
const STACK_MAX = 4000;

export interface ErrorLogInput {
  kind: LogKind;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

export function writeErrorLog(input: ErrorLogInput): void {
  void (async () => {
    try {
      await prisma.errorLog.create({
        data: {
          kind: input.kind,
          message: truncate(input.message, MESSAGE_MAX),
          stack: input.stack ? truncate(input.stack, STACK_MAX) : null,
          context:
            input.context !== undefined
              ? (input.context as Prisma.InputJsonValue)
              : Prisma.DbNull,
          userId: input.userId ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch (e) {
      console.warn(
        '[error-log] 写入失败（已忽略）:',
        e instanceof Error ? e.message : e,
      );
    }
  })();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
