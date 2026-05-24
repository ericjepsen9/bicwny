// 开放题 · payload { referenceAnswer, keyPoints, minLength, maxLength }
//   答案：{ text: string }
import type { QuestionRendererProps } from './types';

export default function Open({ question, value, onChange, confirmed, grade }: QuestionRendererProps) {
  const text = (value as { text?: string } | null)?.text ?? '';
  const minLen = (question.payload.minLength as number | undefined) ?? 0;
  const maxLen = (question.payload.maxLength as number | undefined) ?? 4000;
  const reference = (question.payload.referenceAnswer as string | undefined) ?? '';
  const keyPoints = (question.payload.keyPoints as Array<{ point: string }> | undefined) ?? [];

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => !confirmed && onChange({ text: e.target.value })}
        disabled={confirmed}
        maxLength={maxLen}
        placeholder={`请输入答案（${minLen} - ${maxLen} 字）`}
        style={{
          width: '100%',
          minHeight: 140,
          padding: '12px 14px',
          borderRadius: 'var(--r)',
          border: '1px solid var(--border)',
          background: 'var(--bg-input)',
          color: 'var(--ink)',
          font: 'var(--text-body)',
          letterSpacing: '.5px',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ textAlign: 'right', font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
        {text.length} / {maxLen}
      </div>

      {confirmed && (
        <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {grade && grade.score !== null && (
            <div
              className="glass-card"
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                background: grade.score >= 60 ? 'var(--sage-light)' : 'var(--crimson-light)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ fontWeight: 700, color: grade.score >= 60 ? 'var(--sage-dark)' : 'var(--crimson)' }}>
                得分：{grade.score} / 100
              </div>
              {grade.feedback && (
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 4 }}>
                  {grade.feedback}
                </p>
              )}
            </div>
          )}

          {reference && (
            <details className="glass-card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--saffron-dark)' }}>
                参考答案
              </summary>
              <p style={{ font: 'var(--text-body)', color: 'var(--ink-2)', lineHeight: 1.7, marginTop: 8, whiteSpace: 'pre-wrap' }}>
                {reference}
              </p>
              {keyPoints.length > 0 && (
                <ul style={{ marginTop: 8, paddingLeft: 20, font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                  {keyPoints.map((kp, i) => <li key={i}>{kp.point}</li>)}
                </ul>
              )}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
