// ClassMeditationRankingPage · /class/:id/meditations
//   班级观修排行 · 周 / 月 / 全部 切换 · 后端按次数 desc → 时长 desc 排序

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { type MeditationRankingPeriod, useClassMeditationRanking } from '@/lib/queries';

export default function ClassMeditationRankingPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const classId = id || '';
  const { user } = useAuth();
  const [period, setPeriod] = useState<MeditationRankingPeriod>('month');
  const ranking = useClassMeditationRanking(classId || null, period);

  return (
    <div style={{ padding: 'var(--sp-3)' }}>
      {/* 顶部 · 返回 + 标题 + 周期切换 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <Link
          to={`/class/${classId}`}
          style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', textDecoration: 'none', fontSize: 22 }}
          aria-label={s('返回', '返回', 'Back')}
        >
          ←
        </Link>
        <h1 style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 1.5, margin: 0 }}>
          🧘 {s('班级观修排行', '班級觀修排行', 'Class meditation ranking')}
        </h1>
      </div>

      {/* 周期切换 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-3)' }}>
        {(['week', 'month', 'all'] as MeditationRankingPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className="btn btn-pill"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: period === p ? 'var(--saffron)' : 'var(--glass-thick)',
              color: period === p ? '#fff' : 'var(--ink-2)',
              border: '1px solid var(--glass-border)',
              font: 'var(--text-caption)',
              fontWeight: 700,
              letterSpacing: 1,
              justifyContent: 'center',
            }}
          >
            {p === 'week' && s('本周', '本週', 'Week')}
            {p === 'month' && s('本月', '本月', 'Month')}
            {p === 'all' && s('全部', '全部', 'All')}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {ranking.isLoading ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <Skeleton.List />
        </div>
      ) : !ranking.data || ranking.data.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-7)', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>🧘</div>
          {(ranking.error as ApiError | undefined)?.message ?? s('暂无观修记录', '暫無觀修記錄', 'No meditation records yet')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {ranking.data.map((row, i) => {
            const isMe = row.userId === user?.id;
            const m = Math.floor(row.totalSec / 60);
            const h = Math.floor(m / 60);
            const minLabel = h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <div
                key={row.userId}
                className="glass-card-thick"
                style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  background: isMe ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                  border: '1px solid ' + (isMe ? 'var(--saffron-light)' : 'var(--glass-border)'),
                  borderLeft: isMe ? '4px solid var(--saffron)' : undefined,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: i < 3 ? 'var(--saffron)' : 'var(--glass)',
                  color: i < 3 ? '#fff' : 'var(--ink-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem',
                  flexShrink: 0,
                }}>
                  {medal ?? i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1, fontSize: '.9375rem' }}>
                    {row.dharmaName || s('（无法名）', '（無法名）', '(no name)')}
                    {isMe && <span style={{ marginLeft: 8, font: 'var(--text-caption)', color: 'var(--saffron-dark)' }}>· {s('我', '我', 'me')}</span>}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
                    {row.count} {s('次', '次', 'times')} · {minLabel}
                  </div>
                </div>
                <div style={{
                  font: 'var(--text-caption)',
                  fontWeight: 700,
                  color: i < 3 ? 'var(--saffron-dark)' : 'var(--ink-3)',
                  letterSpacing: 1,
                }}>
                  {row.count}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 隐私提示 */}
      <div style={{ marginTop: 'var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, lineHeight: 1.6, textAlign: 'center' }}>
        {s(
          '默认开放给同班 · 可在 [设置 → 隐私] 关闭',
          '默認開放給同班 · 可在 [設置 → 隱私] 關閉',
          'Visible to classmates by default · turn off in Settings → Privacy',
        )}
      </div>
    </div>
  );
}
