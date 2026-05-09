// 学修档案 · /me/stats（自己）· /coach/students/:uid/stats · /admin/users/:uid/stats（教师/admin 看学员）
//   多维综合：班级任务 / 修学计数 / 观修 / 法本阅读 / 已选法本 / 答题
//   admin dashboard 风：KPI hero + 各模块完整数据
import { useState } from 'react';
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
    dailySeries: Array<{ date: string; count: number }>;
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
    byCourse: Array<{
      courseId: string;
      courseTitle: string;
      coverEmoji: string;
      completedCount: number;
      inProgressCount: number;
      totalSeconds: number;
      lastReadAt: string;
      lessons: Array<{
        lessonId: string;
        lessonTitle: string;
        chapterTitle: string;
        scrollPercent: number;
        totalSeconds: number;
        isCompleted: boolean;
        lastReadAt: string;
      }>;
    }>;
  };
  quiz: {
    totalAnswers: number;
    correctRate: number;
    todayAnswers: number;
    weekAnswers: number;
    streakDays: number;
    sm2: { new: number; learning: number; review: number; mastered: number; due: number; total: number };
    mistakeCount: number;
    recentMistakes: Array<{ questionId: string; questionText: string; wrongCount: number; lastWrongAt: string }>;
  };
  classTasks: Array<{
    id: string;
    classId: string;
    className: string;
    projectId: string;
    projectName: string;
    projectEmoji: string | null;
    title: string | null;
    mode: 'daily' | 'fixed';
    target: number;
    progress: number;
    isDone: boolean;
    startAt: string;
    endAt: string | null;
  }>;
  enrolledCourses: Array<{
    courseId: string;
    courseTitle: string;
    coverEmoji: string;
    lessonsCompleted: number;
    lessonsTotal: number;
    lastStudiedAt: string | null;
  }>;
}

export default function DossierPage() {
  const { s } = useLang();
  const params = useParams<{ uid?: string; id?: string }>();
  const { pathname } = useLocation();

  const isAdmin = pathname.startsWith('/admin/users/');
  const isCoach = pathname.startsWith('/coach/classes/');
  const targetUid = params.uid;
  const isViewingSelf = !isAdmin && !isCoach;

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
            {/* KPI 4 卡 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)' }}>
              <Kpi value={stats.data.practice.streak > 0 ? `🔥${stats.data.practice.streak}` : '—'} label={s('连续修学', '連續修學', 'Streak')} color="var(--gold-dark)" />
              <Kpi value={fmtBig(stats.data.practice.totalCount)} label={s('修学累计', '修學累計', 'Practice')} color="var(--saffron-dark)" />
              <Kpi value={`${Math.round(stats.data.quiz.correctRate * 100)}%`} label={s('答题正确率', '答題正確率', 'Accuracy')} color="var(--sage-dark)" />
              <Kpi value={fmtMin(stats.data.reading.totalSeconds + stats.data.meditation.totalSeconds)} label={s('累计时长', '累計時長', 'Total time')} />
            </div>

            {/* 班级任务（如有） */}
            {stats.data.classTasks.length > 0 && (
              <Section title="📌" name={s('班级任务', '班級任務', 'Class tasks')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {stats.data.classTasks.map((t) => {
                    const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
                    return (
                      <div key={t.id} style={{ padding: 'var(--sp-3)', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', fontWeight: 700 }}>{t.className}</span>
                            <div style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.2 }}>
                              {t.projectEmoji ?? ''} {t.title || t.projectName}
                            </div>
                          </div>
                          {t.isDone && <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓ 完成</span>}
                        </div>
                        <Bar progress={t.progress} target={t.target} done={t.isDone} />
                        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
                          {t.progress} / {t.target} · {pct}%
                          {t.endAt && ` · 截止 ${new Date(t.endAt).toLocaleDateString()}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* 修学计数 + 30 天柱图 */}
            <Section title="📿" name={s('修学计数', '修學計數', 'Practice')} link={isViewingSelf ? '/practice' : null}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
                {stats.data.practice.categories.map((c) => (
                  <Mini key={c.categoryId} emoji={c.emoji} label={c.categoryName} value={String(c.totalCount)} sub={c.todayCount > 0 ? `今日 +${c.todayCount}` : undefined} />
                ))}
              </div>
              {stats.data.practice.dailySeries.length > 0 && (
                <DailyMiniChart series={stats.data.practice.dailySeries} color="var(--saffron-dark)" />
              )}
            </Section>

            {/* 观修完整列表（≤ 10） */}
            <Section title="🧘" name={s('观修', '觀修', 'Meditation')} link={isViewingSelf ? '/me/meditations' : null}>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'baseline', marginBottom: 'var(--sp-3)' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {stats.data.meditation.recent.map((m) => (
                    <div key={m.meditationId + m.completedAt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--border-light)', font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                      <span style={{ color: 'var(--ink-4)' }}>{Math.round(m.videoWatchedSec / 60)} min</span>
                      <span style={{ color: 'var(--ink-4)' }}>{relTime(m.completedAt, s)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 法本阅读 · 课程展开看每节课时进度 */}
            <Section title="📖" name={s('法本阅读', '法本閱讀', 'Reading')}>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'baseline', marginBottom: 'var(--sp-3)' }}>
                <Mini value={String(stats.data.reading.completedLessons)} label={s('已读', '已讀', 'Done')} />
                <Mini value={String(stats.data.reading.inProgressLessons)} label={s('进行中', '進行中', 'WIP')} />
                <Mini value={fmtMin(stats.data.reading.totalSeconds)} label={s('时长', '時長', 'Time')} />
              </div>
              {stats.data.reading.byCourse.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {stats.data.reading.byCourse.map((c) => <ReadingCourseCard key={c.courseId} c={c} />)}
                </div>
              ) : (
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{s('暂无阅读记录', '暫無閱讀記錄', 'No reading yet')}</p>
              )}
            </Section>

            {/* 已选法本（含未读的 · 看整体进度） */}
            {stats.data.enrolledCourses.length > 0 && (
              <Section title="📚" name={s('已选法本', '已選法本', 'Enrollments')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {stats.data.enrolledCourses.map((e) => {
                    const pct = e.lessonsTotal > 0 ? Math.round((e.lessonsCompleted / e.lessonsTotal) * 100) : 0;
                    return (
                      <div key={e.courseId} style={{ padding: 'var(--sp-3)', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                          <span>{e.coverEmoji}</span>
                          <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.2 }}>
                            {e.courseTitle}
                          </span>
                          <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>
                            {e.lessonsCompleted}/{e.lessonsTotal}
                          </span>
                        </div>
                        <Bar progress={e.lessonsCompleted} target={e.lessonsTotal} done={pct === 100} />
                        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
                          {pct}%{e.lastStudiedAt && ` · ${relTime(e.lastStudiedAt, s)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* 答题 · 含 sm2 + 错题列表 */}
            <Section title="✅" name={s('答题', '答題', 'Quiz')} link={isViewingSelf ? '/achievement' : null}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
                <Mini emoji="🔥" label={s('连续', '連續', 'Streak')} value={`${stats.data.quiz.streakDays}`} sub={s('天', '天', 'd')} />
                <Mini emoji="📅" label={s('本周', '本週', 'Week')} value={`${stats.data.quiz.weekAnswers}`} />
                <Mini emoji="🎯" label={s('累计', '累計', 'Total')} value={fmtBig(stats.data.quiz.totalAnswers)} />
                <Mini emoji="❌" label={s('错题', '錯題', 'Mistakes')} value={`${stats.data.quiz.mistakeCount}`} />
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-3)' }}>
                SM-2：{s('新', '新', 'new')} {stats.data.quiz.sm2.new} · {s('学习', '學習', 'learn')} {stats.data.quiz.sm2.learning} · {s('复习', '複習', 'review')} {stats.data.quiz.sm2.review} · {s('掌握', '掌握', 'mastered')} {stats.data.quiz.sm2.mastered}
                {stats.data.quiz.sm2.due > 0 && (
                  <span style={{ marginLeft: 6, color: 'var(--gold-dark)', fontWeight: 700 }}>· {stats.data.quiz.sm2.due} {s('待复习', '待複習', 'due')}</span>
                )}
              </div>
              {stats.data.quiz.recentMistakes.length > 0 && (
                <>
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 6 }}>{s('最近错题', '最近錯題', 'Recent mistakes')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {stats.data.quiz.recentMistakes.map((m) => (
                      <div key={m.questionId} style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: '1px solid var(--border-light)', font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.questionText}</span>
                        <span style={{ color: 'var(--crimson)', fontWeight: 700 }}>×{m.wrongCount}</span>
                        <span style={{ color: 'var(--ink-4)' }}>{relTime(m.lastWrongAt, s)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function ReadingCourseCard({ c }: { c: DossierStats['reading']['byCourse'][0] }) {
  const { s } = useLang();
  const [open, setOpen] = useState(false);
  const total = c.completedCount + c.inProgressCount;
  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: 'var(--sp-3)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{c.coverEmoji}</span>
        <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1.2 }}>
          {c.courseTitle}
        </span>
        <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>{c.completedCount}</span>
        {c.inProgressCount > 0 && <span style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)' }}>+{c.inProgressCount}</span>}
        <span style={{ color: 'var(--ink-3)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 var(--sp-3) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.lessons.map((l) => (
            <div key={l.lessonId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--border-light)', font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
              <span style={{ color: l.isCompleted ? 'var(--sage-dark)' : 'var(--gold-dark)', fontWeight: 700, minWidth: 16 }}>
                {l.isCompleted ? '✓' : '·'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.chapterTitle} · {l.lessonTitle}
              </span>
              {!l.isCompleted && <span style={{ color: 'var(--ink-4)' }}>{l.scrollPercent}%</span>}
              <span style={{ color: 'var(--ink-4)' }}>{relTime(l.lastReadAt, s)}</span>
            </div>
          ))}
          {c.lessons.length === 0 && (
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', textAlign: 'center', padding: 'var(--sp-3) 0' }}>
              （{s('暂无明细', '暫無明細', 'No detail')}）
            </p>
          )}
          {total < 3 && (
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
              {s(`仅显示已读/进行中课时 · 完整课时表请查看法本目录`, `僅顯示已讀/進行中課時`, 'Only completed/in-progress lessons shown')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DailyMiniChart({ series, color }: { series: Array<{ date: string; count: number }>; color: string }) {
  const max = Math.max(1, ...series.map((d) => d.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 50, padding: '0 2px' }}>
      {series.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div
            key={d.date}
            style={{
              flex: 1,
              minWidth: 4,
              height: `${Math.max(2, pct)}%`,
              background: d.count > 0 ? color : 'var(--border-light)',
              borderRadius: 2,
              opacity: d.count > 0 ? 1 : 0.4,
            }}
            title={`${d.date.slice(5)}: ${d.count}`}
          />
        );
      })}
    </div>
  );
}

function Bar({ progress, target, done }: { progress: number; target: number; done: boolean }) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--glass)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--sage-dark)' : 'linear-gradient(90deg, var(--saffron) 0%, var(--saffron-dark) 100%)' }} />
    </div>
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
