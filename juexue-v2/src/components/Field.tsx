// 表单字段组件 · label + input + error
//   - 复用 base.css 已有 .input-field（如果没就用内联）
//   - 一律 controlled · 父组件控值
import { type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

export default function Field({ label, value, onChange, error, id, ...rest }: Props) {
  const fieldId = id || `f-${label.replace(/\s/g, '')}`;
  return (
    <div>
      <label
        htmlFor={fieldId}
        style={{
          display: 'block',
          font: 'var(--text-caption)',
          color: 'var(--ink-3)',
          letterSpacing: 2,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 'var(--r)',
          border: '1px solid ' + (error ? 'var(--crimson)' : 'var(--border)'),
          background: 'var(--bg-input)',
          color: 'var(--ink)',
          font: 'var(--text-body)',
          letterSpacing: '.5px',
          outline: 'none',
        }}
        {...rest}
      />
      {error && (
        <p
          style={{
            color: 'var(--crimson)',
            font: 'var(--text-caption)',
            marginTop: 4,
            letterSpacing: '.5px',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
