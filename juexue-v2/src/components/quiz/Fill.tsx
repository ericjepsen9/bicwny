// 填空题 · payload { verseLines, correctWord, options:[字], verseSource }
//   答案：{ selectedOption: number } 选 options 中的某个
//
// verseLines 下划线规范：写规范应是 4 个 ____ 但 LLM 经常生成 1-6 个不等 ·
// 用 regex /_{2,}/ 兼容 · 同时也接受半角 _ / 全角 ＿ / 中文括号占位 (___)
import type { QuestionRendererProps } from './types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const BLANK_RE = /[_＿]{2,}|（_+）/;

export default function Fill({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const verseLines = (question.payload.verseLines as string[] | undefined) ?? [];
  const opts = (question.payload.options as string[] | undefined) ?? [];
  const correctWord = (question.payload.correctWord as string | undefined) ?? '';
  const v = (value as { selectedOption?: number } | null)?.selectedOption;

  return (
    <div>
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
          // 行内连续 _ / ＿ 替换为实际选中的字（confirmed 时显示正确字）
          const filler = confirmed
            ? correctWord
            : (v !== undefined ? opts[v] || '____' : '____');
          const display = BLANK_RE.test(line) ? line.replace(BLANK_RE, filler) : line;
          return <div key={i}>{display}</div>;
        })}
      </div>

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
