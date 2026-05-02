// DailyBarChart · 30 天活跃柱状图（无图表库 · 纯 CSS）
//   data: [{ date: 'YYYY-MM-DD', count: number, correct: number }]
//   柱高按 count / max(count) 归一 · 正确部分用 sage 色叠在底部 · 错答用 ink-4 灰
//   hover/focus 显示 tooltip：日期 + 答题数 + 正确数
//
// 视觉：
//   ─ 高度固定 100px · 柱体下端贴底 · 数字标签放空当条上方
//   ─ x 轴 7 天间隔显示 MM-DD · 太密时只显首末
//   ─ 全部 0 时显示空态文案
import { useState } from 'react';

export interface DailyPoint {
  date: string;
  count: number;
  correct: number;
}

interface Props {
  data: DailyPoint[];
  /** 全部 0 时显示的文案 */
  emptyLabel?: string;
  /** 顶部右上角的副信息 · 比如总数 */
  rightLabel?: string;
}

export default function DailyBarChart({ data, emptyLabel = '暂无活跃记录', rightLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const totalCount = data.reduce((a, b) => a + b.count, 0);
  const totalCorrect = data.reduce((a, b) => a + b.correct, 0);

  if (data.length === 0) {
    return (
      <div style={{ padding: 'var(--sp-4)', textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
        {emptyLabel}
      </div>
    );
  }

  const isAllZero = totalCount === 0;

  // 选 x 轴 label：首日、今日、中间隔几天
  function shouldLabel(i: number): boolean {
    if (data.length <= 8) return true;
    if (i === 0 || i === data.length - 1) return true;
    const step = Math.ceil(data.length / 6);
    return i % step === 0;
  }

  const cur = hover != null ? data[hover] : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
          {cur
            ? `${formatYmd(cur.date)} · ${cur.count} 答题（正确 ${cur.correct}）`
            : `${data.length} 天 · 共 ${totalCount} 答题（正确 ${totalCorrect}）`}
        </span>
        {rightLabel && (
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>{rightLabel}</span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 110,
          padding: '0 0 6px',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--glass)',
          borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
          overflow: 'hidden',
        }}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((d, i) => {
          const h = isAllZero ? 0 : Math.round((d.count / max) * 100);
          const correctH = d.count > 0 ? Math.round(((d.correct / d.count) * h)) : 0;
          const wrongH = h - correctH;
          const isHover = hover === i;
          return (
            <div
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              role="img"
              aria-label={`${d.date}: ${d.count} 答题, ${d.correct} 正确`}
              style={{
                flex: 1,
                minWidth: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                position: 'relative',
                cursor: 'default',
                outline: 'none',
              }}
            >
              {h === 0 ? (
                // 空当 · 显示一个微弱底线 · 与其他柱对齐
                <div style={{ height: 2, background: 'var(--border-light)', opacity: isHover ? 1 : 0.5 }} />
              ) : (
                <>
                  {/* 错答部分（顶部） */}
                  {wrongH > 0 && (
                    <div
                      style={{
                        height: wrongH + '%',
                        background: isHover ? 'var(--crimson)' : 'var(--crimson-light)',
                        borderRadius: '2px 2px 0 0',
                        transition: 'background .15s var(--ease)',
                      }}
                    />
                  )}
                  {/* 正确部分（下半） */}
                  <div
                    style={{
                      height: correctH + '%',
                      background: isHover ? 'var(--sage-dark)' : 'var(--sage)',
                      borderRadius: wrongH > 0 ? 0 : '2px 2px 0 0',
                      transition: 'background .15s var(--ease)',
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* x 轴标签 */}
      <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
        {data.map((d, i) => (
          <div
            key={d.date}
            style={{
              flex: 1,
              minWidth: 4,
              font: 'var(--text-caption)',
              color: 'var(--ink-4)',
              letterSpacing: 0,
              fontSize: '.625rem',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              opacity: shouldLabel(i) ? 1 : 0,
            }}
          >
            {d.date.slice(5)}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 6, font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
        <Legend color="var(--sage)" label="正确" />
        <Legend color="var(--crimson-light)" label="错答" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function formatYmd(ymd: string): string {
  // YYYY-MM-DD → MM-DD（同年）
  return ymd.slice(5);
}
