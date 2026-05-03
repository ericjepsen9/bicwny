// 填空题 · payload { verseLines, correctWord, options:[字], verseSource }
//   答案：{ selectedOption: number } 选 options 中的某个
import type { QuestionRendererProps } from './types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
          // 行内 ____ 替换为实际选中的字（confirmed 时显示正确字）
          const display = line.includes('____')
            ? line.replace(
                '____',
                confirmed
                  ? correctWord
                  : (v !== undefined ? opts[v] || '____' : '____'),
              )
            : line;
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
