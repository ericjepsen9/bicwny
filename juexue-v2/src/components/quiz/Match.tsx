// 匹配题 · payload { left:[{id,text}], right:[{id,text,match?}] }
//   答案：{ pairs: { [leftId]: rightId } }
//   UI：左列固定 · 右列每个左项配一个 select（选 right 项）
import { useMemo } from 'react';
import type { QuestionRendererProps } from './types';

interface Side { id: string; text: string; match?: string }

export default function Match({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const left = (question.payload.left as Side[] | undefined) ?? [];
  const right = (question.payload.right as Side[] | undefined) ?? [];
  const pairs = ((value as { pairs?: Record<string, string> } | null)?.pairs) ?? {};

  // 反查 right.match → 用于 confirmed 时显示对错
  const correctMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of right) {
      if (r.match) map[r.match] = r.id;
    }
    return map;
  }, [right]);

  function setPair(leftId: string, rightId: string) {
    if (confirmed) return;
    const next = { ...pairs };
    if (rightId === '') delete next[leftId];
    else next[leftId] = rightId;
    onChange({ pairs: next });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {left.map((l) => {
        const userPick = pairs[l.id];
        const correctRightId = correctMap[l.id];
        const isRight = userPick && userPick === correctRightId;
        const isWrong = confirmed && userPick && !isRight;
        return (
          <div
            key={l.id}
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: confirmed
                ? isRight ? 'var(--sage-light)' : 'var(--crimson-light)'
                : 'var(--glass-thick)',
              border: '1px solid ' + (confirmed
                ? isRight ? 'var(--sage)' : 'var(--crimson)'
                : 'var(--glass-border)'),
              borderRadius: 'var(--r-lg)',
            }}
          >
            <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>{l.text}</span>
            <span style={{ color: 'var(--ink-3)' }}>→</span>
            <select
              value={userPick || ''}
              onChange={(e) => setPair(l.id, e.target.value)}
              disabled={confirmed}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--ink)',
                font: 'var(--text-body)',
              }}
            >
              <option value="">—</option>
              {right.map((r) => (
                <option key={r.id} value={r.id}>{r.text}</option>
              ))}
            </select>
            {confirmed && (
              <span style={{ fontSize: 14, color: isRight ? 'var(--sage-dark)' : 'var(--crimson)' }}>
                {isWrong ? `✗ ${right.find((r) => r.id === correctRightId)?.text || ''}` : isRight ? '✓' : '—'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
