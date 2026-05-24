// 补签卡 · 学员自助补救「修学打卡」连续天数（streak）
//   规则（后端 modules/practice/makeup.ts）：只能补最近 7 天内的过去某日 · 每周(美东) 1 次
//   空缺日（无计数 & 未补签）才可补 · 已打卡 / 已补签的日标 ✓ · 不可重复补
//   统计按美东时间(America/New_York)计日 —— 所有日期键由后端给出 · 前端不做时区换算
import { useMemo, useState } from 'react';
import Dialog from '@/components/Dialog';
import { ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { usePracticeHistory, usePracticeMakeup, usePracticeSummary } from '@/lib/queries';

const DOW = ['日', '一', '二', '三', '四', '五', '六'];
type DayStatus = 'done' | 'makeup' | 'gap';

// 闭区间 [from, to] 的每个日历日键（YYYY-MM-DD）· 用 UTC 逐日推进 · 仅取标签不涉时区
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function label(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `周${DOW[dow]} ${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

export default function MakeupCard() {
  const { s } = useLang();
  const summary = usePracticeSummary();
  const history = usePracticeHistory();
  const makeupMut = usePracticeMakeup();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);

  const mk = summary.data?.makeup;

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of history.data?.dailySeries ?? []) m.set(r.date, r.count);
    return m;
  }, [history.data]);

  const days = useMemo(() => {
    if (!mk) return [];
    return eachDay(mk.earliestDate, mk.latestDate)
      .map((date): { date: string; status: DayStatus } => {
        const hasCount = (countByDate.get(date) ?? 0) > 0;
        const status: DayStatus = hasCount ? 'done' : mk.madeUpDates.includes(date) ? 'makeup' : 'gap';
        return { date, status };
      })
      .reverse(); // 最近的排在最上
  }, [mk, countByDate]);

  if (!mk) return null;

  const gapCount = days.filter((d) => d.status === 'gap').length;
  const canMakeup = mk.remaining > 0 && gapCount > 0;
  const streak = summary.data?.streak ?? 0;

  const btnLabel = mk.remaining === 0
    ? s('本周已用', '本週已用', 'Used')
    : gapCount === 0
      ? s('无空缺', '無空缺', 'No gaps')
      : s('补签', '補簽', 'Make up');

  function confirm() {
    if (!pick) return;
    makeupMut.mutate(pick, {
      onSuccess: () => {
        setOpen(false);
        setPick(null);
        toast.ok(s('补签成功 · 连续天数已恢复', '補簽成功 · 連續天數已恢復', 'Made up · streak restored'));
      },
      onError: (e) => {
        toast.error((e as ApiError).message || s('补签失败', '補簽失敗', 'Make-up failed'));
      },
    });
  }

  return (
    <>
      <div className="glass-card" style={{
        padding: 'var(--sp-3) var(--sp-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)', letterSpacing: 1 }}>
            🔥 {s('连续', '連續', 'Streak')} {streak} {s('天', '天', 'd')}
          </div>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>
            {mk.remaining > 0
              ? s(`本周可补签 ${mk.remaining}/${mk.perWeek} 次`, `本週可補簽 ${mk.remaining}/${mk.perWeek} 次`, `${mk.remaining}/${mk.perWeek} make-up left this week`)
              : s('本周补签已用完', '本週補簽已用完', 'No make-up left this week')}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-pill"
          disabled={!canMakeup}
          onClick={() => setOpen(true)}
          style={{
            padding: '8px 18px',
            justifyContent: 'center',
            border: 'none',
            color: canMakeup ? '#fff' : 'var(--ink-4)',
            background: canMakeup
              ? 'linear-gradient(135deg, var(--saffron) 0%, var(--saffron-dark) 100%)'
              : 'var(--surface)',
            cursor: canMakeup ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
          }}
        >
          {btnLabel}
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => { setOpen(false); setPick(null); }}
        variant="centered"
        title={s('补签', '補簽', 'Make up')}
        footer={(
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button type="button" onClick={() => { setOpen(false); setPick(null); }} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
              {s('取消', '取消', 'Cancel')}
            </button>
            <button type="button" onClick={confirm} disabled={!pick || makeupMut.isPending} className="btn btn-pill" style={{
              flex: 1, padding: 12, justifyContent: 'center', border: 'none', fontFamily: 'var(--font-serif)',
              color: (!pick || makeupMut.isPending) ? 'var(--ink-4)' : '#fff',
              background: (!pick || makeupMut.isPending) ? 'var(--surface)' : 'linear-gradient(135deg, var(--saffron) 0%, var(--saffron-dark) 100%)',
              cursor: (!pick || makeupMut.isPending) ? 'default' : 'pointer',
            }}>
              {makeupMut.isPending ? s('补签中…', '補簽中…', 'Saving…') : s('确认补签', '確認補簽', 'Confirm')}
            </button>
          </div>
        )}
      >
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 var(--sp-3)' }}>
          {s(
            `只能补最近 ${mk.windowDays} 天 · 每周 1 次 · 统计按美东时间计日`,
            `只能補最近 ${mk.windowDays} 天 · 每週 1 次 · 統計按美東時間計日`,
            `Last ${mk.windowDays} days only · once per week · days counted in US Eastern time`,
          )}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {days.map((d) => {
            const selectable = d.status === 'gap';
            const selected = pick === d.date;
            const tag = d.status === 'done'
              ? s('✓ 已打卡', '✓ 已打卡', '✓ Done')
              : d.status === 'makeup'
                ? s('✓ 已补签', '✓ 已補簽', '✓ Made up')
                : s('空缺', '空缺', 'Missed');
            return (
              <button
                key={d.date}
                type="button"
                disabled={!selectable}
                onClick={() => setPick(selected ? null : d.date)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--r-md)',
                  background: selected ? 'var(--saffron-pale)' : 'var(--surface)',
                  border: selected ? '1.5px solid var(--saffron)' : '1px solid var(--border)',
                  color: selectable ? 'var(--ink)' : 'var(--ink-4)',
                  cursor: selectable ? 'pointer' : 'default',
                  font: 'var(--text-body)', letterSpacing: 1,
                  textAlign: 'left', width: '100%',
                }}
              >
                <span>{label(d.date)}</span>
                <span style={{
                  font: 'var(--text-caption)', fontWeight: 700,
                  color: d.status === 'gap' ? 'var(--saffron-dark)' : 'var(--sage-dark)',
                }}>
                  {tag}
                </span>
              </button>
            );
          })}
        </div>
      </Dialog>
    </>
  );
}
