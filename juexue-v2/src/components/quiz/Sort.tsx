// 排序题 · payload { items:[{text,order}] · order 是正确顺序 }
//   答题时给用户打乱后的顺序 · 用户用 ↑↓ 调位置
//   答案：{ items: [{text, order}] } · 用户提交时的当前顺序
import { useEffect, useState } from 'react';
import type { QuestionRendererProps } from './types';

interface Item { text: string; order: number }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default function Sort({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const original = (question.payload.items as Item[] | undefined) ?? [];
  const [order, setOrder] = useState<Item[]>(() => {
    const v = (value as { items?: Item[] } | null)?.items;
    return v && v.length === original.length ? v : shuffle(original);
  });

  // 同步初始 value
  useEffect(() => {
    if (!(value as { items?: Item[] } | null)?.items) {
      onChange({ items: order });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function move(i: number, dir: -1 | 1) {
    if (confirmed) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
    onChange({ items: next });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {order.map((it, i) => {
        const correctPos = it.order === i + 1; // 假设 order 1-based
        const showFx = confirmed;
        return (
          <div
            key={`${it.text}-${i}`}
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: showFx
                ? correctPos ? 'var(--sage-light)' : 'var(--crimson-light)'
                : 'var(--glass-thick)',
              border: '1px solid ' + (showFx
                ? correctPos ? 'var(--sage)' : 'var(--crimson)'
                : 'var(--glass-border)'),
              borderRadius: 'var(--r-lg)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink-3)', minWidth: 24 }}>
              {i + 1}.
            </span>
            <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>
              {it.text}
            </span>
            {!confirmed && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="btn-pill"
                  style={{ width: 32, height: 32, padding: 0, background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: 'none', cursor: 'pointer', borderRadius: '50%' }}
                  aria-label="上移"
                >↑</button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className="btn-pill"
                  style={{ width: 32, height: 32, padding: 0, background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: 'none', cursor: 'pointer', borderRadius: '50%' }}
                  aria-label="下移"
                >↓</button>
              </div>
            )}
            {confirmed && (
              <span style={{ fontSize: 14, color: correctPos ? 'var(--sage-dark)' : 'var(--crimson)' }}>
                {correctPos ? '✓' : `→ ${it.order}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
