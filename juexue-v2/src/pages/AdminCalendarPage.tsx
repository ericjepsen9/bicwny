// admin 藏历管理 · /admin/calendar
//   - 月份切换 · 网格列出该月所有日
//   - 点格 → 弹编辑表单（lunar / tibetan / tibetanMonth / isIntercalary / tags / auspicious / events / publicHoliday）
//   - 保存 PUT /api/admin/calendar/:date · 删除 DELETE
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { api } from '@/lib/api';

interface TibetanDay {
  date: string;
  lunar: string;
  tibetan: string;
  tibetanMonth: string;
  isIntercalary: boolean;
  tags: ('十斋日' | '飞幡日' | '八吉同聚' | '九凶同聚')[];
  auspicious: boolean;
  events: string[];
  publicHoliday: string | null;
}

const TAG_OPTIONS = ['十斋日', '飞幡日', '八吉同聚', '九凶同聚'] as const;

export default function AdminCalendarPage() {
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [editing, setEditing] = useState<string | null>(null);
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const qc = useQueryClient();

  const data = useQuery({
    queryKey: ['/api/calendar/month', ym],
    queryFn: ({ signal }) => api.get<TibetanDay[]>(`/api/calendar/month/${ym}`, { signal }),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, TibetanDay>();
    (data.data ?? []).forEach((d) => map.set(d.date, d));
    return map;
  }, [data.data]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function shiftMonth(delta: number) {
    let y = year, m = month + delta;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setYear(y);
    setMonth(m);
    setEditing(null);
  }

  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Link to="/admin" style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', textDecoration: 'none' }}>
        ← 返回 admin
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => shiftMonth(-1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>‹</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.3rem', letterSpacing: 2 }}>
          📿 藏历管理 · {year} · {String(month).padStart(2, '0')}
        </h1>
        <button type="button" onClick={() => shiftMonth(1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>›</button>
      </div>

      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', textAlign: 'center', margin: 0 }}>
        点格编辑该日 · 空白格点击新建
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, font: 'var(--text-caption)', color: 'var(--ink-3)', textAlign: 'center' }}>
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => <div key={w}>{w}</div>)}
      </div>

      {data.isLoading ? <Skeleton.List /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const day = byDate.get(cell.ymd);
            const has = !!day;
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => setEditing(cell.ymd)}
                style={{
                  aspectRatio: '1',
                  border: editing === cell.ymd ? '2px solid var(--saffron-dark)' : `1px solid ${has ? 'var(--saffron-light)' : 'var(--border-light)'}`,
                  borderRadius: 6,
                  background: has ? 'var(--saffron-pale)' : 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: 2,
                }}
              >
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem' }}>{cell.day}</div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', fontSize: '0.6rem', lineHeight: 1, marginTop: 2 }}>
                  {day?.tibetan ?? '—'}
                </div>
                {day?.auspicious && <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.7rem' }}>🌺</div>}
                {day && day.events.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, font: 'var(--text-caption)', fontSize: '0.55rem', color: 'var(--saffron-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }}>
                    {day.events[0]}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <DayEditor
          date={editing}
          initial={byDate.get(editing) ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['/api/calendar/month', ym] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DayEditor({ date, initial, onClose, onSaved }: {
  date: string;
  initial: TibetanDay | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lunar, setLunar] = useState(initial?.lunar ?? '');
  const [tibetan, setTibetan] = useState(initial?.tibetan ?? '');
  const [tibetanMonth, setTibetanMonth] = useState(initial?.tibetanMonth ?? '');
  const [isIntercalary, setIsIntercalary] = useState(initial?.isIntercalary ?? false);
  const [auspicious, setAuspicious] = useState(initial?.auspicious ?? false);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [eventsText, setEventsText] = useState((initial?.events ?? []).join('\n'));
  const [publicHoliday, setPublicHoliday] = useState(initial?.publicHoliday ?? '');

  useEffect(() => {
    setLunar(initial?.lunar ?? '');
    setTibetan(initial?.tibetan ?? '');
    setTibetanMonth(initial?.tibetanMonth ?? '');
    setIsIntercalary(initial?.isIntercalary ?? false);
    setAuspicious(initial?.auspicious ?? false);
    setTags(initial?.tags ?? []);
    setEventsText((initial?.events ?? []).join('\n'));
    setPublicHoliday(initial?.publicHoliday ?? '');
  }, [date, initial]);

  const save = useMutation({
    mutationFn: () => api.put(`/api/admin/calendar/${date}`, {
      lunar, tibetan, tibetanMonth,
      isIntercalary, tags, auspicious,
      events: eventsText.split('\n').map((l) => l.trim()).filter(Boolean),
      publicHoliday: publicHoliday.trim() || null,
    }),
    onSuccess: onSaved,
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/api/admin/calendar/${date}`),
    onSuccess: onSaved,
  });

  const canSave = lunar.trim() && tibetan.trim() && tibetanMonth.trim();

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
          编辑 {date}
        </h3>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', font: 'var(--text-caption)', color: 'var(--ink-3)', cursor: 'pointer' }}>关闭 ✕</button>
      </div>

      <Field label="农历 (lunar)" value={lunar} onChange={setLunar} placeholder="三月廿五" />
      <Field label="藏历 (tibetan)" value={tibetan} onChange={setTibetan} placeholder="二月廿四" />
      <Field label="藏历月名 (tibetanMonth)" value={tibetanMonth} onChange={setTibetanMonth} placeholder="萨嘎月 / 苦行月 …" />

      <label style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={isIntercalary} onChange={(e) => setIsIntercalary(e.target.checked)} /> 闰日
      </label>
      <label style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={auspicious} onChange={(e) => setAuspicious(e.target.checked)} /> 🌺 修法功德日
      </label>

      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TAG_OPTIONS.map((t) => (
          <label key={t} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={tags.includes(t)}
              onChange={(e) => setTags(e.target.checked ? [...tags, t] : tags.filter((x) => x !== t))}
            /> {t}
          </label>
        ))}
      </div>

      <label style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        事件（一行一条 · 圣诞 / 法会 / 加持日 / 理发吉日:增财）
        <textarea
          value={eventsText}
          onChange={(e) => setEventsText(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: 8, border: '1px solid var(--border-light)', borderRadius: 6, font: 'var(--text-body)' }}
          placeholder={'莲师诞辰\n金刚萨埵法会 (3/6)'}
        />
      </label>

      <Field label="公历法定节日" value={publicHoliday} onChange={setPublicHoliday} placeholder="清明节 / 劳动节" />

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-2)' }}>
        <button
          type="button"
          disabled={!canSave || save.isPending}
          onClick={() => save.mutate()}
          className="btn btn-pill"
          style={{ background: 'var(--saffron-dark)', color: '#fff', padding: '8px 16px' }}
        >
          {save.isPending ? '保存中…' : '保存'}
        </button>
        {initial && (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => { if (confirm(`删除 ${date} ?`)) remove.mutate(); }}
            className="btn btn-pill"
            style={{ background: 'transparent', border: '1px solid var(--crimson)', color: 'var(--crimson)', padding: '8px 16px' }}
          >
            {remove.isPending ? '删除中…' : '删除'}
          </button>
        )}
      </div>

      {(save.error || remove.error) && (
        <p style={{ font: 'var(--text-caption)', color: 'var(--crimson)' }}>
          {String((save.error || remove.error) as Error)}
        </p>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: 8, border: '1px solid var(--border-light)', borderRadius: 6, font: 'var(--text-body)' }}
      />
    </label>
  );
}

interface Cell { day: number; ymd: string }

function buildMonthGrid(year: number, month: number): (Cell | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDow = first.getUTCDay();
  const cells: (Cell | null)[] = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= dim; d += 1) {
    cells.push({ day: d, ymd: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
