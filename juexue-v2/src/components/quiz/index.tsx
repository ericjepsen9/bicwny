// 题型 dispatcher · 按 type 选 renderer
import type { QuestionRendererProps } from './types';
import SingleChoice from './SingleChoice';
import MultiChoice from './MultiChoice';
import Fill from './Fill';
import Open from './Open';
import Sort from './Sort';
import Match from './Match';
import Flip from './Flip';

export default function QuestionRenderer(props: QuestionRendererProps) {
  switch (props.question.type) {
    case 'single':   return <SingleChoice {...props} />;
    case 'multi':    return <MultiChoice {...props} />;
    case 'fill':     return <Fill {...props} />;
    case 'open':     return <Open {...props} />;
    case 'sort':     return <Sort {...props} />;
    case 'match':    return <Match {...props} />;
    case 'flip':     return <Flip {...props} />;
    default:
      return (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', color: 'var(--ink-3)', textAlign: 'center' }}>
          题型 {props.question.type} 暂未支持，请用网页版作答
        </div>
      );
  }
}

/** 判断当前 value 是否可提交 · 父组件用之控制按钮 disabled */
export function canSubmit(type: string, value: unknown): boolean {
  if (!value) return false;
  if (type === 'single') return typeof (value as { selectedIndex?: unknown }).selectedIndex === 'number';
  if (type === 'multi') {
    const a = (value as { selectedIndexes?: unknown }).selectedIndexes;
    return Array.isArray(a) && a.length > 0;
  }
  if (type === 'fill') return typeof (value as { selectedOption?: unknown }).selectedOption === 'number';
  if (type === 'open') {
    const t = (value as { text?: unknown }).text;
    return typeof t === 'string' && t.trim().length >= 2;
  }
  if (type === 'sort') {
    const items = (value as { items?: unknown }).items;
    return Array.isArray(items) && items.length >= 2;
  }
  if (type === 'match') {
    const p = (value as { pairs?: Record<string, unknown> }).pairs;
    return !!p && Object.keys(p).length > 0;
  }
  if (type === 'flip') {
    return !!(value as { __placeholder?: unknown }).__placeholder;
  }
  return false;
}
