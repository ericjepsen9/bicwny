// 速记卡 · payload { front:{text,subText?}, back:{text,example?}, noScoring:true }
//   不评分 · 用户翻卡查看 · "已记住" / "再练" 二选一推进
//   3D 翻面：perspective + transform: rotateY(180deg) · 与老 prototype 视觉一致
import { useState } from 'react';
import type { QuestionRendererProps } from './types';

export default function Flip({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const front = question.payload.front as { text: string; subText?: string } | undefined;
  const back = question.payload.back as { text: string; example?: string } | undefined;
  const [flipped, setFlipped] = useState(!!value);

  function reveal() {
    if (confirmed) return;
    setFlipped((f) => !f);
    onChange({ __placeholder: true }); // 标记已查看 · 后端不参与评分
  }

  const cardCommon: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    background: 'var(--glass-thick)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--r-lg)',
    padding: 'var(--sp-5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 'var(--sp-3)',
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={confirmed ? -1 : 0}
        onClick={reveal}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); } }}
        aria-label={flipped ? '翻回正面' : '翻卡查看'}
        style={{
          position: 'relative',
          minHeight: 240,
          perspective: 1200,
          cursor: confirmed ? 'default' : 'pointer',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: 240,
            transformStyle: 'preserve-3d',
            transition: 'transform .55s cubic-bezier(.4,0,.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* 正面 */}
          <div style={cardCommon}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 4, marginBottom: 'var(--sp-2)' }}>
              {front?.text}
            </p>
            {front?.subText && (
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
                {front.subText}
              </p>
            )}
            <span
              style={{
                marginTop: 'var(--sp-3)',
                font: 'var(--text-caption)',
                color: 'var(--ink-4)',
                letterSpacing: 2,
              }}
            >
              ↻ {confirmed ? '点击翻面' : '点击查看答案'}
            </span>
          </div>
          {/* 背面 · 旋转 180° 让正面朝外 */}
          <div style={{ ...cardCommon, transform: 'rotateY(180deg)' }}>
            <p style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 2, fontWeight: 700 }}>
              ─ 答案 ─
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.7 }}>
              {back?.text}
            </p>
            {back?.example && (
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, lineHeight: 1.7 }}>
                例：{back.example}
              </p>
            )}
            <span
              style={{
                marginTop: 'var(--sp-2)',
                font: 'var(--text-caption)',
                color: 'var(--ink-4)',
                letterSpacing: 2,
              }}
            >
              ↻ 点击翻回
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
