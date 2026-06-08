// Admin / 用户富文本输入清洗
//   - referenceText / teachingSummary / 其他长文本字段保存前过这一层
//   - 前端用 escapeHtml 渲染（HTML 字面化）· 后端这层是 defense in depth
//   - 控制字符（除 \n \t）→ 空格 · 防 ANSI / 终端控制序列在日志或后续处理时影响
//   - 末尾空白 trim · 防止只有空白的'非空'内容
//   - 不剥 HTML tag · 因为内容会被前端转义渲染 · 显式存为字面比偷偷剥更可审计

const CTRL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

export function sanitizeRichText(input: string | null | undefined): string | null {
  if (input == null) return null;
  const cleaned = input.replace(CTRL_CHARS, ' ').replace(/\s+$/u, '');
  return cleaned.length > 0 ? cleaned : null;
}

// 短文本（标题等）· 不允许换行 · trim · 限长由 zod 控制
export function sanitizeTitle(input: string): string {
  return input.replace(CTRL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}
