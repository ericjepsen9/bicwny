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
import * as pushApi from '@/lib/push';
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

// v2 push 偏好 · spec §8 NotificationPreference
interface PushPrefs {
  pushEnabled: boolean;
  pushTypes: Record<string, boolean>;
  homeCardEnabled: boolean;
  auspiciousDayCard: boolean;
}

// Per-type 开关列表 · 与 backend NO_PUSH_EVENTS 互补
// membership_change / auspicious_day 走 inbox-only · 不在此列表
type PushType = {
  key: string;
  labelSc: string;
  labelTc: string;
  labelEn: string;
  descSc: string;
  descTc: string;
  descEn: string;
};
const PUSH_TYPES: PushType[] = [
  { key: 'class_session', labelSc: '共修开始', labelTc: '共修開始', labelEn: 'Class Session', descSc: '共修开始前 30/5/0 分钟提醒', descTc: '共修開始前 30/5/0 分鐘提醒', descEn: 'T-30/T-5/T0 reminders' },
  { key: 'class_announcement', labelSc: '班级公告', labelTc: '班級公告', labelEn: 'Class Announcement', descSc: '辅导员发布班级公告', descTc: '輔導員發佈班級公告', descEn: 'Coach announcements' },
  { key: 'practice_task', labelSc: '修学任务', labelTc: '修學任務', labelEn: 'Practice Task', descSc: '任务下达 · 截止前 24h / 6h 提醒', descTc: '任務下達 · 截止前 24h / 6h 提醒', descEn: 'Task created · 24h / 6h reminders' },
  { key: 'achievement', labelSc: '成就解锁', labelTc: '成就解鎖', labelEn: 'Achievement', descSc: '解锁徽章时通知（5 分钟聚合）', descTc: '解鎖徽章時通知（5 分鐘聚合）', descEn: 'Badge unlocks (5min aggregated)' },
  { key: 'system_announcement', labelSc: '系统公告', labelTc: '系統公告', labelEn: 'System Announcement', descSc: '平台公告 · 紧急公告无视此开关', descTc: '平台公告 · 緊急公告無視此開關', descEn: 'Platform announcements (critical overrides)' },
  { key: 'dharma_assembly', labelSc: '法会活动', labelTc: '法會活動', labelEn: 'Dharma Assembly', descSc: '法会预告 · 开始前 1h 提醒', descTc: '法會預告 · 開始前 1h 提醒', descEn: 'Assembly preview · 1h reminder' },
];

export default function SettingsNotificationsPage() {
  const { s } = useLang();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['/api/my/notification-prefs'],
    queryFn: () => api.get<PrefsResp>('/api/my/notification-prefs'),
  });

  const m = useMutation({
    mutationFn: (patch: Partial<NotifPrefs>) =>
      api.patch('/api/my/notification-prefs', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/notification-prefs'] });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  // v2 push 偏好 (spec §8) · 与 v1 三档提醒并存
  const pushQ = useQuery({
    queryKey: ['/api/my/push-preferences'],
    queryFn: () => api.get<PushPrefs>('/api/my/push-preferences'),
  });

  const pushM = useMutation({
    mutationFn: (patch: Partial<PushPrefs> & { pushTypes?: Record<string, boolean> }) =>
      api.patch('/api/my/push-preferences', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/push-preferences'] });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  // 本设备真实推送状态（审计 N7）· 服务端 pushEnabled 偏好 ≠ 浏览器订阅/授权态
  const deviceQ = useQuery({
    queryKey: ['push-device-status'],
    queryFn: () => pushApi.status(),
    staleTime: 0,
  });
  const enableM = useMutation({
    mutationFn: () => pushApi.subscribe(),
    onSuccess: (st) => {
      qc.invalidateQueries({ queryKey: ['push-device-status'] });
      if (st === 'denied') toast.error(s('浏览器已拒绝通知权限', '瀏覽器已拒絕通知權限', 'Browser denied permission'));
      else if (st === 'on') toast.ok(s('已开启', '已開啟', 'Enabled'));
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
  const push = pushQ.data;
  const pushEnabled = push?.pushEnabled ?? true;

  return (
    <div>
      <TopNav titles={['通知偏好', '通知偏好', 'Notifications']} backTo="/settings" />
      <div style={{ padding: '0 var(--sp-5) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>

        {/* Push 通道总开关 · spec §8 */}
        <SectionLabel>{s('系统通知 · Push', '系統通知 · Push', 'Push notifications')}</SectionLabel>
        <div className="menu-card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: 'var(--text-body)', color: 'var(--ink)', letterSpacing: 1.2 }}>
                {s('启用系统通知', '啟用系統通知', 'Enable system push')}
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>
                {s(
                  '关闭后不弹手机系统通知 · 站内消息仍可见',
                  '關閉後不彈手機系統通知 · 站內消息仍可見',
                  'Disable to silence phone push · in-app inbox still works',
                )}
              </div>
            </div>
            <Switch
              checked={pushEnabled}
              onChange={() => pushM.mutate({ pushEnabled: !pushEnabled })}
              disabled={pushQ.isLoading || pushM.isPending}
            />
          </div>
        </div>

        {/* 本设备推送状态提示（审计 N7）· 偏好开但设备未订阅/被拒时明确告知 */}
        {pushEnabled && deviceQ.data && deviceQ.data !== 'on' && (
          <div
            className="menu-card"
            style={{ padding: 'var(--sp-3) var(--sp-4)', border: '1px solid var(--saffron-light)', background: 'var(--saffron-pale)' }}
          >
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {deviceQ.data === 'denied'
                ? s('本设备已拒绝通知权限 · 以下偏好暂不生效 · 请在浏览器设置中开启通知后重试',
                    '本設備已拒絕通知權限 · 以下偏好暫不生效 · 請在瀏覽器設定中開啟通知後重試',
                    'This device has denied notifications · the settings below won\'t take effect until you allow notifications in your browser settings')
                : deviceQ.data === 'unsupported'
                ? s('本设备不支持系统推送 · 站内消息仍可见',
                    '本設備不支援系統推送 · 站內消息仍可見',
                    'This device does not support push · in-app inbox still works')
                : s('本设备尚未开启系统推送 · 以下偏好暂不生效',
                    '本設備尚未開啟系統推送 · 以下偏好暫不生效',
                    'System push is not enabled on this device · the settings below won\'t take effect yet')}
            </div>
            {(deviceQ.data === 'off' || deviceQ.data === 'denied') && (
              <button
                type="button"
                onClick={() => enableM.mutate()}
                disabled={enableM.isPending}
                className="btn btn-pill"
                style={{ marginTop: 'var(--sp-2)', padding: '4px 14px', font: 'var(--text-caption)', background: 'var(--saffron)', color: '#fff', border: 'none' }}
              >
                {enableM.isPending ? s('开启中…', '開啟中…', 'Enabling…') : s('在本设备开启', '在本設備開啟', 'Enable on this device')}
              </button>
            )}
          </div>
        )}

        {/* Per-type push 子开关 */}
        {pushEnabled && (
          <>
            <SectionLabel style={{ marginTop: 'var(--sp-3)' }}>
              {s('按类型控制', '按類型控制', 'Per-type control')}
            </SectionLabel>
            <div className="menu-card">
              {PUSH_TYPES.map((pt, i) => {
                const types = push?.pushTypes ?? {};
                // 缺省 = 开 · 仅显式 false 时关
                const enabled = types[pt.key] !== false;
                return (
                  <div key={pt.key}>
                    {i > 0 && <Divider />}
                    <div style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: 'var(--text-body)', color: 'var(--ink)', letterSpacing: 1.2 }}>
                            {s(pt.labelSc, pt.labelTc, pt.labelEn)}
                          </div>
                          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>
                            {s(pt.descSc, pt.descTc, pt.descEn)}
                          </div>
                        </div>
                        <Switch
                          checked={enabled}
                          onChange={() => pushM.mutate({ pushTypes: { [pt.key]: !enabled } })}
                          disabled={pushM.isPending}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 'var(--sp-1)', lineHeight: 1.5 }}>
              {s(
                '注：紧急系统公告 · 班级成员变动 · 藏历加持日 不受此列表控制',
                '注：緊急系統公告 · 班級成員變動 · 藏曆加持日 不受此列表控制',
                'Note: critical system announcements, membership changes, and auspicious days are not affected',
              )}
            </div>
          </>
        )}

        {/* 时区 */}
        <SectionLabel style={{ marginTop: 'var(--sp-3)' }}>{s('时区', '時區', 'Timezone')}</SectionLabel>
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
