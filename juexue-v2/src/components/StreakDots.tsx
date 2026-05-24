// StreakDots · 本周连续打卡可视化
//   7 个圆点 · 右起填充 min(streak, 7) 个（最右是"今日"）· 下方有星期标签
//   streak=0 时今天那个点显示空心橙圈（提示"今天还可以打卡"）
//
// 用法：
//   <StreakDots streak={progress.data?.streakDays ?? 0} />

interface Props {
  streak: number;
}

const DOW_SC = ['日', '一', '二', '三', '四', '五', '六'];

export default function StreakDots({ streak }: Props) {
  const filled = Math.max(0, Math.min(7, streak));
  const todayDow = new Date().getDay();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const isFilled = i >= 7 - filled;
          const isToday = i === 6;
          let bg = 'transparent';
          let border = '1.5px dashed var(--border)';
          let shadow = 'none';
          if (isFilled) {
            bg = 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))';
            border = 'none';
            shadow = '0 2px 6px rgba(224,120,86,.25)';
          } else if (isToday) {
            border = '2px solid var(--saffron)';
            bg = 'var(--saffron-pale)';
          }
          return (
            <span
              key={i}
              title={isToday ? '今天' : ''}
              style={{
                flex: 1,
                height: 18,
                borderRadius: '50%',
                background: bg,
                border,
                maxWidth: 32,
                minWidth: 16,
                alignSelf: 'center',
                boxShadow: shadow,
                transition: 'all .2s var(--ease)',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const dow = (todayDow - 6 + i + 7) % 7;
          const isToday = i === 6;
          return (
            <span
              key={i}
              style={{
                flex: 1,
                font: 'var(--text-caption)',
                color: isToday ? 'var(--saffron-dark)' : 'var(--ink-4)',
                fontWeight: isToday ? 700 : 400,
                letterSpacing: 0,
                fontSize: '.6875rem',
                textAlign: 'center',
                maxWidth: 32,
                minWidth: 16,
              }}
            >
              {DOW_SC[dow]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
