// AboutPage · /about
//   静态信息 · 版本号 + 联系方式 + 开源致谢
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';

const VERSION = '2.0.0-alpha.1';
const BUILD_TS = new Date().toISOString().slice(0, 10);

export default function AboutPage() {
  const { s } = useLang();
  return (
    <div>
      <TopNav titles={['关于觉学', '關於覺學', 'About']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--sp-6) 0 var(--sp-5)' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: 'var(--sp-3)' }}>📿</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: 6, marginBottom: 4 }}>
            {s('觉学', '覺學', 'Juexue')}
          </h1>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 6 }}>
            v{VERSION} · {BUILD_TS}
          </p>
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-3)' }}>
          <p style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.2, lineHeight: 1.9 }}>
            {s(
              '觉学 · 用现代工具学习佛法 · 数字化的法本研习与日常背诵',
              '覺學 · 用現代工具學習佛法 · 數位化的法本研習與日常背誦',
              'Juexue · A modern tool for studying Buddhist scriptures with daily review.',
            )}
          </p>
        </div>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
            {s('技术栈', '技術棧', 'Tech stack')}
          </h2>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px', lineHeight: 1.7 }}>
            React 18 · TypeScript · Vite · React Query · React Router · Capacitor
          </p>
        </div>

        <p style={{ textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1.5, marginTop: 'var(--sp-5)', lineHeight: 1.8 }}>
          {s('愿一切众生皆得安乐', '願一切眾生皆得安樂', 'May all beings be at ease')}
        </p>
      </div>
    </div>
  );
}
