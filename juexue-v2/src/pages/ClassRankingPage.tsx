// ClassRankingPage · /class/:id/ranking
//   班级综合修学排行 · 周/月/全部 + 综合/念诵/观修 双 tab
//
// 综合 tab：积分制 · 后端 calc score 已排好序 · 副行显示 4 维度
// 念诵 tab：仅按 chanting desc 排
// 观修 tab：仅按 meditationCount desc 排（次数 + 时长 hint）
//
// 入口：班级页 · 主修页 · 个人 dossier 等
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { type StudyRankingPeriod, type StudyRankingRow, useClassStudyRanking } from '@/lib/queries';

type Dim = 'comprehensive' | 'chanting' | 'meditation';

export default function ClassRankingPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const classId = id || '';
  const { user } = useAuth();
  const [period, setPeriod] = useState<StudyRankingPeriod>('week');
  const [dim, setDim] = useState<Dim>('comprehensive');
  const ranking = useClassStudyRanking(classId || null, period);

  // 按 dim 重新排序（后端已按 score desc · comprehensive 直接用 · 其他重排）
  const sorted = useMemo(() => {
    const data = ranking.data ?? [];
    if (dim === 'comprehensive') return data;
    return [...data].sort((a, b) => {
      if (dim === 'chanting') return b.breakdown.chanting - a.breakdown.chanting;
      // meditation: 先按次数 · 再按时长
      const ca = a.breakdown.meditationCount;
      const cb = b.breakdown.meditationCount;
      if (cb !== ca) return cb - ca;
      return b.breakdown.meditationMin - a.breakdown.meditationMin;
    });
  }, [ranking.data, dim]);

  return (
    <div>
      <TopNav titles={['班级修学排行', '班級修學排行', 'Ranking']} />
      <div style={{ padding: 'var(--sp-3)' }}>

      {/* dim tab */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-light)', marginBottom: 'var(--sp-3)' }}>
        {(['comprehensive', 'chanting', 'meditation'] as Dim[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDim(d)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: dim === d ? '2px solid var(--saffron-dark)' : '2px solid transparent',
              color: dim === d ? 'var(--saffron-dark)' : 'var(--ink-3)',
              fontWeight: dim === d ? 700 : 400,
              cursor: 'pointer',
              letterSpacing: 2,
              font: 'var(--text-body)',
            }}
          >
            {d === 'comprehensive' && s('综合', '綜合', 'All')}
            {d === 'chanting' && s('念诵', '念誦', 'Chant')}
            {d === 'meditation' && s('观修', '觀修', 'Med')}
          </button>
        ))}
      </div>

      {/* period 切换 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-3)' }}>
        {(['week', 'month', 'all'] as StudyRankingPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className="btn btn-pill"
            style={{
              flex: 1,
              padding: '6px 10px',
              background: period === p ? 'var(--saffron)' : 'var(--glass-thick)',
              color: period === p ? '#fff' : 'var(--ink-2)',
              border: '1px solid var(--glass-border)',
              font: 'var(--text-caption)',
              fontWeight: 700,
              letterSpacing: 1,
              fontSize: '0.75rem',
              justifyContent: 'center',
            }}
          >
            {p === 'week' && s('本周', '本週', 'Week')}
            {p === 'month' && s('本月', '本月', 'Month')}
            {p === 'all' && s('全部', '全部', 'All')}
          </button>
        ))}
      </div>

      {/* 综合 tab 时 · 顶部说明积分公式 */}
      {dim === 'comprehensive' && (
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginBottom: 'var(--sp-3)', lineHeight: 1.6 }}>
          {s(
            '积分 = 念诵 ×0.01 + 观修次 ×5 + 观修分钟 ×0.1 + 答题 ×0.5 + 阅读完成 ×2 + 活跃天数 ×1',
            '積分 = 念誦 ×0.01 + 觀修次 ×5 + 觀修分鐘 ×0.1 + 答題 ×0.5 + 閱讀完成 ×2 + 活躍天數 ×1',
            'Score = chanting ×0.01 + meditations ×5 + min ×0.1 + answers ×0.5 + readings ×2 + active days ×1',
          )}
        </p>
      )}

      {/* 列表 */}
      {ranking.isLoading ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <Skeleton.List />
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-7)', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>🏆</div>
          {(ranking.error as ApiError | undefined)?.message ?? s('暂无修学记录', '暫無修學記錄', 'No study records yet')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {sorted.map((row, i) => (
            <RankingRow key={row.userId} row={row} idx={i} dim={dim} isMe={row.userId === user?.id} />
          ))}
        </div>
      )}

      {/* 隐私提示 */}
      <div style={{ marginTop: 'var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, lineHeight: 1.6, textAlign: 'center' }}>
        {s(
          '默认对同班可见 · 在 [设置 → 隐私] 可分别关闭「修学」(念诵/答题/阅读) 与「观修」可见性 · 关闭后该维度不计入排行',
          '預設對同班可見 · 在 [設定 → 隱私] 可分別關閉「修學」(念誦/答題/閱讀) 與「觀修」可見性 · 關閉後該維度不計入排行',
          'Visible to classmates by default · in Settings → Privacy you can hide Study (chanting/answers/reading) and Meditation separately; hidden dimensions are excluded from the ranking',
        )}
      </div>
      </div>
    </div>
  );
}

function RankingRow({ row, idx, dim, isMe }: {
  row: StudyRankingRow;
  idx: number;
  dim: Dim;
  isMe: boolean;
}) {
  const { s } = useLang();
  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;

  // 主显示数字（dim 决定）
  const mainNumber =
    dim === 'comprehensive' ? row.score
      : dim === 'chanting' ? row.breakdown.chanting
      : row.breakdown.meditationCount;
  const mainUnit =
    dim === 'comprehensive' ? s('分', '分', 'pts')
      : dim === 'chanting' ? s('遍', '遍', 'x')
      : s('次', '次', 'x');

  // 副行（comprehensive 显示分解 · 其他维度显示该维度详情）
  let subline: string;
  if (dim === 'comprehensive') {
    subline = `📿 ${row.breakdown.chanting} · 🧘 ${row.breakdown.meditationCount} · 📖 ${row.breakdown.readingLessons} · 🎯 ${row.breakdown.answerCount}`;
  } else if (dim === 'meditation') {
    const m = row.breakdown.meditationMin;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    subline = h > 0 ? `${h}h ${mins}m` : `${mins}m`;
  } else {
    subline = s(`${row.breakdown.activeDays} 天活跃`, `${row.breakdown.activeDays} 天活躍`, `${row.breakdown.activeDays} active days`);
  }

  return (
    <div
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
        background: idx < 3 ? 'var(--saffron)' : 'var(--glass)',
        color: idx < 3 ? '#fff' : 'var(--ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem',
        flexShrink: 0,
      }}>
        {medal ?? idx + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1, fontSize: '.9375rem' }}>
          {row.dharmaName || s('（无法名）', '（無法名）', '(no name)')}
          {isMe && <span style={{ marginLeft: 8, font: 'var(--text-caption)', color: 'var(--saffron-dark)' }}>· {s('我', '我', 'me')}</span>}
        </div>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
          {subline}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: '1.1rem',
          color: idx < 3 ? 'var(--saffron-dark)' : 'var(--ink-2)',
          lineHeight: 1.1,
        }}>
          {mainNumber.toLocaleString()}
        </div>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginTop: 2 }}>
          {mainUnit}
        </div>
      </div>
    </div>
  );
}
