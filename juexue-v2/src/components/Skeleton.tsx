// 觉学 v2 · Skeleton
// 对应老版 prototypes/shared/skeleton.js
//
// 用法：
//   <Skeleton.Line />
//   <Skeleton.Card />
//   <Skeleton.List count={4} variant="card" />
//   <Skeleton.Title />
//
// 样式来自 components.css 已有 .skel / .skel-line / .skel-card 等
import { type CSSProperties } from 'react';

interface BaseProps {
  style?: CSSProperties;
  className?: string;
}

function Line({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-line ${className}`} style={style} aria-hidden="true" />;
}
function LineSm({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-line-sm ${className}`} style={style} aria-hidden="true" />;
}
function LineLg({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-line-lg ${className}`} style={style} aria-hidden="true" />;
}
function Title({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-title ${className}`} style={style} aria-hidden="true" />;
}
function Meta({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-meta ${className}`} style={style} aria-hidden="true" />;
}
function Pill({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-pill ${className}`} style={style} aria-hidden="true" />;
}
function Avatar({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-avatar ${className}`} style={style} aria-hidden="true" />;
}
function Thumb({ style, className = '' }: BaseProps) {
  return <div className={`skel skel-thumb ${className}`} style={style} aria-hidden="true" />;
}

function Card({ children, style }: { children?: React.ReactNode; style?: CSSProperties }) {
  return (
    <div className="skel-card" style={style} aria-hidden="true">
      {children ?? (
        <>
          <Title style={{ marginBottom: 12 }} />
          <Line style={{ marginBottom: 8 }} />
          <LineSm />
        </>
      )}
    </div>
  );
}

interface ListProps {
  count?: number;
  variant?: 'card' | 'thumb' | 'avatar' | 'simple';
}
function List({ count = 4, variant = 'card' }: ListProps) {
  const items = Array.from({ length: Math.max(1, Math.min(count, 12)) });
  if (variant === 'card') {
    return (
      <div className="skel-list" data-skeleton="1" aria-hidden="true">
        {items.map((_, i) => <Card key={i} />)}
      </div>
    );
  }
  return (
    <div className="skel-list-tight" data-skeleton="1" aria-hidden="true">
      {items.map((_, i) => (
        <div key={i} className="skel-row">
          {variant === 'thumb' && <Thumb />}
          {variant === 'avatar' && <Avatar />}
          <div className="skel-stack">
            <LineLg />
            <LineSm />
          </div>
          {variant === 'thumb' && <Pill />}
        </div>
      ))}
    </div>
  );
}

const Skeleton = { Line, LineSm, LineLg, Title, Meta, Pill, Avatar, Thumb, Card, List };
export default Skeleton;
