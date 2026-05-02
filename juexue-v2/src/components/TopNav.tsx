// TopNav · 二级页头部 · 返回 + 三语标题 + 可选 right slot
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/i18n';

interface Props {
  /** 三语标题 [sc, tc, en] */
  titles: [string, string, string];
  /** 自定义返回 · 不传则 nav(-1) */
  onBack?: () => void;
  /** 右侧 slot · 通常放 action button */
  right?: ReactNode;
}

export default function TopNav({ titles, onBack, right }: Props) {
  const { s } = useLang();
  const nav = useNavigate();
  const back = () => (onBack ? onBack() : nav(-1));

  return (
    <div className="top-nav">
      <button
        type="button"
        className="nav-back"
        onClick={back}
        aria-label={s('返回', '返回', 'Back')}
      >
        <svg width="18" height="18" fill="none" stroke="#55463A" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="nav-title">
        <span className="sc">{titles[0]}</span>
        <span className="tc">{titles[1]}</span>
        <span className="en">{titles[2]}</span>
      </span>
      {right ?? <div style={{ width: 34 }} />}
    </div>
  );
}
