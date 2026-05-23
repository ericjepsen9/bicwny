// 颂词续接题 chain · 给上一句 · 学员补 1-N 句下文
//
// payload: {
//   previousLine: string;            上一句（题目展示 · 仅 UI · 评分不参与）
//   nextLines: string[];             学员要续的 1-N 句完整颂词（评分基准）
//   matchMode: 'full' | 'startsWith'; 默认 startsWith
//   minMatchLength?: number;         startsWith 下每行最少字数（默认 4）
// }
// answer: { lines: string[] }
//
// confirmed 时：每行旁打 ✓/✗ · 错的下方显示参考答案
import { useEffect, useMemo, useState } from 'react';
import type { QuestionRendererProps } from './types';

interface ChainPayload {
  previousLine?: string;
  nextLines?: string[];
  matchMode?: 'full' | 'startsWith';
  minMatchLength?: number;
}

// 与后端 normalizeFillAnswer 一致 · 评分校验只做参考显示，不影响后端结果
function normalize(s: string): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，。！？、：；""''「」『』《》〈〉,.!?;:"'()<>·\-—_]/g, '')
    .toLowerCase();
}

export default function Chain({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const payload = (question.payload ?? {}) as ChainPayload;
  const previousLine = payload.previousLine ?? '';
  const nextLines = payload.nextLines ?? [];
  const matchMode = payload.matchMode ?? 'startsWith';
  const minLen = payload.minMatchLength ?? 4;

  const initialLines = useMemo<string[]>(() => {
    const ans = (value as { lines?: string[] } | null)?.lines;
    if (Array.isArray(ans)) return nextLines.map((_, i) => ans[i] ?? '');
    return nextLines.map(() => '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextLines.length, question.id]);

  const [lines, setLines] = useState<string[]>(initialLines);

  useEffect(() => {
    onChange({ lines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  function setLine(i: number, v: string) {
    if (confirmed) return;
    setLines((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  // confirmed 时按 mode 算每行对错（仅本地展示 · 后端是真实判分源）
  function statusOf(i: number): 'correct' | 'wrong' | null {
    if (!confirmed) return null;
    const userNorm = normalize(lines[i] ?? '');
    const refNorm = normalize(nextLines[i] ?? '');
    if (userNorm.length === 0) return 'wrong';
    if (matchMode === 'full') {
      return userNorm === refNorm ? 'correct' : 'wrong';
    }
    return userNorm.length >= minLen && refNorm.startsWith(userNorm) ? 'correct' : 'wrong';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {/* 上一句 · 提示 */}
      {previousLine && (
        <div style={{
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--saffron-pale)',
          border: '1px solid var(--saffron-light)',
          borderLeft: '4px solid var(--saffron)',
          borderRadius: 'var(--r)',
          fontFamily: 'var(--font-serif)',
          fontSize: '1.05rem',
          color: 'var(--ink)',
          letterSpacing: 1.5,
          lineHeight: 1.8,
        }}>
          {previousLine}
        </div>
      )}

      {/* 提示模式 */}
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
        {nextLines.length > 1
          ? `请续接以下 ${nextLines.length} 句`
          : '请续接下一句'}
        {matchMode === 'startsWith' && (
          <span style={{ marginLeft: 8, color: 'var(--ink-4)' }}>
            · 输入开头 ≥ {minLen} 字即可
          </span>
        )}
      </div>

      {/* 输入区 · 每行一个 input */}
      {nextLines.map((ref, i) => {
        const st = statusOf(i);
        const userVal = lines[i] ?? '';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 20 }}>
                {i + 2}.
              </span>
              <input
                type="text"
                value={userVal}
                onChange={(e) => setLine(i, e.target.value)}
                disabled={confirmed}
                placeholder={confirmed ? '' : `输入第 ${i + 2} 句…`}
                autoFocus={i === 0 && !confirmed}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--r)',
                  border: '1px solid ' + (
                    st === 'correct' ? 'var(--sage-dark)'
                    : st === 'wrong' ? 'var(--crimson)'
                    : 'var(--border)'
                  ),
                  background:
                    st === 'correct' ? 'rgba(125,154,108,.10)'
                    : st === 'wrong' ? 'rgba(192,57,43,.06)'
                    : 'var(--bg-input)',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1rem',
                  letterSpacing: 1.2,
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              {st === 'correct' && (
                <span style={{ color: 'var(--sage-dark)', fontWeight: 700, fontSize: '1.1rem' }}>✓</span>
              )}
              {st === 'wrong' && (
                <span style={{ color: 'var(--crimson)', fontWeight: 700, fontSize: '1.1rem' }}>✗</span>
              )}
            </div>
            {/* confirmed + 错 → 显示参考答案 */}
            {st === 'wrong' && (
              <div style={{
                marginLeft: 28,
                padding: '6px 10px',
                background: 'rgba(125,154,108,.08)',
                border: '1px dashed rgba(125,154,108,.4)',
                borderRadius: 'var(--r-sm)',
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                color: 'var(--sage-dark)',
                letterSpacing: 1.2,
              }}>
                参考：{ref}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
