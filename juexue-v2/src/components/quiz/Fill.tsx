// 填空题 · 两种模式
//   typing (默认 · 用户手动输入): payload { verseLines, correctWord, acceptableAnswers? }
//     答案：{ value: string }
//     后端 gradeFill 归一化：trim · 全角→半角 · 去标点 · lowercase
//     可选 acceptableAnswers 接受多种合法变体（简繁 / 异写 / 简称）
//
//   choice (opt-in · payload.mode === 'choice'): payload { verseLines, options:[字], correctWord, verseSource }
//     答案：{ selectedOption: number } 选 options 中的某个
//     用于已有的「选词填空」题目 · 显式标 mode='choice' 才走此路
//
// verseLines 下划线规范：4 个 ____ 但 LLM 实际生成 1-N 不等 · 用 regex 兼容
import { useEffect, useState } from 'react';
import type { QuestionRendererProps } from './types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const BLANK_RE = /[_＿]{2,}|（_+）/;

export default function Fill({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const rawVerseLines = (question.payload.verseLines as string[] | undefined) ?? [];
  const correctWord = (question.payload.correctWord as string | undefined) ?? '';
  // Fallback：LLM 经常忘记标 ____ · 把答案直接写进 verseLines · 这里检测并自动
  // 把 correctWord 替换为 ____ · 用户和组件就都能识别空位
  const verseLines = ensureBlankMarked(rawVerseLines, correctWord);
  // 默认 typing · 显式 'choice' 才走选词模式（向后兼容老的「选词填空」题）
  const mode = (question.payload.mode as string | undefined) === 'choice' ? 'choice' : 'typing';

  if (mode === 'choice') {
    return <ChoiceFill question={question} verseLines={verseLines} correctWord={correctWord} value={value} onChange={onChange} confirmed={confirmed} />;
  }
  return <TypingFill verseLines={verseLines} correctWord={correctWord} value={value} onChange={onChange} confirmed={confirmed} />;
}

// LLM 兜底：verseLines 没标 ____ 时 · 用 correctWord 在原文里的位置反推
//   - 如果任一行已有 ____ / ＿ / （___）→ 原样返回
//   - 否则在第一处出现 correctWord 的行替换为 ____ · 后续 occurrence 不替换
//     避免 verse 里多处同名词（如「往生法」「正行」「加行」前后都有）误标
function ensureBlankMarked(lines: string[], correctWord: string): string[] {
  if (lines.length === 0 || !correctWord) return lines;
  if (lines.some((l) => BLANK_RE.test(l))) return lines;
  let replaced = false;
  return lines.map((line) => {
    if (replaced) return line;
    if (line.includes(correctWord)) {
      replaced = true;
      return line.replace(correctWord, '____');
    }
    return line;
  });
}

// ── choice 模式 · 选词填空 ──
function ChoiceFill({
  question,
  verseLines,
  correctWord,
  value,
  onChange,
  confirmed,
}: QuestionRendererProps & { verseLines: string[]; correctWord: string }) {
  const opts = (question.payload.options as string[] | undefined) ?? [];
  const v = (value as { selectedOption?: number } | null)?.selectedOption;

  const filler = confirmed
    ? correctWord
    : (v !== undefined ? opts[v] || '____' : '____');

  return (
    <div>
      <VerseDisplay verseLines={verseLines} filler={filler} />

      <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {opts.map((text, i) => {
          const selected = v === i;
          const isCorrect = confirmed && text === correctWord;
          const isWrong = confirmed && selected && text !== correctWord;
          const cls = 'opt' +
            (confirmed ? ' disabled' : '') +
            (selected && !confirmed ? ' selected' : '') +
            (isCorrect ? ' correct' : '') +
            (isWrong ? ' wrong' : '');
          return (
            <button
              type="button"
              key={i}
              className={cls}
              onClick={() => !confirmed && onChange({ selectedOption: i })}
              disabled={confirmed}
              aria-pressed={selected}
              style={{ textAlign: 'left' }}
            >
              <span className="opt-letter" aria-hidden>{LETTERS[i] ?? '?'}</span>
              <span className="opt-text">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── typing 模式 · 自由输入填空 ──
// 输入框 inline 嵌在 verse 偈颂里 · 像 Anki cloze 那样
// 答完 confirmed 后显示对错 · 错误显示正确答案 + 用户输入
function TypingFill({
  verseLines,
  correctWord,
  value,
  onChange,
  confirmed,
}: {
  verseLines: string[];
  correctWord: string;
  value: unknown;
  onChange: (next: unknown) => void;
  confirmed: boolean;
}) {
  const initial = (value as { value?: string } | null)?.value ?? '';
  const [text, setText] = useState(initial);

  // 同步初始 value
  useEffect(() => {
    if (!(value as { value?: string } | null)?.value && text) {
      onChange({ value: text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 去归一化看用户输入是否对（仅显示用 · 真判分在后端）
  const isCorrect = confirmed && normalizeForDisplay(text) === normalizeForDisplay(correctWord);

  return (
    <div>
      {/* verse 显示 · ____ 替换成 input 或正确答案 */}
      <div
        className="glass-card"
        style={{
          padding: 'var(--sp-4)',
          fontFamily: 'var(--font-serif)',
          fontSize: '1.0625rem',
          lineHeight: 2,
          letterSpacing: 2,
          color: 'var(--ink)',
          marginBottom: 'var(--sp-3)',
        }}
      >
        {verseLines.map((line, i) => {
          if (!BLANK_RE.test(line)) return <div key={i}>{line}</div>;
          const parts = line.split(BLANK_RE);
          return (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              {parts.map((part, j) => (
                <span key={`p-${j}`}>
                  {part}
                  {j < parts.length - 1 && (
                    confirmed ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0 8px',
                          borderBottom: '2px solid ' + (isCorrect ? 'var(--sage-dark)' : 'var(--crimson)'),
                          color: isCorrect ? 'var(--sage-dark)' : 'var(--crimson)',
                          fontWeight: 600,
                          minWidth: 60,
                          textAlign: 'center',
                        }}
                      >
                        {isCorrect ? text : correctWord}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={text}
                        onChange={(e) => { setText(e.target.value); onChange({ value: e.target.value }); }}
                        placeholder="填入答案"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          minWidth: 100,
                          width: Math.max(100, text.length * 18),
                          border: 'none',
                          borderBottom: '2px solid var(--saffron-dark)',
                          background: 'transparent',
                          fontFamily: 'var(--font-serif)',
                          fontSize: '1.0625rem',
                          color: 'var(--ink)',
                          outline: 'none',
                          textAlign: 'center',
                          letterSpacing: 2,
                        }}
                      />
                    )
                  )}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* confirmed 后 · 错误时额外显示对照 */}
      {confirmed && !isCorrect && (
        <div style={{
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'rgba(192,57,43,.08)',
          border: '1px solid rgba(192,57,43,.3)',
          borderRadius: 'var(--r)',
          font: 'var(--text-caption)',
          lineHeight: 1.7,
        }}>
          <div style={{ color: 'var(--ink-3)', marginBottom: 4 }}>
            <span style={{ color: 'var(--crimson)', fontWeight: 600 }}>你的答案：</span>
            <span style={{ color: 'var(--ink)' }}>{text || '（空）'}</span>
          </div>
          <div style={{ color: 'var(--ink-3)' }}>
            <span style={{ color: 'var(--sage-dark)', fontWeight: 600 }}>正确答案：</span>
            <span style={{ color: 'var(--ink)' }}>{correctWord}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 共用 verse 渲染（choice 模式用） ──
function VerseDisplay({ verseLines, filler }: { verseLines: string[]; filler: string }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 'var(--sp-4)',
        fontFamily: 'var(--font-serif)',
        fontSize: '1.0625rem',
        lineHeight: 2,
        letterSpacing: 2,
        color: 'var(--ink)',
        marginBottom: 'var(--sp-3)',
      }}
    >
      {verseLines.map((line, i) => {
        const display = BLANK_RE.test(line) ? line.replace(BLANK_RE, filler) : line;
        return <div key={i}>{display}</div>;
      })}
    </div>
  );
}

// 前端展示用归一化（与后端 normalizeFillAnswer 同规则 · 只为 confirmed 视觉判对错）
// 真判分以后端为准
function normalizeForDisplay(s: string): string {
  return s
    .trim()
    .replace(/[\s　]+/g, '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，。！？、：；""''「」『』《》〈〉,.!?;:"'()<>·\-—_]/g, '')
    .toLowerCase();
}
