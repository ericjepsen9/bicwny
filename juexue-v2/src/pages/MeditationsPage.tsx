// MeditationsPage · /admin/meditations · /coach/meditations
//   全局观修浏览页（列表 · 详情 · 编辑）· admin / coach 共用：
//     - 创建入口在闻思管理（课时插槽）· 此页不再支持新建
//     - 元数据 / 上传 / 归档复用 components/MeditationAdmin.tsx
//     - 主要用于：审阅独立观修（无 lessonId）· 跨闻思浏览 · 排查
import { useSearchParams, Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useAdminMeditationDetail, useAdminMeditations } from '@/lib/queries';
import { MeditationFullEditor } from '@/components/MeditationAdmin';

export default function MeditationsPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const list = useAdminMeditations({ includeArchived: false });

  const medId = sp.get('id');
  const detail = useAdminMeditationDetail(medId);

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('观修管理', '觀修管理', 'Meditations')}</h1>
          <p className="page-sub">
            {list.data ? list.data.length + ' ' + s('个 · 含未发布', '個 · 含未發布', 'incl. unpublished') : '…'}
          </p>
        </div>
        <Link
          to="/admin/courses"
          className="btn btn-pill"
          style={{ padding: '8px 14px', background: 'var(--glass-thick)', color: 'var(--ink-2)', border: '1px solid var(--glass-border)', textDecoration: 'none' }}
        >
          {s('+ 新建去闻思管理 →', '+ 新建去聞思管理', 'Create in /admin/courses →')}
        </Link>
      </div>

      <div className="glass-card-thick" style={{ padding: 'var(--sp-3)', marginBottom: 'var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
        💡 {s('观修创建入口已整合到', '觀修創建入口已整合到', 'Creation moved to ')}
        <Link to="/admin/courses" style={{ color: 'var(--saffron-dark)', textDecoration: 'underline' }}>
          {s('闻思管理', '聞思管理', '/admin/courses')}
        </Link>
        {s(' · 进入对应课时点「+ 添加观修」即可。本页用于浏览 / 编辑已有观修。',
          ' · 進入課時點「+ 添加觀修」',
          ' · expand a lesson and click "+ Add meditation". This page is for browse / edit only.')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--sp-5)' }}>
        {/* 左：列表 */}
        <aside style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: 'calc(100vh - var(--sp-8))', overflowY: 'auto' }}>
          {list.isLoading ? (
            <Skeleton.List />
          ) : !list.data || list.data.length === 0 ? (
            <div style={{ padding: 'var(--sp-5)', color: 'var(--ink-3)', textAlign: 'center' }}>
              {s('暂无观修 · 去闻思管理新建', '暫無觀修', 'None · create from /admin/courses')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...list.data].sort((a, b) => a.displayOrder - b.displayOrder || (a.createdAt < b.createdAt ? 1 : -1)).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSp({ id: m.id })}
                  className="glass-card-thick"
                  style={{
                    padding: 'var(--sp-3) var(--sp-4)', textAlign: 'left',
                    border: m.id === medId ? '1px solid var(--saffron)' : '1px solid var(--glass-border)',
                    background: m.id === medId ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                    borderLeft: m.id === medId ? '4px solid var(--saffron)' : '1px solid var(--glass-border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                    <span style={{ fontSize: '1.6rem', width: 36, textAlign: 'center' }}>🧘</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)', letterSpacing: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                        <PubPill published={m.isPublished} />
                        <VideoPill hasVideo={!!m.videoUrl} sec={m.videoDurationSec} />
                        {m.slidesPdfUrl && <span style={{ color: 'var(--ink-3)' }}>· 📄</span>}
                        {!m.lessonId && <span style={{ color: 'var(--ink-4)' }}>· 独立</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* 右：详情 */}
        <section>
          {!medId ? (
            <EmptyHero />
          ) : detail.isLoading ? (
            <Skeleton.Card />
          ) : !detail.data ? (
            <p style={{ color: 'var(--crimson)' }}>{(detail.error as ApiError | undefined)?.message ?? '加载失败'}</p>
          ) : (
            <MeditationFullEditor
              key={detail.data.id}
              m={detail.data}
              onArchived={() => setSp({})}
            />
          )}
        </section>
      </div>
    </>
  );
}

function EmptyHero() {
  const { s } = useLang();
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-7)', textAlign: 'center', color: 'var(--ink-3)' }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 'var(--sp-3)' }}>🧘</div>
      <p style={{ font: 'var(--text-body)', letterSpacing: 1 }}>
        {s('← 选择左侧观修编辑', '← 選擇左側觀修編輯', '← Pick a meditation')}
      </p>
    </div>
  );
}

function PubPill({ published }: { published: boolean }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 'var(--r-pill)',
      background: published ? 'rgba(125,154,108,.15)' : 'var(--border-light)',
      color: published ? 'var(--sage-dark)' : 'var(--ink-3)',
      font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1,
    }}>
      {published ? '✓pub' : '—草稿'}
    </span>
  );
}

function VideoPill({ hasVideo, sec }: { hasVideo: boolean; sec: number }) {
  if (!hasVideo) return <span style={{ color: 'var(--crimson)' }}>· 无视频</span>;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return <span style={{ color: 'var(--sage-dark)' }}>· 🎥 {m}:{String(s).padStart(2, '0')}</span>;
}
