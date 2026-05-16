// 法本阅读 · 目录抽屉（Dialog · sheet variant）
//   - 按 chapter 分组 · lesson 列表
//   - 当前课时高亮 · 已学打勾 · 点击直跳（replace）
import { Link } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import { useLang } from '@/lib/i18n';

interface ChapterRef {
  id: string;
  order: number;
  title: string;
  lessons?: Array<{ id: string; order: number; title: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseSlug: string;
  chapters: ChapterRef[];
  currentLessonId: string;
  completedLessonIds: string[];
}

export default function ReadingTocSheet({
  open,
  onClose,
  courseSlug,
  chapters,
  currentLessonId,
  completedLessonIds,
}: Props) {
  const { s } = useLang();
  const doneSet = new Set(completedLessonIds);

  return (
    <Dialog open={open} onClose={onClose} title={s('目录', '目錄', 'Catalog')}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: 'var(--sp-2) 0' }}>
        {chapters.map((ch) => (
          <div key={ch.id} style={{ marginBottom: 'var(--sp-3)' }}>
            <div style={{
              font: 'var(--text-caption)',
              color: 'var(--ink-3)',
              letterSpacing: 2,
              fontWeight: 700,
              padding: 'var(--sp-2) 0',
            }}>
              {s('第 ' + ch.order + ' 章', '第 ' + ch.order + ' 章', 'Ch ' + ch.order)} · {ch.title}
            </div>
            <div className="menu-card">
              {(ch.lessons ?? []).map((l) => {
                const done = doneSet.has(l.id);
                const isCur = l.id === currentLessonId;
                return (
                  <Link
                    key={l.id}
                    to={`/read/${courseSlug}/${l.id}`}
                    replace
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-3)',
                      padding: 'var(--sp-3) var(--sp-4)',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: isCur ? 'var(--saffron-pale)' : 'transparent',
                      borderLeft: isCur ? '3px solid var(--saffron)' : '3px solid transparent',
                    }}
                  >
                    <span style={{ minWidth: 24, font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 700 }}>
                      {l.order}
                    </span>
                    <span style={{ flex: 1, font: 'var(--text-body)', color: isCur ? 'var(--saffron-dark)' : 'var(--ink)' }}>
                      {l.title}
                    </span>
                    {done && (
                      <span style={{ fontSize: 14, color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>
                    )}
                    {isCur && !done && (
                      <span style={{ fontSize: 12, color: 'var(--saffron-dark)', fontWeight: 700 }}>{s('当前', '當前', 'Now')}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
