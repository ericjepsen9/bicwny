// SettingsNotificationsPage · /settings/notifications
//   学员通知偏好 · 三档个人提醒（临期 / 日报 / 周报）+ 静默时段 + 时区
//
//   三层 fallback：用户字段 null → 平台默认 → 代码兜底
//   UI 显示"自动 19:00"（即 resolved hour）作为 placeholder · 用户切自定义后存 hour
//
//   每次改 toggle / hour PATCH 一次 · 不做"保存"按钮 · 触发即生效
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface NotifPrefs {
  timezone: string;
  eveningReminderEnabled: boolean;
  eveningReminderHour: number | null;
  dailyDigestEnabled: boolean;
  dailyDigestHour: number | null;
  weeklyReportEnabled: boolean;
  weeklyReportHour: number | null;
  weeklyReportWeekday: number | null;
  quietHoursStart: number;
  quietHoursEnd: number;
}
interface PlatformDefaults {
  eveningHour: number;
  dailyHour: number;
  weeklyHour: number;
  weeklyWeekday: number;
}
interface Resolved {
  eveningHour: number;
  dailyHour: number;
  weeklyHour: number;
  weeklyWeekday: number;
}
interface PrefsResp {
  prefs: NotifPrefs;
  platformDefaults: PlatformDefaults;
  resolved: Resolved;
}

export default function SettingsNotificationsPage() {
  const { s } = useLang();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['/api/my/notification-prefs'],
    queryFn: () => api.get<{ data: PrefsResp }>('/api/my/notification-prefs').then((r) => r.data),
  });

  const m = useMutation({
    mutationFn: (patch: Partial<NotifPrefs>) =>
      api.patch('/api/my/notification-prefs', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/notification-prefs'] });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  if (q.isLoading || !q.data) {
    return (
      <div>
        <TopNav titles={['通知偏好', '通知偏好', 'Notifications']} backTo="/settings" />
        <div style={{ padding: 'var(--sp-5)', color: 'var(--ink-3)' }}>{s('加载中…', '載入中…', 'Loading…')}</div>
      </div>
    );
  }

  const { prefs, resolved } = q.data;

  return (
    <div>
      <TopNav titles={['通知偏好', '通知偏好', 'Notifications']} backTo="/settings" />
      <div style={{ padding: '0 var(--sp-5) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

        {/* 时区 */}
        <SectionLabel>{s('时区', '時區', 'Timezone')}</SectionLabel>
        <div className="menu-card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ font: 'var(--text-body)' }}>{prefs.timezone}</div>
            <button
              type="button"
              onClick={() => {
                const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (guess && guess !== prefs.timezone) m.mutate({ timezone: guess });
              }}
              className="btn btn-pill"
              style={{ padding: '4px 12px', font: 'var(--text-caption)', background: 'var(--glass-thick)', color: 'var(--ink-2)', border: '1px solid var(--glass-border)' }}
            >
              {s('自动检测', '自動偵測', 'Detect')}
            </button>
          </div>
        </div>

        {/* 每日提醒 · 临期 + 日报 */}
        <SectionLabel style={{ marginTop: 'var(--sp-3)' }}>{s('每日提醒', '每日提醒', 'Daily reminders')}</SectionLabel>
        <div className="menu-card">
          <HourRow
            label={s('临期提醒', '臨期提醒', 'Evening due')}
            sub={s('已起修但未达每日目标时邀请补完', '已起修但未達每日目標時邀請補完', 'When today\'s daily goals are partly done')}
            enabled={prefs.eveningReminderEnabled}
            hour={prefs.eveningReminderHour}
            resolvedHour={resolved.eveningHour}
            onToggle={(v) => m.mutate({ eveningReminderEnabled: v })}
            onHourChange={(h) => m.mutate({ eveningReminderHour: h })}
            disabled={m.isPending}
          />
          <Divider />
          <HourRow
            label={s('日报提醒', '日報提醒', 'Daily digest')}
            sub={s('今日尚未记录任何修学时召回', '今日尚未記錄任何修學時召回', 'When you have no practice yet today')}
            enabled={prefs.dailyDigestEnabled}
            hour={prefs.dailyDigestHour}
            resolvedHour={resolved.dailyHour}
            onToggle={(v) => m.mutate({ dailyDigestEnabled: v })}
            onHourChange={(h) => m.mutate({ dailyDigestHour: h })}
            disabled={m.isPending}
          />
        </div>

        {/* 周报 */}
        <SectionLabel style={{ marginTop: 'var(--sp-3)' }}>{s('每周', '每週', 'Weekly')}</SectionLabel>
        <div className="menu-card">
          <WeeklyRow
            label={s('学修周报', '學修週報', 'Weekly report')}
            sub={s('每周固定一次 · 总结上周修学 + 班级排名', '每週固定一次 · 總結上週修學 + 班級排名', 'Weekly summary of last week')}
            enabled={prefs.weeklyReportEnabled}
            hour={prefs.weeklyReportHour}
            weekday={prefs.weeklyReportWeekday}
            resolvedHour={resolved.weeklyHour}
            resolvedWeekday={resolved.weeklyWeekday}
            onToggle={(v) => m.mutate({ weeklyReportEnabled: v })}
            onHourChange={(h) => m.mutate({ weeklyReportHour: h })}
            onWeekdayChange={(d) => m.mutate({ weeklyReportWeekday: d })}
            disabled={m.isPending}
          />
        </div>

        {/* 免打扰 */}
        <SectionLabel style={{ marginTop: 'var(--sp-3)' }}>{s('免打扰时段', '免打擾時段', 'Quiet hours')}</SectionLabel>
        <div className="menu-card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 'var(--sp-2)' }}>
            {s('此时段内不发任何 push（共修开始除外）', '此時段內不發任何 push（共修開始除外）', 'No pushes during this window (except live class sessions)')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <HourSelect value={prefs.quietHoursStart} onChange={(h) => m.mutate({ quietHoursStart: h })} disabled={m.isPending} />
            <span style={{ color: 'var(--ink-3)' }}>—</span>
            <HourSelect value={prefs.quietHoursEnd} onChange={(h) => m.mutate({ quietHoursEnd: h })} disabled={m.isPending} />
          </div>
          {prefs.quietHoursStart === prefs.quietHoursEnd && (
            <div style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)', marginTop: 'var(--sp-2)' }}>
              {s('起止相同 = 关闭免打扰', '起止相同 = 關閉免打擾', 'Same start = end disables quiet hours')}
            </div>
          )}
        </div>

        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 'var(--sp-2)', lineHeight: 1.5 }}>
          {s(
            '说明：「自动」表示走平台默认时段 · 平台调整时跟随。改成"自定义"后将固定该时段。',
            '說明：「自動」表示走平台默認時段 · 平台調整時跟隨。改成"自定義"後將固定該時段。',
            'Auto = follows platform default. Custom = locks the hour.',
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
      {children}
    </h2>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-light)' }} aria-hidden />;
}

function HourRow({
  label, sub, enabled, hour, resolvedHour, onToggle, onHourChange, disabled,
}: {
  label: string; sub: string;
  enabled: boolean;
  hour: number | null;     // null = 走平台默认
  resolvedHour: number;
  onToggle: (v: boolean) => void;
  onHourChange: (h: number | null) => void;
  disabled?: boolean;
}) {
  const { s } = useLang();
  return (
    <div style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--text-body)', color: 'var(--ink)', letterSpacing: 1.2 }}>{label}</div>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>
        </div>
        <Switch checked={enabled} onChange={() => onToggle(!enabled)} disabled={disabled} />
      </div>
      {enabled && (
        <div style={{ marginTop: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            onClick={() => onHourChange(null)}
            className="btn btn-pill"
            style={pillStyle(hour == null)}
            disabled={disabled}
          >
            {s(`自动 ${pad2(resolvedHour)}:00`, `自動 ${pad2(resolvedHour)}:00`, `Auto ${pad2(resolvedHour)}:00`)}
          </button>
          <HourSelect
            value={hour ?? resolvedHour}
            onChange={(h) => onHourChange(h)}
            placeholder={hour == null ? s('自定义…', '自定義…', 'Custom…') : undefined}
            highlighted={hour != null}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function WeeklyRow({
  label, sub, enabled, hour, weekday, resolvedHour, resolvedWeekday,
  onToggle, onHourChange, onWeekdayChange, disabled,
}: {
  label: string; sub: string;
  enabled: boolean;
  hour: number | null;
  weekday: number | null;
  resolvedHour: number;
  resolvedWeekday: number;
  onToggle: (v: boolean) => void;
  onHourChange: (h: number | null) => void;
  onWeekdayChange: (d: number | null) => void;
  disabled?: boolean;
}) {
  const { s } = useLang();
  return (
    <div style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--text-body)', color: 'var(--ink)', letterSpacing: 1.2 }}>{label}</div>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>
        </div>
        <Switch checked={enabled} onChange={() => onToggle(!enabled)} disabled={disabled} />
      </div>
      {enabled && (
        <div style={{ marginTop: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { onHourChange(null); onWeekdayChange(null); }}
            className="btn btn-pill"
            style={pillStyle(hour == null && weekday == null)}
            disabled={disabled}
          >
            {s(`自动 ${weekdayLabel(resolvedWeekday)} ${pad2(resolvedHour)}:00`, `自動 ${weekdayLabel(resolvedWeekday)} ${pad2(resolvedHour)}:00`, `Auto ${weekdayLabel(resolvedWeekday)} ${pad2(resolvedHour)}:00`)}
          </button>
          <WeekdaySelect
            value={weekday ?? resolvedWeekday}
            onChange={onWeekdayChange}
            highlighted={weekday != null}
            disabled={disabled}
          />
          <HourSelect
            value={hour ?? resolvedHour}
            onChange={(h) => onHourChange(h)}
            highlighted={hour != null}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 44, height: 26, padding: 2, borderRadius: 13,
        background: checked ? 'var(--saffron)' : 'var(--ink-5)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: 10,
        background: 'white', transition: 'left 0.15s ease',
      }} />
    </button>
  );
}

function HourSelect({
  value, onChange, highlighted, disabled,
}: {
  value: number;
  onChange: (h: number) => void;
  placeholder?: string;
  highlighted?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        background: highlighted ? 'var(--saffron-pale)' : 'var(--glass-thick)',
        border: `1px solid ${highlighted ? 'var(--saffron)' : 'var(--glass-border)'}`,
        borderRadius: 'var(--r-pill)',
        font: 'var(--text-body)',
        color: 'var(--ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>{pad2(h)}:00</option>
      ))}
    </select>
  );
}

function WeekdaySelect({
  value, onChange, highlighted, disabled,
}: {
  value: number;
  onChange: (d: number) => void;
  highlighted?: boolean;
  disabled?: boolean;
}) {
  const { s } = useLang();
  const labels = [
    s('周一', '週一', 'Mon'),
    s('周二', '週二', 'Tue'),
    s('周三', '週三', 'Wed'),
    s('周四', '週四', 'Thu'),
    s('周五', '週五', 'Fri'),
    s('周六', '週六', 'Sat'),
    s('周日', '週日', 'Sun'),
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      disabled={disabled}
      style={{
        padding: '6px 10px',
        background: highlighted ? 'var(--saffron-pale)' : 'var(--glass-thick)',
        border: `1px solid ${highlighted ? 'var(--saffron)' : 'var(--glass-border)'}`,
        borderRadius: 'var(--r-pill)',
        font: 'var(--text-body)',
        color: 'var(--ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {labels.map((lbl, i) => (
        <option key={i} value={i + 1}>{lbl}</option>
      ))}
    </select>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    font: 'var(--text-caption)',
    background: active ? 'var(--saffron-pale)' : 'var(--glass-thick)',
    color: active ? 'var(--saffron-dark)' : 'var(--ink-3)',
    border: `1px solid ${active ? 'var(--saffron)' : 'var(--glass-border)'}`,
    fontWeight: active ? 700 : 400,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function weekdayLabel(d: number): string {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][d - 1] ?? '周一';
}
