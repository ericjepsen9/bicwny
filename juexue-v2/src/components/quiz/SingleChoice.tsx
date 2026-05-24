// 单选题 · payload.options=[{text,correct}] · 答案 { selectedIndex }
import type { QuestionRendererProps } from './types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface Option { text: string; correct?: boolean }

export default function SingleChoice({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const opts = (question.payload.options as Option[] | undefined) ?? [];
  const v = (value as { selectedIndex?: number } | null)?.selectedIndex;

  return (
    <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {opts.map((o, i) => {
        const selected = v === i;
        const showCorrect = confirmed && o.correct;
        const showWrong = confirmed && selected && !o.correct;
        const cls = 'opt' +
          (confirmed ? ' disabled' : '') +
          (selected && !confirmed ? ' selected' : '') +
          (showCorrect ? ' correct' : '') +
          (showWrong ? ' wrong' : '');
        return (
          <button
            type="button"
            key={i}
            className={cls}
            onClick={() => !confirmed && onChange({ selectedIndex: i })}
            disabled={confirmed}
            aria-pressed={selected}
            style={{ textAlign: 'left' }}
          >
            <span className="opt-letter" aria-hidden>{LETTERS[i] ?? '?'}</span>
            <span className="opt-text">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}
