// 首次引导 · 加入班级 / 自由学习 二选一
//   完成后 POST /api/auth/onboarding-done · refreshUser · nav '/'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

type Mode = null | 'class' | 'free';

export default function OnboardingPage() {
  const { s } = useLang();
  const { user, refreshUser } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function joinClass() {
    if (!/^[A-Z0-9]{6,8}$/i.test(code.trim())) {
      toast.warn(s('邀请码 6-8 位字母数字', '邀請碼 6-8 位字母數字', 'Code: 6-8 alphanumeric'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/classes/join', { joinCode: code.trim().toUpperCase() });
      await api.post('/api/auth/onboarding-done', {});
      await refreshUser();
      toast.ok(s('已加入 · 欢迎共修', '已加入 · 歡迎共修', 'Joined the class'));
      nav('/', { replace: true });
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function freeStudy() {
    setSubmitting(true);
    try {
      await api.post('/api/auth/onboarding-done', {});
      await refreshUser();
      toast.ok(s('已开启自由学习', '已開啟自由學習', 'Free study mode'));
      nav('/', { replace: true });
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 'var(--sp-7) var(--sp-5) var(--sp-8)',
        background: 'var(--bg-scene)',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--sp-5) 0' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 'var(--r-xl)',
              margin: '0 auto var(--sp-5)',
              background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 28px rgba(224,120,86,.35)',
              fontSize: '2rem',
              color: '#fff',
            }}
          >
            🪷
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', letterSpacing: 4, color: 'var(--ink)', marginBottom: 'var(--sp-3)' }}>
            {s('欢迎进入觉学', '歡迎進入覺學', 'Welcome to Juexue')}
          </h1>
          {user?.dharmaName && (
            <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--saffron-dark)', marginBottom: 'var(--sp-3)' }}>
              {user.dharmaName}
            </p>
          )}
          <p style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: 1, lineHeight: 1.7 }}>
            {s('请选择您的学习方式 · 开启闻思之旅',
               '請選擇您的學習方式 · 開啟聞思之旅',
               'Choose your study mode')}
          </p>
        </div>

        <OptionCard
          active={mode === 'class'}
          onClick={() => setMode('class')}
          title={s('加入班级', '加入班級', 'Join a class')}
          desc={s('辅导员陪伴 · 共修共进', '輔導員陪伴 · 共修共進', 'Coach-guided · group study')}
        >
          {mode === 'class' && (
            <div style={{ paddingTop: 'var(--sp-3)' }}>
              <input
                type="text"
                placeholder="XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 'var(--r)',
                  border: '2px solid var(--border-light)',
                  background: 'var(--bg-input)',
                  color: 'var(--ink)',
                  fontFamily: "'SF Mono', Consolas, monospace",
                  fontSize: '1.125rem',
                  letterSpacing: 4,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  outline: 'none',
                }}
                aria-label={s('班级邀请码', '班級邀請碼', 'Class invite code')}
              />
              <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 'var(--sp-2)' }}>
                {s('向辅导员索取 6-8 位邀请码', '向輔導員索取 6-8 位邀請碼', 'Ask coach for 6-8 char code')}
              </p>
              <button
                type="button"
                onClick={joinClass}
                disabled={submitting}
                className="btn btn-primary btn-lg btn-full btn-pill"
                style={{ marginTop: 'var(--sp-3)' }}
              >
                {submitting ? s('提交中…', '提交中…', 'Submitting…') : s('确认加入', '確認加入', 'Join')}
              </button>
            </div>
          )}
        </OptionCard>

        <OptionCard
          active={mode === 'free'}
          onClick={() => setMode('free')}
          title={s('自由学习', '自由學習', 'Free study')}
          desc={s('独立闻思 · 随心选课', '獨立聞思 · 隨心選課', 'Solo · pick any text')}
        >
          {mode === 'free' && (
            <div style={{ paddingTop: 'var(--sp-3)' }}>
              <button
                type="button"
                onClick={freeStudy}
                disabled={submitting}
                className="btn btn-primary btn-lg btn-full btn-pill"
              >
                {submitting ? s('提交中…', '提交中…', 'Submitting…') : s('开始自由学习', '開始自由學習', 'Start free study')}
              </button>
            </div>
          )}
        </OptionCard>
      </div>
    </div>
  );
}

function OptionCard({
  active, onClick, title, desc, children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: 'var(--sp-5)',
        background: active
          ? 'linear-gradient(135deg, var(--saffron-pale), var(--gold-pale))'
          : 'var(--glass-thick)',
        backdropFilter: 'var(--blur)',
        border: '1px solid ' + (active ? 'var(--saffron-light)' : 'var(--glass-border)'),
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transform: active ? 'translateY(-2px)' : 'none',
        boxShadow: active ? '0 8px 22px rgba(224,120,86,.18)' : 'none',
        transition: 'all .2s var(--ease)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.0625rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, lineHeight: 1.6 }}>
        {desc}
      </div>
      {children}
    </button>
  );
}
