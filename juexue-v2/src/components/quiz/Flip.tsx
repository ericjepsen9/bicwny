// 速记卡 · payload { front:{text,subText?}, back:{text,example?}, noScoring:true }
//   不评分 · 用户翻卡查看 · "已记住" / "再练" 二选一推进
import { useState } from 'react';
import type { QuestionRendererProps } from './types';

export default function Flip({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const front = question.payload.front as { text: string; subText?: string } | undefined;
  const back = question.payload.back as { text: string; example?: string } | undefined;
  const [flipped, setFlipped] = useState(!!value);

  function reveal() {
    setFlipped(true);
    onChange({ __placeholder: true }); // 标记已查看 · 后端不参与评分
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 240,
        background: 'var(--glass-thick)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {!flipped ? (
        <>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 4, marginBottom: 'var(--sp-3)' }}>
            {front?.text}
          </p>
          {front?.subText && (
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-5)' }}>
              {front.subText}
            </p>
          )}
          <button
            type="button"
            onClick={reveal}
            disabled={confirmed}
            className="btn btn-primary btn-pill"
            style={{ padding: '10px 24px' }}
          >
            翻卡查看
          </button>
        </>
      ) : (
        <>
          <p style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 2, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>
            ─ 答案 ─
          </p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 'var(--sp-3)' }}>
            {back?.text}
          </p>
          {back?.example && (
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, lineHeight: 1.7 }}>
              例：{back.example}
            </p>
          )}
        </>
      )}
    </div>
  );
}
