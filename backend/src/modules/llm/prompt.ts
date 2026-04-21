// Prompt 模板加载 + 变量替换
// 模板存 DB（LlmPromptTemplate），{{varName}} 占位符运行时替换。
// Sprint 1 不做缓存，Admin 编辑即生效。
import { Internal, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export type PromptVars = Record<string, string | number | boolean | object | null | undefined>;

/** 加载指定 scenario 的 prompt 模板；未指定 version 取 isActive=true 的最新条。 */
export async function loadPromptTemplate(
  scenario: string,
  version?: string,
): Promise<string> {
  if (version) {
    const t = await prisma.llmPromptTemplate.findUnique({
      where: { scenario_version: { scenario, version } },
    });
    if (!t) throw NotFound(`prompt 模板未找到: ${scenario}/${version}`);
    return t.content;
  }

  const t = await prisma.llmPromptTemplate.findFirst({
    where: { scenario, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!t) throw NotFound(`prompt 模板未找到（无启用版本）: ${scenario}`);
  return t.content;
}

/** {{name}} → vars[name]；对象自动 JSON.stringify；缺失变量抛错避免沉默。 */
export function renderPrompt(template: string, vars: PromptVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
    if (!(name in vars)) {
      throw Internal(`prompt 变量缺失: {{${name}}}`);
    }
    const v = vars[name];
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
  });
}
