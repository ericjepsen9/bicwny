// AchievementPage · /achievement
//   学习统计：streak / 正确率 / 累计 / SM2 / 徽章墙
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';
import { useAchievements, useProgress, useSm2Stats } from '@/lib/queries';

export default function AchievementPage() {
  const { s } = useLang();
  const progress = useProgress();
  const sm2 = useSm2Stats();
  const achievements = useAchievements();

  const correctRate = progress.data ? Math.round(progress.data.correctRate * 100) : 0;
  const streak = progress.data?.streakDays ?? 0;
  const totalAnswered = progress.data?.totalAnswered ?? 0;
  const todayAnswered = progress.data?.todayAnswered ?? 0;
  const due = sm2.data?.totalDue ?? 0;

  return (
    <div>
      <TopNav titles={['学习统计', '學習統計', 'Stats']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {/* 主统计四宫 */}
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <BigStat loading={progress.isLoading} value={String(streak)} label={s('连续天数', '連續天數', 'Streak')} suffix={s('天', '天', 'd')} color="var(--saffron)" />
            <BigStat loading={progress.isLoading} value={correctRate + '%'} label={s('正确率', '正確率', 'Accuracy')} color="var(--sage-dark)" />
            <BigStat loading={progress.isLoading} value={String(totalAnswered)} label={s('累计答题', '累計答題', 'Answered')} color="var(--ink)" />
            <BigStat loading={sm2.isLoading} value={String(due)} label={s('待复习', '待複習', 'Due')} color="var(--gold-dark)" />
          </div>
        </div>

        {/* 今日 */}
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
            ☀️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1 }}>
              {s('今日答题', '今日答題', 'Today')}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2, marginTop: 2 }}>
              {todayAnswered}
            </div>
          </div>
        </div>

        {/* 徽章墙 */}
        <h2 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
          {s('徽章', '徽章', 'Badges')}
        </h2>

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

function BigStat({ value, label, suffix, color, loading }: { value: string; label: string; suffix?: string; color?: string; loading?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {loading ? (
        <div style={{ height: 28, marginBottom: 6 }}>
          <Skeleton.LineLg style={{ width: 60, margin: '0 auto' }} />
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.625rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>
          {value}{suffix && <span style={{ fontSize: '0.875rem', marginLeft: 4, fontWeight: 500 }}>{suffix}</span>}
        </div>
      )}
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
