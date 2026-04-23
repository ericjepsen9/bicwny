// OpenAPI · zod → JSON Schema 辅助
// fastify schema.* 接受 JSON Schema；zod-to-json-schema 做无损转换。
// 用法：
//   import { z } from 'zod';
//   import { zBody, zQuery, zParams, zResponse } from '../../lib/openapi.js';
//   app.post('/x', { schema: { body: zBody(bodySchema), ... } }, handler);
// 既给 fastify 做参数校验，也给 @fastify/swagger 生成文档。
import type { FastifySchema } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type JsonSchema = NonNullable<FastifySchema['body']>;

function toSchema(schema: ZodTypeAny): JsonSchema {
  // zod-to-json-schema 默认包含 $schema + definitions，这里用 target openApi3 生成兼容形态
  const js = zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
  // 去掉顶层 $schema 避免 AJV 误警告
  // biome-ignore lint: 运行时类型
  delete (js as Record<string, unknown>).$schema;
  return js as JsonSchema;
}

export const zBody = toSchema;
export const zQuery = toSchema;
export const zParams = toSchema;

/** 成功返回（200 OK）的 envelope：{ data: T }；传入 T 的 zod schema */
export function zResponse(schema: ZodTypeAny): JsonSchema {
  return {
    type: 'object',
    properties: { data: toSchema(schema) },
    required: ['data'],
  } as JsonSchema;
}
