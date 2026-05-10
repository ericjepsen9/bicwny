// 跨年提醒 banner · 11 月起检测明年首月数据 · 缺则提醒 admin 上传
//   - 11 月之前不查询不渲染
//   - 11/12 月查询次年 1 月 · 数据非空（≥1 天）则隐藏
//   - 数据为空 → 显示倒计时卡 · 点跳 /admin/calendar
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface TibetanDay { date: string }

export default function TibetanYearTransitionBanner() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;
  const enabled = month >= 11;

  const data = useQuery({
    queryKey: ['/api/calendar/month', `${nextYear}-01`],
    queryFn: ({ signal }) => api.get<TibetanDay[]>(`/api/calendar/month/${nextYear}-01`, { signal }),
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 1d
  });

  if (!enabled) return null;
  if (data.isLoading) return null;
  if ((data.data?.length ?? 0) > 0) return null;

  const yearEnd = new Date(currentYear, 11, 31, 23, 59);
  const daysLeft = Math.max(0, Math.ceil((yearEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  return (
    <Link
      to="/admin/calendar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 'var(--sp-4)',
        marginBottom: 'var(--sp-4)',
        borderRadius: 'var(--r-md)',
        background: 'linear-gradient(90deg, var(--saffron-pale), var(--gold-pale))',
        border: '1px solid var(--saffron-light)',
        textDecoration: 'none',
        color: 'var(--ink)',
      }}
    >
      <span style={{ fontSize: '1.4rem' }} aria-hidden>⏰</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--saffron-dark)' }}>
          {nextYear} 年藏历未准备
        </div>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>
          还有 {daysLeft} 天跨年 · 库里 0 天 {nextYear} 年数据 · 发图给 Claude 生成 JSON 后从此页上传
        </div>
      </div>
      <span style={{ color: 'var(--ink-4)', fontSize: '1.1rem' }}>›</span>
    </Link>
  );
}
