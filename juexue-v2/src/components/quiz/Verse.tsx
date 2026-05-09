// 颂词组句题 · 参考 Duolingo 拼句
//
// payload: { tokens: string[]; distractors?: string[]; hintText?: string }
//   - tokens 是按正确顺序的词块（例：["菩提之妙宝", "未生愿生起"]）
//   - distractors 是干扰词（可选）
//   - hintText 是题干上下文（可选 · 提示前一句颂词）
//
// 交互：
//   - 上区显示已选词块（按用户点击顺序）
//   - 下区是词池（tokens + distractors 打乱）· 点一下进上区 · 再点退回
//   - confirmed 后上区显示对/错色 · 错位标红 + 显示正确词
//
// answer: { tokens: string[] }
import { useEffect, useMemo, useState } from 'react';
import type { QuestionRendererProps } from './types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface PoolEntry {
  uid: string;     // 唯一 id（pool 中重复词区分）
  text: string;
  isDistractor: boolean;
}

export default function Verse({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const payload = question.payload as { tokens?: string[]; distractors?: string[]; hintText?: string };
  const correctTokens = payload.tokens ?? [];
  const distractors = payload.distractors ?? [];
  const hintText = payload.hintText;

  // 词池（一次生成 · 打乱顺序）· uid 区分重复词块
  const pool = useMemo<PoolEntry[]>(() => {
    const all: PoolEntry[] = [
      ...correctTokens.map((text, i) => ({ uid: `t${i}`, text, isDistractor: false })),
      ...distractors.map((text, i) => ({ uid: `d${i}`, text, isDistractor: true })),
    ];
    return shuffle(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // 用户已选的 uid 序列（顺序敏感）
  const initialPicked = useMemo<string[]>(() => {
    const ans = (value as { tokens?: string[] } | null)?.tokens;
    if (!Array.isArray(ans) || ans.length === 0) return [];
    // 把答案 token 反推回 pool uid · 按顺序消耗（重复词块匹配第一个还没用过的 uid）
    const used = new Set<string>();
    const result: string[] = [];
    for (const t of ans) {
      const e = pool.find((p) => p.text === t && !used.has(p.uid));
      if (e) {
        result.push(e.uid);
        used.add(e.uid);
      }
    }
    return result;
  }, [value, pool]);

  const [picked, setPicked] = useState<string[]>(initialPicked);

  useEffect(() => {
    onChange({ tokens: picked.map((uid) => pool.find((p) => p.uid === uid)?.text ?? '') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  function pickWord(uid: string) {
    if (confirmed) return;
    if (picked.includes(uid)) return;
    setPicked([...picked, uid]);
  }
  function unpickWord(uid: string) {
    if (confirmed) return;
    setPicked(picked.filter((u) => u !== uid));
  }
  function clearAll() {
    if (confirmed) return;
    setPicked([]);
  }

  // confirmed 状态下 · 标记每个已选词的对错
  function statusOf(idx: number, uid: string): 'correct' | 'wrong' | null {
    if (!confirmed) return null;
    const userText = pool.find((p) => p.uid === uid)?.text ?? '';
    const correctText = correctTokens[idx];
    return userText.trim() === (correctText ?? '').trim() ? 'correct' : 'wrong';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {/* 提示行 · 教师写的上下文 */}
      {hintText && (
        <div style={{
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--saffron-pale)',
          border: '1px solid var(--saffron-light)',
          borderRadius: 'var(--r)',
          font: 'var(--text-body-serif)',
          color: 'var(--ink-2)',
          letterSpacing: 1.2,
          lineHeight: 1.7,
        }}>
          {hintText}
        </div>
      )}

      {/* 上区：已选词块 */}
      <div
        style={{
          minHeight: 80,
          padding: 'var(--sp-3)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: 8,
        }}
      >
        {picked.length === 0 ? (
          <span style={{ color: 'var(--ink-4)', font: 'var(--text-caption)', alignSelf: 'center' }}>
            点下方词块按顺序拼出颂词
          </span>
        ) : picked.map((uid, idx) => {
          const entry = pool.find((p) => p.uid === uid);
          if (!entry) return null;
          const st = statusOf(idx, uid);
          const correctText = confirmed && st === 'wrong' ? correctTokens[idx] : null;
          return (
            <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => unpickWord(uid)}
                disabled={confirmed}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--r)',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '0.95rem',
                  letterSpacing: 1.2,
                  border: '1px solid ' + (
                    st === 'correct' ? 'var(--sage-dark)'
                    : st === 'wrong' ? 'var(--crimson)'
                    : 'var(--saffron-light)'
                  ),
                  background:
                    st === 'correct' ? 'rgba(125,154,108,.15)'
                    : st === 'wrong' ? 'rgba(192,57,43,.10)'
                    : 'var(--saffron-pale)',
                  color:
                    st === 'correct' ? 'var(--sage-dark)'
                    : st === 'wrong' ? 'var(--crimson)'
                    : 'var(--saffron-dark)',
                  cursor: confirmed ? 'default' : 'pointer',
                }}
              >
                {entry.text}
              </button>
              {correctText && correctText !== entry.text && (
                <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)' }} title={`应为「${correctText}」`}>
                  →{correctText}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* 下区：词池 · 已选的灰显 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {pool.map((entry) => {
          const used = picked.includes(entry.uid);
          return (
            <button
              key={entry.uid}
              type="button"
              onClick={() => pickWord(entry.uid)}
              disabled={confirmed || used}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                letterSpacing: 1.2,
                border: '1px solid var(--glass-border)',
                background: used ? 'transparent' : 'var(--glass-thick)',
                color: used ? 'var(--ink-4)' : 'var(--ink)',
                cursor: confirmed || used ? 'default' : 'pointer',
                opacity: used ? 0.4 : 1,
                visibility: used ? 'hidden' : 'visible',
              }}
            >
              {entry.text}
            </button>
          );
        })}
      </div>

      {/* 编辑模式 · 清除按钮 */}
      {!confirmed && picked.length > 0 && (
        <button
          type="button"
          onClick={clearAll}
          style={{
            alignSelf: 'flex-end',
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-pill)',
            color: 'var(--ink-3)',
            font: 'var(--text-caption)',
            cursor: 'pointer',
          }}
        >
          清除拼词
        </button>
      )}

      {/* confirmed · 显示完整正确颂词（如果有错） */}
      {confirmed && picked.length > 0 && picked.some((uid, i) => statusOf(i, uid) !== 'correct') && (
        <div style={{
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'rgba(125,154,108,.08)',
          border: '1px solid rgba(125,154,108,.3)',
          borderRadius: 'var(--r)',
          font: 'var(--text-body-serif)',
          color: 'var(--sage-dark)',
          letterSpacing: 1.5,
          lineHeight: 1.7,
        }}>
          正确颂词：{correctTokens.join(' ')}
        </div>
      )}
    </div>
  );
}
