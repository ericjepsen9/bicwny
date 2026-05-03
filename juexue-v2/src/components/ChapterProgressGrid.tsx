// 章级棋盘格 · 显示当前法本每章学习进度
//   ✓ completed: 全章 lesson 都完成 · sage 绿底
//   ● current  : 本章包含 currentLessonId · saffron 橙边框 + 浅橙底
//   ◐ partial  : 部分 lesson 完成（不含当前章）· saffron-pale + 数字
//   ○ untouched: 未开始 · 灰底
//
// 点击格子 → 跳到该章"首个未完成 lesson"的 reading
// 法本无章/章数为 0 时不显示
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import type { Chapter } from '@/lib/queries';

interface Props {
  slug: string;
  chapters: Chapter[];
  /** 用户已完成的 lesson id 集 */
  completedSet: Set<string>;
  /** 当前正在学的 lesson id（来自 enrollment.currentLessonId） */
  currentLessonId?: string | null;
  /** 网格列数 · 默认 5 · 章数多时自动按需排版（最多 7） */
  columns?: number;
}

type CellState = 'completed' | 'current' | 'partial' | 'untouched';

function getState(
  ch: Chapter,
  completedSet: Set<string>,
  currentLessonId: string | null | undefined,
): CellState {
  const lessons = ch.lessons ?? [];
  if (lessons.length === 0) return 'untouched';
  const doneCount = lessons.filter((l) => completedSet.has(l.id)).length;
  const hasCurrent = currentLessonId
    ? lessons.some((l) => l.id === currentLessonId)
    : false;
  if (hasCurrent) return 'current';
  if (doneCount === lessons.length) return 'completed';
  if (doneCount > 0) return 'partial';
  return 'untouched';
}

function getCellStyle(state: CellState): React.CSSProperties {
  switch (state) {
    case 'completed':
      return {
        background: 'linear-gradient(135deg, var(--sage), var(--sage-dark))',
        color: '#fff',
        border: 'none',
        boxShadow: '0 2px 6px rgba(125,154,108,.3)',
      };
    case 'current':
      return {
        background: 'var(--saffron-pale)',
        color: 'var(--saffron-dark)',
        border: '2px solid var(--saffron)',
        boxShadow: '0 0 0 3px rgba(224,120,86,.15)',
        fontWeight: 800,
      };
    case 'partial':
      return {
        background: 'var(--saffron-pale)',
        color: 'var(--saffron-dark)',
        border: '1px solid var(--saffron-light)',
      };
    case 'untouched':
    default:
      return {
        background: 'var(--glass)',
        color: 'var(--ink-4)',
        border: '1px solid var(--border-light)',
      };
  }
}

export default function ChapterProgressGrid({
  slug,
  chapters,
  completedSet,
  currentLessonId,
  columns = 5,
}: Props) {
  const { s } = useLang();
  if (chapters.length === 0) return null;

  // 章数较多时自动调宽列数
  const cols = chapters.length > 60 ? 7 : chapters.length > 30 ? 6 : columns;

  return (
    <div>
      {/* 图例 */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, flexWrap: 'wrap' }}>
        <Legend color="linear-gradient(135deg, var(--sage), var(--sage-dark))" label={s('已学完', '已學完', 'Done')} />
        <Legend color="var(--saffron-pale)" border="2px solid var(--saffron)" label={s('当前', '當前', 'Current')} />
        <Legend color="var(--saffron-pale)" border="1px solid var(--saffron-light)" label={s('在学', '在學', 'Partial')} fg="var(--saffron-dark)" />
        <Legend color="var(--glass)" border="1px solid var(--border-light)" label={s('未学', '未學', 'New')} fg="var(--ink-4)" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 6,
        }}
      >
        {chapters.map((ch) => {
          const state = getState(ch, completedSet, currentLessonId);
          const cellStyle = getCellStyle(state);
          const lessons = ch.lessons ?? [];
          const doneCount = lessons.filter((l) => completedSet.has(l.id)).length;
          // 跳到该章首个未完成 lesson · 否则首课时
          const targetLesson =
            lessons.find((l) => !completedSet.has(l.id)) ?? lessons[0];
          const tooltip = `${s('第 ' + ch.order + ' 章', '第 ' + ch.order + ' 章', 'Ch ' + ch.order)} · ${ch.title}\n${doneCount} / ${lessons.length} ${s('课', '課', 'lessons')}`;

          if (!targetLesson) {
            return (
              <span
                key={ch.id}
                title={tooltip}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--r-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: 0,
                  cursor: 'not-allowed',
                  ...cellStyle,
                }}
              >
                {ch.order}
              </span>
            );
          }

          return (
            <Link
              key={ch.id}
              to={`/read/${slug}/${targetLesson.id}`}
              title={tooltip}
              aria-label={tooltip}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 'var(--r-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-serif)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                letterSpacing: 0,
                textDecoration: 'none',
                position: 'relative',
                transition: 'transform var(--dur) var(--ease)',
                ...cellStyle,
              }}
            >
              {state === 'completed' ? (
                <>
                  <span style={{ fontSize: '0.7rem', opacity: 0.85, marginBottom: -2 }}>
                    {ch.order}
                  </span>
                  <span style={{ fontSize: '0.75rem' }}>✓</span>
                </>
              ) : (
                <span>{ch.order}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, border, label, fg }: { color: string; border?: string; label: string; fg?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          border: border ?? 'none',
          color: fg,
          display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </span>
  );
}
