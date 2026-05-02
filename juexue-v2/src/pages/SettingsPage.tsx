// SettingsPage · /settings
//   外观 / 字号 / 语言 / 邮箱验证 / 安全（密码 + 设备） / 偏好（推送 + 触觉） /
//   存储（缓存清理 + 数据导出） / 关于 / 注销
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FONT_SCALES, useFontScale } from '@/lib/fontSize';
import { getHapticsEnabled, setHapticsEnabled, tap } from '@/lib/haptics';
import { useLang, type Lang } from '@/lib/i18n';
import * as push from '@/lib/push';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function SettingsPage() {
  const { s } = useLang();
  const { user, refreshUser } = useAuth();

  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const resend = useMutation({
    mutationFn: () => api.post('/api/auth/resend-verify'),
    onSuccess: () => toast.ok(s('验证邮件已发送', '驗證郵件已發送', 'Email sent')),
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <div>
      <TopNav titles={['设置', '設定', 'Settings']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {/* 主题 */}
        <SectionLabel>{s('外观', '外觀', 'Appearance')}</SectionLabel>
        <ThemePicker />

        {/* 字号 */}
        <SectionLabel style={{ marginTop: 'var(--sp-4)' }}>{s('字号', '字號', 'Font size')}</SectionLabel>
        <FontScalePicker />

        {/* 语言 */}
        <SectionLabel style={{ marginTop: 'var(--sp-4)' }}>{s('语言', '語言', 'Language')}</SectionLabel>
        <LangPicker />

        {/* 邮箱验证 */}
        {user && !user.emailVerifiedAt && (
          <>
            <SectionLabel style={{ marginTop: 'var(--sp-4)' }}>{s('账户', '賬戶', 'Account')}</SectionLabel>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
              <div style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)', letterSpacing: 1, marginBottom: 'var(--sp-2)' }}>
                📧 {s('邮箱尚未验证', '郵箱尚未驗證', 'Email not verified')}
              </div>
              <button
                type="button"
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
                className="btn btn-pill"
                style={{ padding: '8px 14px', background: 'var(--gold-pale)', color: 'var(--gold-dark)', border: '1px solid var(--gold-light)' }}
              >
                {resend.isPending ? s('发送中…', '發送中…', 'Sending…') : s('重发验证邮件', '重發驗證郵件', 'Resend')}
              </button>
            </div>
          </>
        )}

        {/* 账户操作 */}
        <SectionLabel style={{ marginTop: user?.emailVerifiedAt ? 'var(--sp-4)' : 'var(--sp-3)' }}>
          {s('安全', '安全', 'Security')}
        </SectionLabel>
        <div className="group">
          <RowButton onClick={() => setPwOpen(true)} icon="🔒" label={s('修改密码', '修改密碼', 'Change password')} />
          <LinkRow to="/devices" icon="📱" label={s('登录设备', '登入裝置', 'Devices')} />
        </div>

        {/* 偏好 · 推送通知 + 触觉反馈 */}
        <SectionLabel style={{ marginTop: 'var(--sp-4)' }}>{s('偏好', '偏好', 'Preferences')}</SectionLabel>
        <div className="group">
          <PushToggle />
          <HapticsToggle />
        </div>

        {/* 存储 · 清缓存 + 导出数据 */}
        <SectionLabel style={{ marginTop: 'var(--sp-4)' }}>{s('存储', '存儲', 'Storage')}</SectionLabel>
        <div className="group">
          <CacheClearRow />
          <DataExportRow />
        </div>

        {/* 关于 */}
        <SectionLabel style={{ marginTop: 'var(--sp-4)' }}>{s('关于', '關於', 'About')}</SectionLabel>
        <div className="group">
          <LinkRow to="/about" icon="ℹ️" label={s('关于觉学', '關於覺學', 'About')} />
          <LinkRow to="/help" icon="❓" label={s('帮助', '幫助', 'Help')} />
          <LinkRow to="/terms" icon="📜" label={s('用户协议', '用戶協議', 'Terms')} />
          <LinkRow to="/privacy" icon="🔐" label={s('隐私政策', '隱私政策', 'Privacy')} />
        </div>

        {/* 注销账户 */}
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <button
            type="button"
            onClick={() => setDelOpen(true)}
            className="btn btn-pill btn-full"
            style={{
              padding: 12,
              background: 'transparent',
              color: 'var(--crimson)',
              border: '1px solid rgba(192,57,43,.3)',
              justifyContent: 'center',
            }}
          >
            {s('注销账户', '註銷賬戶', 'Delete account')}
          </button>
        </div>
      </div>

      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} title={s('修改密码', '修改密碼', 'Change password')}>
        <ChangePasswordForm onDone={() => setPwOpen(false)} />
      </Dialog>
      <Dialog open={delOpen} onClose={() => setDelOpen(false)} title={s('注销账户', '註銷賬戶', 'Delete account')}>
        <DeleteAccountForm
          onDone={async () => {
            setDelOpen(false);
            await refreshUser();
          }}
        />
      </Dialog>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2
      style={{
        font: 'var(--text-caption)',
        color: 'var(--ink-3)',
        letterSpacing: 2,
        marginBottom: 'var(--sp-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
      {children}
    </h2>
  );
}

function ThemePicker() {
  const { mode, setMode } = useTheme();
  const { s } = useLang();
  const opts: { v: ThemeMode; label: string }[] = [
    { v: 'auto',  label: s('跟随系统', '跟隨系統', 'Auto') },
    { v: 'light', label: s('浅色', '淺色', 'Light') },
    { v: 'dark',  label: s('深色', '深色', 'Dark') },
  ];
  return <ChipPicker value={mode} options={opts} onChange={setMode} />;
}

function LangPicker() {
  const { lang, setLang } = useLang();
  const opts: { v: Lang; label: string }[] = [
    { v: 'sc', label: '简体' },
    { v: 'tc', label: '繁體' },
    { v: 'en', label: 'EN' },
  ];
  return <ChipPicker value={lang} options={opts} onChange={setLang} />;
}

function FontScalePicker() {
  const { scale, setScale } = useFontScale();
  const { s } = useLang();
  const opts = FONT_SCALES.map((o) => ({
    v: String(o.value),
    label: s(o.labelSc, o.labelTc, o.labelEn),
  }));
  return (
    <ChipPicker
      value={String(scale)}
      options={opts}
      onChange={(v) => {
        const num = parseFloat(v);
        setScale(num);
        tap();
      }}
    />
  );
}

function PushToggle() {
  const { s } = useLang();
  const [st, setSt] = useState<push.PushStatus>('off');
  const [busy, setBusy] = useState(false);
  const supported = push.isSupported();

  useEffect(() => {
    if (!supported) {
      setSt('unsupported');
      return;
    }
    push.status().then(setSt);
  }, [supported]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (st === 'on') {
        const next = await push.unsubscribe();
        setSt(next);
        toast.ok(s('已关闭推送', '已關閉推送', 'Push off'));
      } else {
        const next = await push.subscribe();
        setSt(next);
        if (next === 'on') toast.ok(s('已开启推送', '已開啟推送', 'Push on'));
        else if (next === 'denied') toast.warn(s('已被浏览器拒绝 · 请到设置开启', '已被瀏覽器拒絕', 'Blocked by browser'));
        else if (next === 'unconfigured') toast.warn(s('服务端未配置 VAPID', '服務端未配置 VAPID', 'Server not configured'));
        else toast.warn(s('暂时无法开启', '暫時無法開啟', 'Could not enable'));
      }
    } catch (e) {
      toast.error((e as ApiError).message || s('失败', '失敗', 'Failed'));
    } finally {
      setBusy(false);
    }
  }

  const on = st === 'on';
  const disabled = !supported || st === 'denied' || st === 'unsupported' || busy;
  const sub = !supported
    ? s('当前浏览器不支持', '當前瀏覽器不支援', 'Browser unsupported')
    : st === 'denied'
      ? s('已被浏览器拒绝', '已被瀏覽器拒絕', 'Blocked')
      : st === 'unconfigured'
        ? s('服务端未配置', '服務端未配置', 'Server unconfigured')
        : null;

  return (
    <ToggleRow
      icon="🔔"
      label={s('推送通知', '推送通知', 'Push notifications')}
      sub={sub}
      checked={on}
      disabled={disabled}
      onChange={toggle}
    />
  );
}

function HapticsToggle() {
  const { s } = useLang();
  const [on, setOn] = useState<boolean>(() => getHapticsEnabled());
  function toggle() {
    const next = !on;
    setHapticsEnabled(next);
    setOn(next);
    if (next) tap();
    toast.ok(next ? s('已开启', '已開啟', 'On') : s('已关闭', '已關閉', 'Off'));
  }
  return (
    <ToggleRow
      icon="📳"
      label={s('触觉反馈', '觸覺回饋', 'Haptic feedback')}
      checked={on}
      onChange={toggle}
    />
  );
}

function CacheClearRow() {
  const { s } = useLang();
  const [busy, setBusy] = useState(false);

  async function clear() {
    if (busy) return;
    if (!confirm(s('清除离线缓存？下次访问需重新加载。', '清除離線快取？下次訪問需重新載入。', 'Clear offline cache?'))) return;
    setBusy(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.ok(s('缓存已清除', '快取已清除', 'Cache cleared'));
    } catch (e) {
      toast.error(s('清除失败', '清除失敗', 'Failed') + ' · ' + ((e as Error).message || ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={clear}
      disabled={busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'transparent',
        border: 'none',
        cursor: busy ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
        color: 'inherit',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        🧹
      </span>
      <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
        {busy ? s('清除中…', '清除中…', 'Clearing…') : s('清除缓存', '清除快取', 'Clear cache')}
      </span>
      <Arrow />
    </button>
  );
}

function DataExportRow() {
  const { s } = useLang();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    if (busy) return;
    setBusy(true);
    try {
      // 直接 fetch 而非 api.get · 需要 blob
      const res = await fetch('/api/auth/me/data-export', {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const filename = m?.[1] || `juexue-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.ok(s('数据导出已开始下载', '數據導出已開始下載', 'Export downloading'));
    } catch (e) {
      const msg = (e as Error).message || s('导出失败', '導出失敗', 'Export failed');
      toast.warn(msg.includes('cooldown') || msg.includes('Too soon')
        ? s('请稍后再试 · 5 分钟内仅可导出一次', '請稍後再試 · 5 分鐘內僅可導出一次', 'Try again later (1/5min)')
        : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportData}
      disabled={busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'transparent',
        border: 'none',
        cursor: busy ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
        color: 'inherit',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        📦
      </span>
      <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
        {busy ? s('导出中…', '導出中…', 'Exporting…') : s('导出我的数据', '導出我的數據', 'Export my data')}
      </span>
      <Arrow />
    </button>
  );
}

function ToggleRow({
  icon, label, sub, checked, disabled, onChange,
}: {
  icon: string;
  label: string;
  sub?: string | null;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
          {label}
        </div>
        {sub && (
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: checked ? 'var(--saffron)' : 'var(--border)',
          border: 'none',
          padding: 2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background .2s var(--ease)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,.15)',
            transition: 'all .2s var(--ease)',
            display: 'block',
          }}
        />
      </button>
    </div>
  );
}

function ChipPicker<T extends string>({
  value, options, onChange,
}: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              flex: 1,
              padding: '10px 6px',
              borderRadius: 'var(--r-pill)',
              font: 'var(--text-caption)',
              fontWeight: 600,
              letterSpacing: 1,
              background: on ? 'var(--saffron-pale)' : 'var(--glass-thick)',
              border: '1px solid ' + (on ? 'var(--saffron-light)' : 'var(--glass-border)'),
              color: on ? 'var(--saffron-dark)' : 'var(--ink-3)',
              cursor: 'pointer',
              transition: 'all .2s var(--ease)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RowButton({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        color: 'inherit',
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
        {label}
      </span>
      <Arrow />
    </button>
  );
}

function LinkRow({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--saffron-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
        {label}
      </span>
      <Arrow />
    </Link>
  );
}
function Arrow() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--ink-4)', flexShrink: 0 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { s } = useLang();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const submit = useMutation({
    mutationFn: () => api.post('/api/auth/change-password', { currentPassword: cur, newPassword: next }),
    onSuccess: () => {
      toast.ok(s('密码已更新', '密碼已更新', 'Password updated'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (next.length < 8) {
      setErr(s('新密码至少 8 位', '新密碼至少 8 位', 'New password ≥ 8 chars'));
      return;
    }
    if (next !== confirm) {
      setErr(s('两次输入不一致', '兩次輸入不一致', 'Passwords do not match'));
      return;
    }
    submit.mutate();
  }

  return (
    <form onSubmit={onSubmit} style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <Field label={s('当前密码', '當前密碼', 'Current')} type="password" value={cur} onChange={setCur} required />
      <Field label={s('新密码', '新密碼', 'New')} type="password" value={next} onChange={setNext} required />
      <Field label={s('确认新密码', '確認新密碼', 'Confirm')} type="password" value={confirm} onChange={setConfirm} required />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        <button
          type="button"
          onClick={onDone}
          className="btn btn-pill"
          style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}
        >
          {s('取消', '取消', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submit.isPending}
          className="btn btn-primary btn-pill"
          style={{ flex: 1, padding: 12, justifyContent: 'center' }}
        >
          {submit.isPending ? s('提交中…', '提交中…', 'Submitting…') : s('确认', '確認', 'Confirm')}
        </button>
      </div>
    </form>
  );
}

function DeleteAccountForm({ onDone }: { onDone: () => Promise<void> | void }) {
  const { s } = useLang();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const submit = useMutation({
    mutationFn: () => api.del('/api/auth/me', { currentPassword: pw }),
    onSuccess: async () => {
      toast.ok(s('账户已注销', '賬戶已註銷', 'Account deleted'));
      await onDone();
      window.location.href = '/app/auth';
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!confirm(s('此操作不可逆 · 真的要注销？', '此操作不可逆 · 真的要註銷？', 'Irreversible. Continue?'))) return;
    submit.mutate();
  }

  return (
    <form onSubmit={onSubmit} style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <p style={{ font: 'var(--text-caption)', color: 'var(--crimson)', letterSpacing: 1, lineHeight: 1.6 }}>
        ⚠️ {s('注销将删除所有学习记录 · 此操作不可逆', '註銷將刪除所有學習記錄 · 此操作不可逆', 'All data will be deleted permanently.')}
      </p>
      <Field label={s('请输入当前密码以确认', '請輸入當前密碼以確認', 'Enter current password')} type="password" value={pw} onChange={setPw} required />
      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        <button
          type="button"
          onClick={() => onDone()}
          className="btn btn-pill"
          style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}
        >
          {s('取消', '取消', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={submit.isPending}
          className="btn btn-pill"
          style={{
            flex: 1,
            padding: 12,
            background: 'var(--crimson)',
            color: '#fff',
            border: 'none',
            justifyContent: 'center',
          }}
        >
          {submit.isPending ? s('注销中…', '註銷中…', 'Deleting…') : s('确认注销', '確認註銷', 'Confirm')}
        </button>
      </div>
    </form>
  );
}
