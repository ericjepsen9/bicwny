// 法本阅读正文区
//   - 章节标题 + 课题
//   - article 段落渲染 · 含高亮 + 笔记 💬 icon
//   - 字号 / 行距按语言基线自适应（优化 5）
//   - 点击正文 toggle chromeVisible
import { memo, type Ref } from 'react';
import { Link } from 'react-router-dom';
import type { Highlight } from '@/lib/queries';
import { useLang } from '@/lib/i18n';
import { renderParaWithHighlights, splitParagraphs } from '@/lib/reading-utils';

interface LessonNote {
  id: string;
  title: string;
  anchorText: string | null;
  anchorIndex: number | null;
  body: string;
}

interface Props {
  articleRef: Ref<HTMLElement>;
  chapterTitle: string;
  lessonOrder: number;
  lessonTitle: string;
  lessonReferenceText: string | null | undefined;
  flatIdx: number;
  flatTotal: number;
  completed: boolean;
  notesByAnchor: Map<number, LessonNote[]>;
  highlightsByPara: Map<number, Highlight[]>;
  onDeleteHighlight: (id: string) => void;
  onToggleChrome: () => void;
}

function ReadingArticle({
  articleRef,
  chapterTitle,
  lessonOrder,
  lessonTitle,
  lessonReferenceText,
  flatIdx,
  flatTotal,
  completed,
  notesByAnchor,
  highlightsByPara,
  onDeleteHighlight,
  onToggleChrome,
}: Props) {
  const { s, lang } = useLang();

  return (
    <div
      onClick={onToggleChrome}
      style={{
        padding: '0 var(--sp-5) calc(var(--sp-8) + 80px)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        font: 'var(--text-caption)',
        color: 'var(--ink-3)',
        letterSpacing: '1.5px',
        marginBottom: 'var(--sp-2)',
      }}>
        {chapterTitle} · {s('第 ' + lessonOrder + ' 课', '第 ' + lessonOrder + ' 課', 'Lesson ' + lessonOrder)}
        <span style={{ marginLeft: 8, color: 'var(--ink-4)' }}>· {flatIdx + 1} / {flatTotal}</span>
        {completed && <span style={{ color: 'var(--sage-dark)', marginLeft: 8 }}>· ✓ {s('已学', '已學', 'Done')}</span>}
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: '1.375rem',
          color: 'var(--ink)',
          letterSpacing: 4,
          marginBottom: 'var(--sp-4)',
        }}
      >
        {lessonTitle}
      </h1>

      {/* 原文 · 按段落拆 · 段落旁显示笔记 💬 · 选段弹「加笔记」气泡
          字号 / 行距按语言基线自适应（优化 5）:
            - 简体 (sc)：1rem · 1.9 · 1px（沿用现有 · 不变）
            - 繁体 (tc)：1.05rem · 1.95 · 1px（笔画复杂 · 字号 +5% · 行距略宽）
            - 英文 (en)：1rem · 1.7 · 0（字母窄 · 行距收紧 · 字距取消）
          额外字号缩放仍受 useFontScale 全局 --font-scale 影响（叠加倍率）*/}
      <article
        ref={articleRef}
        style={{
          padding: 'var(--sp-2) 0 var(--sp-3)',
          font: 'var(--text-body-serif)',
          fontSize: lang === 'tc' ? '1.05rem' : '1rem',
          lineHeight: lang === 'en' ? 1.7 : (lang === 'tc' ? 1.95 : 1.9),
          letterSpacing: lang === 'en' ? 0 : 1,
          color: 'var(--ink)',
          wordBreak: 'break-word',
        }}
      >
        {(lessonReferenceText ?? '').trim() ? (
          splitParagraphs(lessonReferenceText!).map((para, idx) => {
            const notes = notesByAnchor.get(idx) ?? [];
            const paraHighlights = highlightsByPara.get(idx) ?? [];
            return (
              <p
                key={idx}
                data-paragraph-index={idx}
                style={{
                  margin: '0 0 var(--sp-3)',
                  whiteSpace: 'pre-wrap',
                  position: 'relative',
                  paddingRight: notes.length > 0 ? 28 : 0,
                }}
              >
                {renderParaWithHighlights(para, paraHighlights, onDeleteHighlight)}
                {notes.length > 0 && (
                  <Link
                    to={`/notes/${notes[0]!.id}`}
                    aria-label={`本段有 ${notes.length} 条笔记`}
                    title={notes.map((n) => n.title || '(无标题)').join(' · ')}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      fontSize: '0.95rem',
                      color: 'var(--saffron-dark)',
                      textDecoration: 'none',
                      background: 'var(--saffron-pale)',
                      borderRadius: '50%',
                      width: 22,
                      height: 22,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    💬{notes.length > 1 ? notes.length : ''}
                  </Link>
                )}
              </p>
            );
          })
        ) : (
          <p>{s('（本课时尚无原文）', '（本課時尚無原文）', '(No reference text yet)')}</p>
        )}
      </article>
    </div>
  );
}

export default memo(ReadingArticle);
