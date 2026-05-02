// ProfileEditPage · /profile/edit
//   编辑：法名 · 头像字 · 语言 · 时区
//   邮箱只读
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Field from '@/components/Field';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

const LOCALE_OPTS: { v: string; label: string }[] = [
  { v: 'zh-Hans', label: '简体' },
  { v: 'zh-Hant', label: '繁體' },
  { v: 'en',      label: 'EN' },
];
const TZ_OPTS: { v: string; label: string }[] = [
  { v: 'Asia/Taipei',         label: 'Taipei' },
  { v: 'Asia/Shanghai',       label: 'Shanghai' },
  { v: 'Asia/Hong_Kong',      label: 'Hong Kong' },
  { v: 'America/Los_Angeles', label: 'LA' },
  { v: 'Europe/London',       label: 'London' },
];

export default function ProfileEditPage() {
  const { s } = useLang();
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();

  const [dharmaName, setDharmaName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [locale, setLocale] = useState<string>('zh-Hans');
  const [timezone, setTimezone] = useState<string>('Asia/Shanghai');
  const [err, setErr] = useState('');

  // 用户加载后填初值
  useEffect(() => {
    if (!user) return;
    setDharmaName(user.dharmaName || '');
    setAvatar(user.avatar || '');
    setLocale(user.locale || 'zh-Hans');
    setTimezone(user.timezone || 'Asia/Shanghai');
  }, [user]);

  const submit = useMutation({
    mutationFn: () => api.patch('/api/auth/me', {
      dharmaName: dharmaName.trim() || null,
      avatar: avatar.trim() || null,
      locale,
      timezone,
    }),
    onSuccess: async () => {
      await refreshUser();
      toast.ok(s('已保存', '已保存', 'Saved'));
      nav(-1);
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    submit.mutate();
  }

  return (
    <div>
      <TopNav titles={['编辑资料', '編輯資料', 'Edit Profile']} />

      <form onSubmit={onSubmit} style={{ padding: '0 var(--sp-5) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <Field
          label={s('法名 / 姓名', '法名 / 姓名', 'Dharma name')}
          value={dharmaName}
          onChange={setDharmaName}
          maxLength={32}
          placeholder={s('如：明心', '如：明心', 'e.g. Mingxin')}
        />

        <Field
          label={s('头像字（1 个字）', '頭像字（1 個字）', 'Avatar letter')}
          value={avatar}
          onChange={(v) => setAvatar(v.slice(0, 1))}
          maxLength={1}
          placeholder={dharmaName.slice(0, 1) || '心'}
        />

        <div>
          <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
            {s('邮箱（不可修改）', '郵箱（不可修改）', 'Email (read-only)')}
          </label>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--ink-3)', font: 'var(--text-body)' }}>
            {user?.email || '—'}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
            {s('首选语言', '首選語言', 'Preferred language')}
          </label>
          <ChipPicker value={locale} options={LOCALE_OPTS} onChange={setLocale} />
        </div>

        <div>
          <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
            {s('时区', '時區', 'Timezone')}
          </label>
          <ChipPicker value={timezone} options={TZ_OPTS} onChange={setTimezone} wrap />
        </div>

        {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}

        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <button
            type="button"
            onClick={() => nav(-1)}
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
            {submit.isPending ? s('保存中…', '保存中…', 'Saving…') : s('保存', '保存', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChipPicker<T extends string>({
  value, options, onChange, wrap,
}: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; wrap?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: wrap ? 'wrap' : 'nowrap' }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              flex: wrap ? '0 0 auto' : 1,
              padding: '10px 14px',
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
