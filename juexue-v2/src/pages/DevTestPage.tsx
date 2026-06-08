// 觉学 v2 · 开发自测页
// 路由：/app/dev-test
// 验证 Phase 2 所有 lib 工作正常 · Phase 4+ 可删
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { impact, notification, selection } from '@/lib/haptics';
import { announce } from '@/lib/a11y';
import Dialog from '@/components/Dialog';
import Skeleton from '@/components/Skeleton';
import { api } from '@/lib/api';
import { getAccess } from '@/lib/tokenStore';

export default function DevTestPage() {
  const { lang, setLang, t, s } = useLang();
  const { mode, effective, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [healthRes, setHealthRes] = useState<string>('');

  async function pingHealth() {
    try {
      const r = await api.get<{ ok?: boolean; uptime?: number }>('/api/health');
      setHealthRes(JSON.stringify(r));
      toast.ok(s('健康检查 OK', '健康檢查 OK', 'Health OK'));
    } catch (e) {
      const msg = (e as Error).message;
      setHealthRes('ERR ' + msg);
      toast.error(s('请求失败：', '請求失敗：', 'Request failed: ') + msg);
    }
  }

  return (
    <div style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <h1 className="t-h1">Phase 2 · Lib 自测</h1>

      <Section title="i18n">
        <p>当前语言：<b>{lang}</b></p>
        <p>{t('common.confirm')} / {t('tab.home')} / {t('common.loading')}</p>
        <p>JX.sc 三参数：{s('简体', '繁體', 'English')}</p>
        <ChipRow value={lang} onPick={setLang} options={[['sc', '简体'], ['tc', '繁體'], ['en', 'English']]} />
      </Section>

      <Section title="theme">
        <p>mode = <b>{mode}</b> · effective = <b>{effective}</b></p>
        <ChipRow value={mode} onPick={setMode} options={[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]} />
      </Section>

      <Section title="toast">
        <ButtonRow>
          <button className="btn btn-primary btn-pill" onClick={() => toast.ok('保存成功')}>ok</button>
          <button className="btn btn-primary btn-pill" onClick={() => toast.error('网络异常')}>error</button>
          <button className="btn btn-primary btn-pill" onClick={() => toast.warn('操作不可撤销')}>warn</button>
          <button className="btn btn-primary btn-pill" onClick={() => toast.info('已复制')}>info</button>
        </ButtonRow>
      </Section>

      <Section title="haptics">
        <ButtonRow>
          <button className="btn btn-primary btn-pill" onClick={() => impact('light')}>impact light</button>
          <button className="btn btn-primary btn-pill" onClick={() => impact('heavy')}>impact heavy</button>
          <button className="btn btn-primary btn-pill" onClick={() => notification('success')}>notif success</button>
          <button className="btn btn-primary btn-pill" onClick={() => selection()}>selection</button>
        </ButtonRow>
      </Section>

      <Section title="a11y · announce">
        <button className="btn btn-primary btn-pill" onClick={() => announce('屏幕阅读器现在应该读出这句话')}>
          announce
        </button>
      </Section>

      <Section title="Dialog · 焦点陷阱 + Esc 关闭">
        <button className="btn btn-primary btn-pill" onClick={() => setOpen(true)}>打开 Dialog</button>
        <Dialog open={open} onClose={() => setOpen(false)} title="测试 Dialog">
          <p style={{ padding: '12px 0' }}>Tab 应该圈在容器内 · Esc 应该关闭</p>
          <button className="btn btn-primary btn-pill" onClick={() => setOpen(false)}>关闭</button>
        </Dialog>
      </Section>

      <Section title="Skeleton">
        <Skeleton.List count={3} variant="card" />
      </Section>

      <Section title="api · GET /api/health">
        <ButtonRow>
          <button className="btn btn-primary btn-pill" onClick={pingHealth}>请求</button>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{healthRes}</span>
        </ButtonRow>
        <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>access token: {getAccess() ? 'present' : 'none'}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card" style={{ padding: 'var(--sp-4)' }}>
      <h2 style={{ fontSize: 14, marginBottom: 8, color: 'var(--saffron-dark)', letterSpacing: 2 }}>{title}</h2>
      {children}
    </div>
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}

function ChipRow<T extends string>({
  value, onPick, options,
}: { value: T; onPick: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="lang-picker" style={{ marginTop: 8 }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={'lang-pick-chip' + (value === v ? ' active' : '')}
          onClick={() => onPick(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
