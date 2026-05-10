// 修学计数 · 子项计数页 /practice/project/:id（核心交互）
//   - 大圆按钮 +1 · +1/+10 单位切换 · 摇一摇（默认关）
//   - 撤销 toast（3 秒内）· 30 秒 batching
//   - 显示进度条（如有 daily target）
//   - 右上⋯设置：摇一摇 / 改名 / 归档 / 设目标
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import TibetanPracticeBanner from '@/components/TibetanPracticeBanner';
import TopNav from '@/components/TopNav';
import WheelPicker from '@/components/WheelPicker';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { usePracticeBatch, useShakeToTap } from '@/lib/practiceBatch';
import {
  type PracticeGoal,
  usePracticeCategories,
  usePracticeGoals,
  usePracticeProjects,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

const SHAKE_KEY = 'practice-shake';
const UNIT_KEY = (id: string) => `practice-unit-${id}`;

export default function PracticeProjectPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const projects = usePracticeProjects();
  const goals = usePracticeGoals();
  const cats = usePracticeCategories();
  const proj = useMemo(() => (projects.data ?? []).find((p) => p.id === id), [projects.data, id]);
  const catKey = useMemo(() => {
    if (!proj) return '';
    return cats.data?.find((c) => c.id === proj.categoryId)?.key ?? '';
  }, [proj, cats.data]);

  const [unit, setUnit] = useState<1 | 10>(() => {
    if (!id) return 1;
    return localStorage.getItem(UNIT_KEY(id)) === '10' ? 10 : 1;
  });
  const [shakeOn, setShakeOn] = useState(() => localStorage.getItem(SHAKE_KEY) === '1');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { tap, undoLast, localPending, flush } = usePracticeBatch(id ?? '');
  // 摇一摇激活
  useShakeToTap(shakeOn && !!id, () => doTap('shake'));

  function doTap(source: 'tap' | 'shake' = 'tap') {
    if (!id) return;
    // 触觉反馈 · 10ms 短震 · 用户在大圆按钮区随便点都会震
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(source === 'shake' ? 30 : 12); } catch { /* ignore */ }
    }
    tap(unit, source);
    showUndoToast();
  }

  // 撤销 · 显示 3 秒可撤销 toast
  const undoTimerRef = useRef<number | null>(null);
  function showUndoToast() {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    // 简单实现：toast.ok + 一个 undo 按钮在 toast 里没法做 · 用顶部固定撤销条代替
    setUndoVisible(true);
    undoTimerRef.current = window.setTimeout(() => setUndoVisible(false), 3000);
  }
  const [undoVisible, setUndoVisible] = useState(false);

  function changeUnit(u: 1 | 10) {
    setUnit(u);
    if (id) localStorage.setItem(UNIT_KEY(id), String(u));
  }

  function toggleShake() {
    const next = !shakeOn;
    setShakeOn(next);
    localStorage.setItem(SHAKE_KEY, next ? '1' : '0');
    if (next && typeof window !== 'undefined') {
      // iOS 13+ 需要权限请求
      const dm = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof dm?.requestPermission === 'function') {
        dm.requestPermission().then((perm) => {
          if (perm !== 'granted') {
            setShakeOn(false);
            localStorage.setItem(SHAKE_KEY, '0');
            toast.error(s('需开启传感器权限', '需開啟感測器權限', 'Motion permission denied'));
          }
        }).catch(() => {});
      }
    }
  }

  if (!proj) {
    return projects.isLoading ? (
      <div style={{ padding: 'var(--sp-4)' }}><Skeleton.Card /></div>
    ) : (
      <p style={{ color: 'var(--crimson)', padding: 'var(--sp-4)' }}>{s('子项不存在', '子項不存在', 'Project not found')}</p>
    );
  }

  const goal = goals.data?.find((g) => g.projectId === proj.id);
  const todayWithPending = proj.todayCount + localPending;
  const totalWithPending = proj.totalCount + localPending;
  const dailyProgress = goal?.dailyTarget ?? 0;
  const dailyPct = dailyProgress > 0 ? Math.min(100, Math.round((todayWithPending / dailyProgress) * 100)) : 0;

  return (
    <>
      <TopNav
        titles={[proj.name, proj.name, proj.name]}
        backTo={catKey ? `/practice/${catKey}` : '/practice'}
        right={(
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={s('设置', '設置', 'Settings')}
            style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--ink-3)', cursor: 'pointer', padding: '4px 10px' }}
          >⋯</button>
        )}
      />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <TibetanPracticeBanner />
      {/* hero · 大累计数字（标题在 TopNav 已显示 · 不重复） */}
      <div className="glass-card-thick" style={{ padding: 'var(--sp-5) var(--sp-4)', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 4 }}>{proj.emoji ?? '📿'}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '2.6rem', color: 'var(--saffron-dark)', letterSpacing: 1, lineHeight: 1.1 }}>
          {fmtBig(totalWithPending)}
        </div>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginTop: 4 }}>
          {s(`累计 · 今日 +${todayWithPending}`, `累計 · 今日 +${todayWithPending}`, `Total · Today +${todayWithPending}`)}
        </div>
      </div>

      {/* 撤销条 · 3 秒内可撤销最近一次 */}
      {undoVisible && (
        <div style={{
          padding: '8px 14px', background: 'var(--gold-pale)', border: '1px solid var(--gold-light)',
          borderRadius: 'var(--r-pill)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          font: 'var(--text-caption)', color: 'var(--gold-dark)',
        }}>
          ✓ +{unit} {s('已记', '已記', 'recorded')}
          <button type="button" onClick={() => { undoLast(); setUndoVisible(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--gold-dark)', fontWeight: 700, cursor: 'pointer' }}>
            ↺ {s('撤销', '撤銷', 'Undo')}
          </button>
        </div>
      )}

      {/* 单位切换 + 自定义 */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {([1, 10] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => changeUnit(u)}
            className="btn btn-pill"
            style={{
              padding: '8px 20px',
              minWidth: 64,
              background: unit === u ? 'var(--saffron-pale)' : 'transparent',
              border: '1px solid ' + (unit === u ? 'var(--saffron-light)' : 'var(--border)'),
              color: unit === u ? 'var(--saffron-dark)' : 'var(--ink-3)',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            +{u}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="btn btn-pill"
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px dashed var(--saffron-light)',
            color: 'var(--saffron-dark)',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          ✏ {s('自定', '自定', 'Custom')}
        </button>
      </div>

      {/* 大圆按钮 · 整个外框可点 · 比按钮本身大一圈（更易命中）· 触觉震动 */}
      <button
        type="button"
        onClick={() => doTap('tap')}
        aria-label={s(`+${unit} 计数`, `+${unit} 計數`, `+${unit} count`)}
        style={{
          alignSelf: 'center',
          padding: 'var(--sp-5)',
          minHeight: 320,
          width: '100%',
          maxWidth: 360,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onTouchStart={(e) => { const c = e.currentTarget.querySelector<HTMLDivElement>('.big-disc'); if (c) c.style.transform = 'scale(.96)'; }}
        onTouchEnd={(e) => { const c = e.currentTarget.querySelector<HTMLDivElement>('.big-disc'); if (c) c.style.transform = 'scale(1)'; }}
        onMouseDown={(e) => { const c = e.currentTarget.querySelector<HTMLDivElement>('.big-disc'); if (c) c.style.transform = 'scale(.96)'; }}
        onMouseUp={(e) => { const c = e.currentTarget.querySelector<HTMLDivElement>('.big-disc'); if (c) c.style.transform = 'scale(1)'; }}
      >
        <div
          className="big-disc"
          style={{
            width: 240, height: 240, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--saffron) 0%, var(--saffron-dark) 100%)',
            color: '#fff',
            boxShadow: '0 12px 40px rgba(224,120,86,.45)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .1s var(--ease)',
            fontFamily: 'var(--font-serif)',
            pointerEvents: 'none', // 让外框接收事件
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: 1 }}>+{unit}</div>
          <div style={{ fontSize: '1rem', marginTop: 4, opacity: 0.9 }}>{proj.emoji ?? '📿'} {todayWithPending}</div>
        </div>
      </button>

      <div style={{ textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
        {s('点击 +', '點擊 +', 'Tap +')}{unit}
        {shakeOn && <> · 📱 {s('摇一摇 +', '搖一搖 +', 'Shake +')}{unit}</>}
      </div>

      {/* 进度条（如有目标） */}
      {goal && goal.dailyTarget > 0 && (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4 }}>
            <span>{s('今日目标', '今日目標', 'Daily goal')} {goal.dailyTarget}</span>
            <span style={{ color: dailyPct >= 100 ? 'var(--sage-dark)' : 'var(--ink-3)', fontWeight: 700 }}>
              {dailyPct}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--glass)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dailyPct}%`, background: dailyPct >= 100 ? 'var(--sage-dark)' : 'linear-gradient(90deg, var(--saffron) 0%, var(--saffron-dark) 100%)', transition: 'width .3s var(--ease)' }} />
          </div>
        </div>
      )}

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} title={s('登记修量', '登記修量', 'Log practice')} variant="centered">
        <BulkAddForm
          onSubmit={(n, date, note) => { tap(n, 'bulk', { date, note }); setBulkOpen(false); toast.ok(s(`已登记 +${n}`, `已登記 +${n}`, `Logged +${n}`)); }}
          onCancel={() => setBulkOpen(false)}
        />
      </Dialog>

      <Dialog open={settingsOpen} onClose={() => { void flush(); setSettingsOpen(false); }} title={s('设置', '設置', 'Settings')} variant="centered">
        <SettingsPanel
          projectId={proj.id}
          isMine={proj.isMine}
          name={proj.name}
          emoji={proj.emoji}
          shakeOn={shakeOn}
          onToggleShake={toggleShake}
          goal={goal ?? null}
          onClose={() => setSettingsOpen(false)}
          onArchived={() => nav('/practice')}
        />
      </Dialog>
      </div>
    </>
  );
}

function SettingsPanel({
  projectId, isMine, name, emoji, shakeOn, onToggleShake, goal, onClose, onArchived,
}: {
  projectId: string;
  isMine: boolean;
  name: string;
  emoji: string | null;
  shakeOn: boolean;
  onToggleShake: () => void;
  goal: PracticeGoal | null;
  onClose: () => void;
  onArchived: () => void;
}) {
  const { s } = useLang();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'main' | 'rename' | 'goal'>('main');
  const [newName, setNewName] = useState(name);
  const [newEmoji, setNewEmoji] = useState(emoji ?? '');
  const [target, setTarget] = useState(goal?.dailyTarget ?? 0);

  const rename = useMutation({
    mutationFn: () => api.patch(`/api/practice/projects/${encodeURIComponent(projectId)}`, {
      name: newName.trim() || undefined,
      emoji: newEmoji.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/practice/projects'] });
      toast.ok(s('已保存', '已保存', 'Saved'));
      setTab('main');
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const setGoal = useMutation({
    mutationFn: () => api.put('/api/practice/goals', { projectId, dailyTarget: target }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/practice/goals'] });
      toast.ok(s('目标已保存', '目標已保存', 'Goal saved'));
      setTab('main');
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const archive = useMutation({
    mutationFn: () => api.del(`/api/practice/projects/${encodeURIComponent(projectId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/practice/projects'] });
      toast.ok(s('已归档', '已歸檔', 'Archived'));
      onClose();
      onArchived();
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  if (tab === 'rename') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <Field label={s('名称', '名稱', 'Name')} value={newName} onChange={setNewName} maxLength={60} />
        <Field label={s('emoji', 'emoji', 'Emoji')} value={newEmoji} onChange={setNewEmoji} maxLength={4} />
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button type="button" onClick={() => setTab('main')} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>{s('取消', '取消', 'Cancel')}</button>
          <button type="button" onClick={() => rename.mutate()} disabled={rename.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>{rename.isPending ? '…' : s('保存', '保存', 'Save')}</button>
        </div>
      </div>
    );
  }

  if (tab === 'goal') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <Field
          label={s('每日目标（0 = 取消）', '每日目標', 'Daily target (0 = none)')}
          value={String(target)}
          onChange={(v) => setTarget(Math.max(0, Number(v) || 0))}
          type="number"
        />
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button type="button" onClick={() => setTab('main')} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>{s('取消', '取消', 'Cancel')}</button>
          <button type="button" onClick={() => setGoal.mutate()} disabled={setGoal.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12 }}>{setGoal.isPending ? '…' : s('保存', '保存', 'Save')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      <SettingRow
        label={s('摇一摇 +N', '搖一搖 +N', 'Shake to +N')}
        right={<input type="checkbox" checked={shakeOn} onChange={onToggleShake} />}
      />
      <SettingRow
        label={s('每日目标', '每日目標', 'Daily target')}
        right={<span style={{ color: 'var(--saffron-dark)' }}>{goal?.dailyTarget ?? '—'} ›</span>}
        onClick={() => setTab('goal')}
      />
      {isMine && (
        <>
          <SettingRow
            label={s('改名 / emoji', '改名 / emoji', 'Rename')}
            right={<span style={{ color: 'var(--saffron-dark)' }}>›</span>}
            onClick={() => setTab('rename')}
          />
          <SettingRow
            label={s('归档', '歸檔', 'Archive')}
            danger
            onClick={async () => {
              const ok = await confirmAsync({
                title: s(`归档「${name}」？`, `歸檔「${name}」？`, `Archive "${name}"?`),
                body: s('归档后将不再显示在列表中 · 累计数据保留', '歸檔後將不再顯示', 'Hidden from list · data preserved'),
                danger: true,
                okLabel: s('归档', '歸檔', 'Archive'),
              });
              if (ok) archive.mutate();
            }}
          />
        </>
      )}
    </div>
  );
}

function SettingRow({
  label, right, onClick, danger,
}: { label: string; right?: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'var(--glass)', border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r)',
        color: danger ? 'var(--crimson)' : 'var(--ink)',
        font: 'var(--text-body)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', width: '100%',
      }}
    >
      <span>{label}</span>
      <span>{right}</span>
    </Tag>
  );
}

// 大数字格式化（>=10000 → 缩写）· 但保留全数显示在 hero
function fmtBig(n: number): string {
  if (n >= 100_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// 登记表单 · WheelPicker 选数量（常用咒数）+ 日期 + 备注
// 常用咒数：参考修行习惯 · 1/3/7/21/49 是小座 · 108/216/540/1080 是大座
const COUNT_PRESETS = [1, 3, 7, 21, 49, 108, 216, 540, 1080] as const;

function BulkAddForm({ onSubmit, onCancel }: { onSubmit: (n: number, date?: string, note?: string) => void; onCancel: () => void }) {
  const { s } = useLang();
  const today = new Date().toISOString().slice(0, 10);
  const [count, setCount] = useState<number>(108); // 默认 108
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState<string>('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(count, date === today ? undefined : date, note.trim() || undefined);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}
    >
      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, textAlign: 'center', margin: 0 }}>
        {s('滑动选择数量', '滑動選擇數量', 'Slide to pick count')}
      </p>
      <WheelPicker
        value={count}
        options={COUNT_PRESETS}
        onChange={(v) => setCount(v as number)}
        unit={s('遍', '遍', 'rep')}
      />

      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6 }}>
          {s('日期（默认今天 · 可回填）', '日期（默認今天 · 可回填）', 'Date (default today · backfill OK)')}
        </label>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-body)', outline: 'none' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6 }}>
          {s('备注（可选 · ≤ 50 字）', '備註（可選）', 'Note (opt · ≤50)')}
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 50))}
          maxLength={50}
          placeholder={s('如：观想清净', '如：觀想清淨', 'e.g. clear visualization')}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', font: 'var(--text-body)', outline: 'none' }}
        />
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', textAlign: 'right', marginTop: 2 }}>{note.length} / 50</div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
        <button type="button" onClick={onCancel} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--ink-3)', justifyContent: 'center' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {s(`登记 +${count}`, `登記 +${count}`, `Log +${count}`)}
        </button>
      </div>
    </form>
  );
}
