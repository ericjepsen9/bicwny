// 学修档案 · /me/stats（自己）· /coach/students/:uid/stats · /admin/users/:uid/stats（教师/admin 看学员）
//   4 维度综合：修学计数 / 观修 / 法本阅读 / 答题
//   admin dashboard 风：KPI hero + 各模块 mini section · 详情走专项页
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { relTime } from '@/lib/relTime';

interface DossierStats {
  practice: {
    streak: number;
    totalCount: number;
    todayCount: number;
    categories: Array<{ categoryId: string; categoryKey: string; categoryName: string; emoji: string; totalCount: number; todayCount: number }>;
  };
  meditation: {
    completedCount: number;
    totalSeconds: number;
    recent: Array<{ meditationId: string; title: string; videoWatchedSec: number; completedAt: string }>;
  };
  reading: {
    totalSeconds: number;
    completedLessons: number;
    inProgressLessons: number;
    byCourse: Array<{ courseId: string; courseTitle: string; coverEmoji: string; completedCount: number; inProgressCount: number; totalSeconds: number; lastReadAt: string }>;
  };
  quiz: {
    totalAnswers: number;
    correctRate: number;
    todayAnswers: number;
    weekAnswers: number;
    streakDays: number;
    sm2: { new: number; learning: number; review: number; mastered: number; due: number; total: number };
    mistakeCount: number;
  };
}

export default function DossierPage() {
  const { s } = useLang();
  const params = useParams<{ uid?: string; id?: string }>();
  const { pathname } = useLocation();

  // 三个路由 · 决定 URL 和 backTo
  const isAdmin = pathname.startsWith('/admin/users/');
  const isCoach = pathname.startsWith('/coach/classes/');
  const targetUid = params.uid;

  const apiPath = isCoach && params.id && targetUid
    ? `/api/coach/classes/${encodeURIComponent(params.id)}/students/${encodeURIComponent(targetUid)}/stats`
    : isAdmin && targetUid
    ? `/api/admin/users/${encodeURIComponent(targetUid)}/stats`
    : '/api/me/stats';

  const backTo = isCoach && params.id
    ? `/coach/classes/${params.id}/students`
    : isAdmin
    ? '/admin/users'
    : '/profile';

  const stats = useQuery({
    queryKey: [apiPath],
    queryFn: ({ signal }) => api.get<DossierStats>(apiPath, { signal }),
  });

  return (
    <>
      <TopNav titles={['学修档案', '學修檔案', 'Dossier']} backTo={backTo} />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

        {stats.isLoading ? <Skeleton.Card /> : !stats.data ? (
          <p style={{ color: 'var(--crimson)' }}>{s('加载失败', '載入失敗', 'Load failed')}</p>
        ) : (
          <>
            {/* 顶部 KPI 4 卡 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
              <Kpi value={stats.data.practice.streak > 0 ? `🔥${stats.data.practice.streak}` : '—'} label={s('连续修学', '連續修學', 'Streak')} color="var(--gold-dark)" />
              <Kpi value={fmtBig(stats.data.practice.totalCount)} label={s('修学累计', '修學累計', 'Practice')} color="var(--saffron-dark)" />
              <Kpi value={`${Math.round(stats.data.quiz.correctRate * 100)}%`} label={s('答题正确率', '答題正確率', 'Accuracy')} color="var(--sage-dark)" />
              <Kpi value={fmtMin(stats.data.reading.totalSeconds + stats.data.meditation.totalSeconds)} label={s('累计时长', '累計時長', 'Total time')} />
            </div>

            {/* 修学计数 section */}
            <Section title="📿" name={s('修学计数', '修學計數', 'Practice')} link={isAdmin || isCoach ? null : '/practice'}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)' }}>
                {stats.data.practice.categories.map((c) => (
                  <Mini key={c.categoryId} emoji={c.emoji} label={c.categoryName} value={String(c.totalCount)} sub={c.todayCount > 0 ? `今日 +${c.todayCount}` : undefined} />
                ))}
              </div>
            </Section>

            {/* 观修 section */}
            <Section title="🧘" name={s('观修', '觀修', 'Meditation')} link={isAdmin || isCoach ? null : '/me/meditations'}>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.6rem', color: 'var(--saffron-dark)' }}>
                    {stats.data.meditation.completedCount}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('已完成', '已完成', 'Completed')}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--ink-2)' }}>
                    {fmtMin(stats.data.meditation.totalSeconds)}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('总时长', '總時長', 'Total time')}</div>
                </div>
              </div>
              {stats.data.meditation.recent.length > 0 && (
                <div style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {stats.data.meditation.recent.slice(0, 3).map((m) => (
                    <div key={m.meditationId + m.completedAt} style={{ display: 'flex', alignItems: 'center', gap: 8, font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                      <span>{relTime(m.completedAt, s)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 法本阅读 section */}
            <Section title="📖" name={s('法本阅读', '法本閱讀', 'Reading')}>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'baseline', marginBottom: 'var(--sp-3)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.6rem', color: 'var(--sage-dark)' }}>
                    {stats.data.reading.completedLessons}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('已读课时', '已讀課時', 'Completed')}</div>
                </div>
                {stats.data.reading.inProgressLessons > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--gold-dark)' }}>
                      {stats.data.reading.inProgressLessons}
                    </div>
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('进行中', '進行中', 'In progress')}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--ink-2)' }}>
                    {fmtMin(stats.data.reading.totalSeconds)}
                  </div>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('总时长', '總時長', 'Total time')}</div>
                </div>
              </div>
              {stats.data.reading.byCourse.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.data.reading.byCourse.map((c) => (
                    <div key={c.courseId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <span>{c.coverEmoji}</span>
                      <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.courseTitle}
                      </span>
                      <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>
                        {c.completedCount}
                      </span>
                      {c.inProgressCount > 0 && (
                        <span style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)' }}>
                          +{c.inProgressCount}
                        </span>
                      )}
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                        {relTime(c.lastReadAt, s)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{s('暂无阅读记录', '暫無閱讀記錄', 'No reading yet')}</p>
              )}
            </Section>

            {/* 答题 section */}
            <Section title="✅" name={s('答题', '答題', 'Quiz')} link={isAdmin || isCoach ? null : '/achievement'}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)' }}>
                <Mini emoji="🔥" label={s('连续', '連續', 'Streak')} value={`${stats.data.quiz.streakDays}`} sub={s('天', '天', 'd')} />
                <Mini emoji="📅" label={s('本周', '本週', 'Week')} value={`${stats.data.quiz.weekAnswers}`} />
                <Mini emoji="🎯" label={s('累计', '累計', 'Total')} value={fmtBig(stats.data.quiz.totalAnswers)} />
                <Mini emoji="❌" label={s('错题', '錯題', 'Mistakes')} value={`${stats.data.quiz.mistakeCount}`} />
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 'var(--sp-3)', letterSpacing: 1 }}>
                {s('SM-2', 'SM-2', 'SM-2')}：{s('新', '新', 'new')} {stats.data.quiz.sm2.new} · {s('学习', '學習', 'learn')} {stats.data.quiz.sm2.learning} · {s('复习', '複習', 'review')} {stats.data.quiz.sm2.review} · {s('掌握', '掌握', 'mastered')} {stats.data.quiz.sm2.mastered}
                {stats.data.quiz.sm2.due > 0 && (
                  <span style={{ marginLeft: 6, color: 'var(--gold-dark)', fontWeight: 700 }}>· {stats.data.quiz.sm2.due} {s('待复习', '待複習', 'due')}</span>
                )}
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, name, link, children }: { title: string; name: string; link?: string | null; children: React.ReactNode }) {
  const head = (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '1.2rem' }}>{title}</span>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', letterSpacing: 2, margin: 0 }}>{name}</h2>
      </div>
      {link && <span style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)' }}>{'查看 ›'}</span>}
    </div>
  );
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      {link ? (
        <Link to={link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          {head}
        </Link>
      ) : head}
      {children}
    </div>
  );
}

function Kpi({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', minHeight: 110, display: 'flex', flexDirection: 'column' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.6rem', color: color ?? 'var(--ink)', letterSpacing: 1, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Mini({ emoji, label, value, sub }: { emoji?: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {emoji && <div style={{ fontSize: '1.1rem' }}>{emoji}</div>}
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>{value}</div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{label}</div>
      {sub && <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{sub}</div>}
    </div>
  );
}

function fmtBig(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
function fmtMin(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
