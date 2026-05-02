// AchievementPage · /achievement
//   学习统计：顶部累计答题 ring · 三项指标 · 按法本分列 · 成就墙
import { useMemo } from 'react';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import { useAchievements, useCourses, useProgress, useSm2Stats } from '@/lib/queries';

export default function AchievementPage() {
  const { s } = useLang();
  const progress = useProgress();
  const sm2 = useSm2Stats();
  const courses = useCourses();
  const achievements = useAchievements();

  const correctRate = progress.data ? Math.round(progress.data.correctRate * 100) : 0;
  const streak = progress.data?.streakDays ?? 0;
  const totalAnswered = progress.data?.totalAnswered ?? 0;
  const todayAnswered = progress.data?.todayAnswered ?? 0;
  const due = sm2.data?.totalDue ?? 0;
  const masteredCount = useMemo(() => {
    return (progress.data?.byCourse ?? []).reduce((a, b) => a + (b.masteredCount ?? 0), 0);
  }, [progress.data]);

  // 顶部环：今日答题 / 20 映射 0-100% （视觉简化 · 与老 prototype 一致）
  const ringPct = Math.min(100, Math.round((todayAnswered / 20) * 100));
  const ringDeg = Math.round(ringPct * 3.6);

  // 课程标题映射
  const courseById = useMemo(() => {
    const map: Record<string, { title: string; coverEmoji: string }> = {};
    for (const c of courses.data ?? []) {
      map[c.id] = { title: c.title, coverEmoji: c.coverEmoji || '🪷' };
    }
    return map;
  }, [courses.data]);

  const byCourse = useMemo(() => {
    return (progress.data?.byCourse ?? [])
      .filter((c) => (c.answered ?? 0) > 0)
      .map((c) => {
        const meta = courseById[c.courseId];
        const rate = c.answered > 0 ? Math.round((c.correct / c.answered) * 100) : 0;
        return {
          courseId: c.courseId,
          title: meta?.title || '—',
          emoji: meta?.coverEmoji || '🪷',
          answered: c.answered,
          rate,
        };
      });
  }, [progress.data, courseById]);

  return (
    <div>
      <TopNav titles={['学习统计', '學習統計', 'Stats']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {/* 顶部累计答题 ring */}
        <div style={{ padding: 'var(--sp-6) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: 156,
              height: 156,
              borderRadius: '50%',
              padding: 8,
              background: progress.isLoading
                ? 'conic-gradient(var(--gold-light) 0deg, var(--gold-light) 360deg)'
                : `conic-gradient(var(--gold) 0deg, var(--gold-dark) ${ringDeg}deg, var(--gold-light) ${ringDeg}deg)`,
              boxShadow: '0 6px 22px rgba(184, 137, 86, .18)',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'var(--bg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              {progress.isLoading ? (
                <Skeleton.Title style={{ width: 60 }} />
              ) : (
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '2rem', color: 'var(--ink)', letterSpacing: 1 }}>
                  {totalAnswered}
                </span>
              )}
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2 }}>
                {s('累计答题', '累計答題', 'Answered')}
              </span>
            </div>
          </div>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginTop: 'var(--sp-3)' }}>
            {s(`今日已答 ${todayAnswered} 题`, `今日已答 ${todayAnswered} 題`, `${todayAnswered} answered today`)}
          </p>
        </div>

        {/* 三项指标 */}
        <div
          className="glass-card-thick"
          style={{
            padding: 'var(--sp-4)',
            marginBottom: 'var(--sp-4)',
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
            alignItems: 'center',
          }}
        >
          <Stat
            loading={progress.isLoading}
            value={String(streak)}
            label={s('连续天数', '連續天數', 'Streak')}
          />
          <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 36, width: 1 }} />
          <Stat
            loading={progress.isLoading}
            value={correctRate + '%'}
            label={s('正确率', '正確率', 'Accuracy')}
            color="var(--sage-dark)"
          />
          <div style={{ background: 'var(--border-light)', justifySelf: 'center', height: 36, width: 1 }} />
          <Stat
            loading={progress.isLoading}
            value={String(masteredCount)}
            label={s('已掌握', '已掌握', 'Mastered')}
            color="var(--saffron)"
          />
        </div>

        {/* 待复习提示行 */}
        {due > 0 && (
          <div
            className="glass-card-thick"
            style={{
              padding: 'var(--sp-3) var(--sp-4)',
              marginBottom: 'var(--sp-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              background: 'var(--gold-pale)',
              border: '1px solid var(--gold-light)',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⏰</span>
            <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--gold-dark)', letterSpacing: 1 }}>
              {s(`今日 ${due} 题待复习`, `今日 ${due} 題待複習`, `${due} due today`)}
            </span>
          </div>
        )}

        {/* 按法本分列 */}
        <SectionHead label={s('按法本分列', '按法本分列', 'By text')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
          {progress.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton.Card key={i} />)
          ) : byCourse.length === 0 ? (
            <div style={{ padding: 'var(--sp-4)', textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
              {s('尚未有答题记录', '尚未有答題記錄', 'No answers yet')}
            </div>
          ) : (
            byCourse.map((c) => {
              const chipBg = c.rate >= 80 ? 'var(--sage-light)' : c.rate >= 60 ? 'var(--gold-pale)' : 'rgba(192,57,43,.10)';
              const chipFg = c.rate >= 80 ? 'var(--sage-dark)' : c.rate >= 60 ? 'var(--gold-dark)' : 'var(--crimson)';
              return (
                <div
                  key={c.courseId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    padding: 'var(--sp-3) var(--sp-4)',
                    background: 'var(--glass-thick)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--r-lg)',
                  }}
                >
                  <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{c.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '0.9375rem', letterSpacing: 2, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.title}
                    </p>
                    <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
                      {s(`答 ${c.answered} 题`, `答 ${c.answered} 題`, `${c.answered} answered`)}
                    </p>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '4px 10px',
                      borderRadius: 'var(--r-pill)',
                      font: 'var(--text-caption)',
                      fontWeight: 700,
                      letterSpacing: 1,
                      background: chipBg,
                      color: chipFg,
                    }}
                  >
                    {c.rate}%
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* 成就墙 */}
        <SectionHead
          label={s('成就勋章', '成就勳章', 'Badges')}
          right={
            achievements.data
              ? `${achievements.data.filter((a) => a.earnedAt).length} / ${achievements.data.length}`
              : ''
          }
        />

        {achievements.isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card" style={{ padding: 'var(--sp-3)', textAlign: 'center' }}>
                <Skeleton.Avatar style={{ margin: '0 auto var(--sp-2)' }} />
                <Skeleton.LineSm style={{ width: '70%', margin: '0 auto' }} />
              </div>
            ))}
          </div>
        ) : !achievements.data || achievements.data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--ink-3)' }}>
            {s('继续答题解锁徽章', '繼續答題解鎖徽章', 'Keep answering to unlock')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
            {achievements.data.map((a) => {
              const earned = !!a.earnedAt;
              return (
                <div
                  key={a.id}
                  className={earned ? 'glass-card-thick' : 'glass-card'}
                  style={{
                    padding: 'var(--sp-3)',
                    textAlign: 'center',
                    opacity: earned ? 1 : 0.5,
                    border: earned ? '1px solid var(--saffron-light)' : undefined,
                  }}
                  title={a.description}
                >
                  <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>
                    {earned ? a.icon : '🔒'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--ink)', letterSpacing: 1 }}>
                    {a.name}
                  </div>
                  {a.progress && !earned && (
                    <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 4, letterSpacing: '.5px' }}>
                      {a.progress.current} / {a.progress.target}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color, loading }: { value: string; label: string; color?: string; loading?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {loading ? (
        <div style={{ height: 24, marginBottom: 6 }}>
          <Skeleton.LineSm style={{ width: 40, margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: color ?? 'var(--ink)' }}>
          {value}
        </div>
      )}
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function SectionHead({ label, right }: { label: string; right?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
      <h2 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
        {label}
      </h2>
      {right && (
        <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>{right}</span>
      )}
    </div>
  );
}
