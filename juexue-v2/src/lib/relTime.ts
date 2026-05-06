// 相对时间格式化 · "刚刚 / 5分前 / 3时前 / 2天前 / yyyy-mm-dd"
//   - 调用方传入 s(sc, tc, en?) 让中英文一致
//   - 之前 5 个页面各复制一份的 relTime · 现在统一这里
//
// 用法：
//   const { s } = useLang();
//   relTime(iso, s);
type S = (sc: string, tc: string, en?: string) => string;

export function relTime(iso: string, s: S): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return s('刚刚', '剛剛', 'Just now');
  if (m < 60) return s(m + '分前', m + '分前', m + ' min ago');
  const h = Math.floor(m / 60);
  if (h < 24) return s(h + '时前', h + '時前', h + 'h ago');
  const d = Math.floor(h / 24);
  if (d < 30) return s(d + '天前', d + '天前', d + 'd ago');
  return new Date(iso).toLocaleDateString();
}
