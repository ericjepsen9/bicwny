// AdminNotificationRulesPage · /admin/notification-rules
//   admin 配置平台默认提醒时段（个人提醒 · 三档）
//   学员未自定义时 fallback 用平台值 · 平台未设时 fallback 用代码默认
//
//   GET   /api/admin/notification-rules         拉所有 platform scope 规则
//   PUT   /api/admin/notification-rules         按 triggerType upsert
//   POST  /api/admin/notification-test          手工触发（验证渠道）
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

type TriggerType = 'evening-due' | 'daily-digest' | 'weekly-report';

interface Rule {
  id: string;
  scope: string;
  triggerType: TriggerType;
  defaultHour: number | null;
  defaultWeekday: number | null;
  isActive: boolean;
}
interface Fallback {
  eveningHour: number;
  dailyHour: number;
  weeklyHour: number;
  weeklyWeekday: number;
}
interface RulesResp {
  rules: Rule[];
  fallback: Fallback;
}

export default function AdminNotificationRulesPage() {
  const { s } = useLang();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['/api/admin/notification-rules'],
    queryFn: () => api.get<RulesResp>('/api/admin/notification-rules'),
  });

  const upsert = useMutation({
    mutationFn: (body: {
      triggerType: TriggerType;
      defaultHour: number | null;
      defaultWeekday?: number | null;
      isActive?: boolean;
    }) => api.put('/api/admin/notification-rules', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/notification-rules'] });
      toast.ok(s('已保存', '已儲存', 'Saved'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  if (q.isLoading || !q.data) {
    return <div style={{ padding: 'var(--sp-5)', color: 'var(--ink-3)' }}>{s('加载中…', '載入中…', 'Loading…')}</div>;
  }

  const { rules, fallback } = q.data;
  const ruleOf = (t: TriggerType) => rules.find((r) => r.triggerType === t) ?? null;

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('通知规则', '通知規則', 'Notification rules')}</h1>
          <p className="page-sub">{s('个人提醒 · 平台默认时段', '個人提醒 · 平台默認時段', 'Personal reminders · platform defaults')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <Card
          icon="⏰"
          title={s('临期提醒', '臨期提醒', 'Evening due')}
          sub={s('用户今日 daily 目标已起修但未达成时邀请补完', '用戶今日 daily 目標已起修但未達成時邀請補完', 'When daily goals are partly done')}
          rule={ruleOf('evening-due')}
          fallbackHour={fallback.eveningHour}
          showWeekday={false}
          onSave={(h, _w, active) => upsert.mutate({ triggerType: 'evening-due', defaultHour: h, defaultWeekday: null, isActive: active })}
          disabled={upsert.isPending}
        />

        <Card
          icon="📊"
          title={s('日报', '日報', 'Daily digest')}
          sub={s('用户今日 0 修学时召回', '用戶今日 0 修學時召回', 'When user has zero practice today')}
          rule={ruleOf('daily-digest')}
          fallbackHour={fallback.dailyHour}
          showWeekday={false}
          onSave={(h, _w, active) => upsert.mutate({ triggerType: 'daily-digest', defaultHour: h, defaultWeekday: null, isActive: active })}
          disabled={upsert.isPending}
        />

        <Card
          icon="📬"
          title={s('学修周报', '學修週報', 'Weekly report')}
          sub={s('每周固定一次 · 总结上周修学', '每週固定一次 · 總結上週修學', 'Weekly summary')}
          rule={ruleOf('weekly-report')}
          fallbackHour={fallback.weeklyHour}
          fallbackWeekday={fallback.weeklyWeekday}
          showWeekday={true}
          onSave={(h, w, active) => upsert.mutate({ triggerType: 'weekly-report', defaultHour: h, defaultWeekday: w, isActive: active })}
          disabled={upsert.isPending}
        />

        <TestSection />

        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 'var(--sp-3)', lineHeight: 1.6 }}>
          {s(
            '说明：平台默认值仅影响"未自定义时段"的用户。已自定义的用户不会被覆盖。' +
              '硬编码兜底：临期 19:00 · 日报 20:00 · 周报 周一 08:00。',
            '說明：平台默認值僅影響"未自定義時段"的用戶。已自定義的用戶不會被覆蓋。',
            'Defaults apply only to users without custom hours. Code fallback: evening 19, daily 20, weekly Mon 08.',
          )}
        </div>
      </div>
    </>
  );
}

function Card({
  icon, title, sub, rule, fallbackHour, fallbackWeekday, showWeekday, onSave, disabled,
}: {
  icon: string;
  title: string;
  sub: string;
  rule: Rule | null;
  fallbackHour: number;
  fallbackWeekday?: number;
  showWeekday: boolean;
  onSave: (hour: number | null, weekday: number | null, active: boolean) => void;
  disabled?: boolean;
}) {
  const { s } = useLang();
  const initialHour = useMemo(() => rule?.defaultHour ?? fallbackHour, [rule, fallbackHour]);
  const initialWeekday = useMemo(() => rule?.defaultWeekday ?? fallbackWeekday ?? 1, [rule, fallbackWeekday]);
  const initialActive = rule?.isActive ?? true;

  const [hour, setHour] = useState(initialHour);
  const [weekday, setWeekday] = useState(initialWeekday);
  const [active, setActive] = useState(initialActive);

  const dirty = hour !== initialHour
    || (showWeekday && weekday !== initialWeekday)
    || active !== initialActive;

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
        <div>
          <div style={{ font: 'var(--text-body-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5 }}>
            {icon} {title}
          </div>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>{sub}</div>
        </div>
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--r-pill)',
          background: active ? 'var(--sage-pale)' : 'var(--border-light)',
          color: active ? 'var(--sage-dark)' : 'var(--ink-4)',
          font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1,
        }}>
          {active ? s('启用', '啟用', 'On') : s('停用', '停用', 'Off')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap', marginTop: 'var(--sp-3)' }}>
        {showWeekday && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('星期', '星期', 'Weekday')}</span>
            <select
              value={weekday}
              onChange={(e) => setWeekday(parseInt(e.target.value, 10))}
              style={selectStyle}
            >
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
                <option key={d} value={i + 1}>{['周一','周二','周三','周四','周五','周六','周日'][i]}</option>
              ))}
            </select>
          </label>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{s('时段', '時段', 'Hour')}</span>
          <select value={hour} onChange={(e) => setHour(parseInt(e.target.value, 10))} style={selectStyle}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span style={{ font: 'var(--text-caption)', color: 'var(--ink-2)' }}>{s('启用', '啟用', 'Active')}</span>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-3)' }}>
        <button
          type="button"
          onClick={() => onSave(hour, showWeekday ? weekday : null, active)}
          disabled={!dirty || disabled}
          className="btn btn-primary btn-pill"
          style={{ padding: '6px 16px', opacity: (!dirty || disabled) ? 0.5 : 1 }}
        >
          {s('保存', '儲存', 'Save')}
        </button>
      </div>
    </div>
  );
}

function TestSection() {
  const { s } = useLang();
  const [userId, setUserId] = useState('');
  const [kind, setKind] = useState<TriggerType>('weekly-report');

  const trigger = useMutation({
    mutationFn: () => api.post<{ sent: boolean; reason?: string }>('/api/admin/notification-test', { userId, kind }),
    onSuccess: (r) => {
      if (r.sent) toast.ok(s('已发送 · 看用户通知中心', '已發送 · 看用戶通知中心', 'Sent · check notif center'));
      else toast.error(s(`未发送：${r.reason ?? '无数据'}`, `未發送：${r.reason ?? '無資料'}`, `Skipped: ${r.reason}`));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-body-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
        🧪 {s('手工触发测试', '手工觸發測試', 'Manual trigger test')}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginBottom: 'var(--sp-3)' }}>
        {s('绕过时段判断 · 立即给指定用户发一条 · 仍受 buildPayload 数据约束（无数据时跳过）',
           '繞過時段判斷 · 立即給指定用戶發一條',
           'Bypass timing · send immediately to target user')}
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={s('User ID（cuid）', 'User ID（cuid）', 'User ID (cuid)')}
          style={{
            padding: '6px 12px',
            background: 'var(--glass-thick)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-pill)',
            font: 'var(--text-body)',
            color: 'var(--ink-2)',
            minWidth: 280,
          }}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as TriggerType)} style={selectStyle}>
          <option value="evening-due">{s('临期提醒', '臨期提醒', 'Evening due')}</option>
          <option value="daily-digest">{s('日报', '日報', 'Daily digest')}</option>
          <option value="weekly-report">{s('周报', '週報', 'Weekly report')}</option>
        </select>
        <button
          type="button"
          onClick={() => userId && trigger.mutate()}
          disabled={!userId || trigger.isPending}
          className="btn btn-primary btn-pill"
          style={{ padding: '6px 16px', opacity: (!userId || trigger.isPending) ? 0.5 : 1 }}
        >
          {trigger.isPending ? s('发送中…', '發送中…', 'Sending…') : s('触发', '觸發', 'Trigger')}
        </button>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--glass-thick)',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--r-pill)',
  font: 'var(--text-body)',
  color: 'var(--ink-2)',
};
