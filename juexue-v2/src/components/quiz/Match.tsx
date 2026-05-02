// 匹配题 · payload { left:[{id,text}], right:[{id,text,match?}] }
//   答案：{ pairs: { [leftId]: rightId } }
//   UI：左右两列 · 点左项激活 → 点右项配对 · 5 色组循环区分配对组
//   再点已配对的项可解开 · confirmed 后显示对错覆盖
import { useMemo, useState } from 'react';
import type { QuestionRendererProps } from './types';

interface Side { id: string; text: string; match?: string }

const COLORS = ['saffron', 'sage', 'gold', 'crimson', 'ink'] as const;
type ColorKey = typeof COLORS[number];

const COLOR_STYLES: Record<ColorKey, { bg: string; border: string; badgeBg: string; badgeFg: string }> = {
  saffron: { bg: 'var(--saffron-pale)',  border: 'var(--saffron-light)', badgeBg: 'var(--saffron)',     badgeFg: '#fff' },
  sage:    { bg: 'var(--sage-light)',    border: 'var(--sage)',          badgeBg: 'var(--sage-dark)',   badgeFg: '#fff' },
  gold:    { bg: 'var(--gold-pale)',     border: 'var(--gold-light)',    badgeBg: 'var(--gold-dark)',   badgeFg: '#fff' },
  crimson: { bg: 'var(--crimson-light)', border: 'var(--crimson)',       badgeBg: 'var(--crimson)',     badgeFg: '#fff' },
  ink:     { bg: 'rgba(43,34,24,.06)',   border: 'var(--ink-3)',         badgeBg: 'var(--ink-2)',      badgeFg: '#fff' },
};

export default function Match({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const left = (question.payload.left as Side[] | undefined) ?? [];
  const right = (question.payload.right as Side[] | undefined) ?? [];
  const pairs = ((value as { pairs?: Record<string, string> } | null)?.pairs) ?? {};

  // 当前激活的项（左或右 · null 表示无激活）
  const [active, setActive] = useState<{ side: 'L' | 'R'; id: string } | null>(null);

  // 反查 right.match → 用于 confirmed 时显示对错
  const correctMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of right) {
      if (r.match) map[r.match] = r.id;
    }
    return map;
  }, [right]);

  // 给已配对的左项发色组（按配对顺序稳定分配）
  const pairColor = useMemo(() => {
    const map: Record<string, { color: ColorKey; index: number }> = {};
    let i = 0;
    for (const l of left) {
      if (pairs[l.id]) {
        map[l.id] = { color: COLORS[i % COLORS.length]!, index: i + 1 };
        i++;
      }
    }
    return map;
  }, [left, pairs]);

  // 反查：右项 → 它配对的左项的色组
  const rightToLeft = useMemo(() => {
    const map: Record<string, string> = {};
    for (const lid of Object.keys(pairs)) {
      map[pairs[lid]!] = lid;
    }
    return map;
  }, [pairs]);

  function unpairLeft(lid: string) {
    const next = { ...pairs };
    delete next[lid];
    onChange({ pairs: next });
  }

  function unpairRight(rid: string) {
    const lid = rightToLeft[rid];
    if (!lid) return;
    unpairLeft(lid);
  }

  function clickLeft(lid: string) {
    if (confirmed) return;
    // 已配对 → 先解开
    if (pairs[lid]) {
      unpairLeft(lid);
      setActive(null);
      return;
    }
    // 已激活的右项 → 配对
    if (active?.side === 'R') {
      const rid = active.id;
      // 右项已被别人占用 → 先解开它
      if (rightToLeft[rid]) unpairRight(rid);
      onChange({ pairs: { ...pairs, [lid]: rid } });
      setActive(null);
      return;
    }
    // 否则切换激活
    setActive((cur) => (cur?.side === 'L' && cur.id === lid ? null : { side: 'L', id: lid }));
  }

  function clickRight(rid: string) {
    if (confirmed) return;
    // 已配对 → 先解开
    if (rightToLeft[rid]) {
      unpairRight(rid);
      setActive(null);
      return;
    }
    if (active?.side === 'L') {
      const lid = active.id;
      // 左项已被占用 → 先解开
      if (pairs[lid]) unpairLeft(lid);
      onChange({ pairs: { ...pairs, [lid]: rid } });
      setActive(null);
      return;
    }
    setActive((cur) => (cur?.side === 'R' && cur.id === rid ? null : { side: 'R', id: rid }));
  }

  function leftStyle(l: Side): React.CSSProperties {
    const isActive = active?.side === 'L' && active.id === l.id;
    const paired = pairColor[l.id];
    if (confirmed) {
      const userPick = pairs[l.id];
      const isRight = userPick && userPick === correctMap[l.id];
      return cardBase({
        bg: isRight ? 'var(--sage-light)' : 'var(--crimson-light)',
        border: isRight ? 'var(--sage)' : 'var(--crimson)',
      });
    }
    if (paired) {
      const c = COLOR_STYLES[paired.color];
      return cardBase({ bg: c.bg, border: c.border });
    }
    if (isActive) {
      return cardBase({
        bg: 'var(--saffron-pale)',
        border: 'var(--saffron)',
        boxShadow: '0 0 0 2px var(--saffron-light)',
      });
    }
    return cardBase();
  }

  function rightStyle(r: Side): React.CSSProperties {
    const isActive = active?.side === 'R' && active.id === r.id;
    const lid = rightToLeft[r.id];
    const paired = lid ? pairColor[lid] : undefined;
    if (confirmed) {
      // 找用户把 r 配给了哪个 left；正确与否
      const userL = lid;
      if (!userL) return cardBase();
      const isRight = correctMap[userL] === r.id;
      return cardBase({
        bg: isRight ? 'var(--sage-light)' : 'var(--crimson-light)',
        border: isRight ? 'var(--sage)' : 'var(--crimson)',
      });
    }
    if (paired) {
      const c = COLOR_STYLES[paired.color];
      return cardBase({ bg: c.bg, border: c.border });
    }
    if (isActive) {
      return cardBase({
        bg: 'var(--saffron-pale)',
        border: 'var(--saffron)',
        boxShadow: '0 0 0 2px var(--saffron-light)',
      });
    }
    return cardBase();
  }

  function leftBadge(l: Side): { bg: string; fg: string; text: string } {
    const paired = pairColor[l.id];
    if (paired) {
      const c = COLOR_STYLES[paired.color];
      return { bg: c.badgeBg, fg: c.badgeFg, text: String(paired.index) };
    }
    return { bg: 'rgba(43,34,24,.08)', fg: 'var(--ink-4)', text: String(left.findIndex((x) => x.id === l.id) + 1) };
  }

  function rightBadge(r: Side): { bg: string; fg: string; text: string } {
    const lid = rightToLeft[r.id];
    const paired = lid ? pairColor[lid] : undefined;
    if (paired) {
      const c = COLOR_STYLES[paired.color];
      return { bg: c.badgeBg, fg: c.badgeFg, text: String(paired.index) };
    }
    return { bg: 'rgba(43,34,24,.08)', fg: 'var(--ink-4)', text: String.fromCharCode(65 + right.findIndex((x) => x.id === r.id)) };
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {left.map((l) => {
            const b = leftBadge(l);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => clickLeft(l.id)}
                disabled={confirmed}
                style={leftStyle(l)}
              >
                <span style={badgeStyle(b.bg, b.fg)}>{b.text}</span>
                <span style={textStyle}>{l.text}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {right.map((r) => {
            const b = rightBadge(r);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => clickRight(r.id)}
                disabled={confirmed}
                style={rightStyle(r)}
              >
                <span style={badgeStyle(b.bg, b.fg)}>{b.text}</span>
                <span style={textStyle}>{r.text}</span>
              </button>
            );
          })}
        </div>
      </div>
      {confirmed && (
        <div style={{ marginTop: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
          {left.map((l) => {
            const userPick = pairs[l.id];
            const correctRightId = correctMap[l.id];
            const isRight = userPick && userPick === correctRightId;
            if (isRight) return null;
            const correctText = right.find((r) => r.id === correctRightId)?.text || '—';
            return (
              <div key={l.id} style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--crimson)' }}>✗</span> {l.text} → <span style={{ color: 'var(--sage-dark)' }}>{correctText}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cardBase(over: { bg?: string; border?: string; boxShadow?: string } = {}): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    background: over.bg ?? 'var(--glass)',
    border: '1.5px solid ' + (over.border ?? 'var(--glass-border)'),
    borderRadius: 'var(--r-lg)',
    padding: 'var(--sp-3) var(--sp-3)',
    minHeight: 48,
    color: 'var(--ink)',
    textAlign: 'left',
    font: 'var(--text-body)',
    letterSpacing: '.5px',
    lineHeight: 1.4,
    cursor: 'pointer',
    transition: 'all .2s var(--ease)',
    boxShadow: over.boxShadow ?? 'none',
  };
}

const textStyle: React.CSSProperties = {
  flex: 1,
  wordBreak: 'break-word',
};

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: '50%',
    flexShrink: 0,
    background: bg,
    color: fg,
    fontSize: '.75rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
