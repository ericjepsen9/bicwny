// ClassSessionDetailPage · /class/:id/sessions/:sid
//   单场班级共修详情（push / banner 跳转目标）
//   - 状态色：预告 normal · T-30 临近 · T-5 倒数 · T-0 进行中 critical · 已结束
//   - 倒计时（前端 setInterval · 不依赖 push）
//   - 主 CTA「加入直播 ↗」target=_blank 跳 liveLink（如有）
//   - 与 AssemblyDetailPage 区别：临场感更强 · 倒计时显著 · severity 动态
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import { useClassSessionDetail } from '@/lib/queries';

// 倒计时 hook · 每秒 tick
function useCountdown(targetIso: string | undefined): { ms: number; phase: 'far' | 't30' | 't5' | 'live' | 'ended' } {
  const [ms, setMs] = useState(() => targetIso ? new Date(targetIso).getTime() - Date.now() : 0);
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => setMs(new Date(targetIso).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  let phase: 'far' | 't30' | 't5' | 'live' | 'ended' = 'far';
  if (ms <= 0) phase = 'live';
  else if (ms <= 5 * 60_000) phase = 't5';
  else if (ms <= 30 * 60_000) phase = 't30';
  return { ms, phase };
}

// 倒计时显示 · MM:SS（< 60min）或 「X 小时 Y 分」（≥ 60min）
function formatCountdown(ms: number, s: (sc: string, tc: string, en: string) => string): string {
  if (ms <= 0) return s('已开始', '已開始', 'Started');
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return s(`${hours} 小时 ${min} 分后开始`, `${hours} 小時 ${min} 分後開始`, `${hours}h ${min}m`);
  }
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ClassSessionDetailPage() {
  const { s } = useLang();
  const { id: classId, sid } = useParams<{ id: string; sid: string }>();
  const q = useClassSessionDetail(classId ?? null, sid ?? null);

  const sess = q.data;
  const { ms, phase } = useCountdown(sess?.startAt);

  // 已结束判断 · 单独算（不在 useCountdown 内 · 因为依赖 durationMin）
  const isEnded = sess
    ? Date.now() > new Date(sess.startAt).getTime() + sess.durationMin * 60_000
    : false;
  const effectivePhase = isEnded ? 'ended' : phase;

  const phaseConfig = {
    far: { color: { bg: 'var(--glass)', text: 'var(--ink-3)', border: 'var(--border)' }, label: s('共修预告', '共修預告', 'Upcoming') },
    t30: { color: { bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' }, label: s('即将开始', '即將開始', 'Starting soon') },
    t5: { color: { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' }, label: s('马上开始', '馬上開始', 'Starting') },
    live: { color: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' }, label: s('🔴 进行中', '🔴 進行中', '🔴 Live') },
    ended: { color: { bg: 'var(--glass)', text: 'var(--ink-3)', border: 'var(--border)' }, label: s('已结束', '已結束', 'Ended') },
  }[effectivePhase];

  // 主 CTA 显隐：T-30 起到结束前都显示
  const showJoinCTA = sess?.liveLink && !isEnded && (phase === 't30' || phase === 't5' || phase === 'live');

  return (
    <div>
      <TopNav titles={['共修', '共修', 'Session'] as any} backTo={classId ? `/class/${classId}` : '/'} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {q.isLoading ? (
          <Skeleton.Card />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !sess ? (
          <EmptyState icon="🧘" title={s('共修不存在', '共修不存在', 'Not found')} />
        ) : (
          <div
            className="glass-card-thick"
            style={{
              padding: 'var(--sp-5)',
              opacity: isEnded ? 0.75 : 1,
            }}
          >
            {/* 状态 chip + 倒计时 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--sp-3)' }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: phaseConfig.color.bg,
                  color: phaseConfig.color.text,
                  border: '1px solid ' + phaseConfig.color.border,
                  font: 'var(--text-caption)',
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {phaseConfig.label}
              </span>
              {!isEnded && phase !== 'live' && (
                <span
                  style={{
                    font: 'var(--text-caption)',
                    color: phase === 't5' ? '#D97706' : 'var(--ink-3)',
                    fontWeight: phase === 't5' ? 600 : 400,
                    fontFamily: phase === 't5' ? 'monospace' : 'inherit',
                    fontSize: phase === 't5' ? '1rem' : 'inherit',
                  }}
                >
                  ⏱ {formatCountdown(ms, s)}
                </span>
              )}
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '1.375rem',
                color: 'var(--ink)',
                letterSpacing: 1.5,
                marginBottom: 'var(--sp-2)',
              }}
            >
              {sess.title}
            </h1>

            <div
              style={{
                font: 'var(--text-body)',
                color: 'var(--ink-3)',
                letterSpacing: 1,
                marginBottom: 'var(--sp-3)',
              }}
            >
              {s('班级：', '班級：', 'Class: ')}{sess.className}
            </div>

            {/* 时间 */}
            <div
              style={{
                font: 'var(--text-body)',
                color: 'var(--ink-2)',
                letterSpacing: '.5px',
                lineHeight: 1.6,
                marginBottom: 'var(--sp-4)',
              }}
            >
              {new Date(sess.startAt).toLocaleString()} · {sess.durationMin} {s('分钟', '分鐘', 'min')}
            </div>

            {/* 主 CTA · 加入直播 */}
            {showJoinCTA && (
              <div style={{ marginBottom: 'var(--sp-4)' }}>
                <a
                  href={sess.liveLink!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    background: phase === 'live' ? '#DC2626' : 'var(--saffron)',
                    color: '#fff',
                    borderRadius: 8,
                    font: 'var(--text-body)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textDecoration: 'none',
                    boxShadow: phase === 'live' ? '0 4px 12px rgba(220, 38, 38, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {phase === 'live'
                    ? s('🔴 进入直播间 ↗', '🔴 進入直播間 ↗', '🔴 Join Live ↗')
                    : s('加入直播 ↗', '加入直播 ↗', 'Join ↗')}
                </a>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 6 }}>
                  {s('点击跳外部直播链接（Zoom / 腾讯会议等）', '點擊跳外部直播連結（Zoom / 騰訊會議等）', 'Opens external (Zoom / etc.)')}
                </div>
              </div>
            )}

            {/* liveLink 未填 · 提示用户 */}
            {!sess.liveLink && !isEnded && (
              <div
                style={{
                  padding: 'var(--sp-3)',
                  background: 'var(--glass)',
                  borderRadius: 8,
                  color: 'var(--ink-3)',
                  font: 'var(--text-caption)',
                  marginBottom: 'var(--sp-4)',
                }}
              >
                {s('辅导员尚未填写直播链接 · 请等待或联系辅导员', '輔導員尚未填寫直播連結 · 請等待或聯絡輔導員', 'Live link not set yet')}
              </div>
            )}

            {/* 描述 */}
            {sess.description && (
              <div
                style={{
                  font: 'var(--text-body)',
                  color: 'var(--ink-2)',
                  letterSpacing: '.5px',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  paddingTop: 'var(--sp-3)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                {sess.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
