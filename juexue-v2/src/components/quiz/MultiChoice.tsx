// 多选 · payload.options=[{text,correct}] · 答案 { selectedIndexes: number[] }
import type { QuestionRendererProps } from './types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
interface Option { text: string; correct?: boolean }

export default function MultiChoice({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const opts = (question.payload.options as Option[] | undefined) ?? [];
  const sel = ((value as { selectedIndexes?: number[] } | null)?.selectedIndexes) ?? [];

  function toggle(i: number) {
    if (confirmed) return;
    const next = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i].sort((a, b) => a - b);
    onChange({ selectedIndexes: next });
  }

  return (
    <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {opts.map((o, i) => {
        const selected = sel.includes(i);
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
            onClick={() => toggle(i)}
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
