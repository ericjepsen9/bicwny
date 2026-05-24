// HelpPage · /help
//   FAQ + 联系方式
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';

interface QA {
  q: [string, string, string];
  a: [string, string, string];
}

const FAQS: QA[] = [
  {
    q: ['如何加入班级？', '如何加入班級？', 'How to join a class?'],
    a: [
      '点击"我的"中的"加入班级"，输入辅导员提供的加入码即可。每位学员同一课程只能加入一个班级。',
      '點擊「我的」中的「加入班級」，輸入輔導員提供的加入碼即可。每位學員同一課程只能加入一個班級。',
      'Tap "Join Class" in My, enter the join code from your coach. One class per course per student.',
    ],
  },
  {
    q: ['忘记密码怎么办？', '忘記密碼怎麼辦？', 'Forgot password?'],
    a: [
      '登录页点击"忘记密码"，输入注册邮箱，系统会发送重置链接。链接 30 分钟内有效。',
      '登入頁點擊「忘記密碼」，輸入註冊郵箱，系統會發送重置連結。連結 30 分鐘內有效。',
      'On the sign-in page tap "Forgot password", enter your email. The reset link is valid for 30 minutes.',
    ],
  },
  {
    q: ['答题后什么时候复习？', '答題後何時複習？', 'When will I review?'],
    a: [
      '系统使用 SM-2 间隔记忆算法。答对的题目按 1 天 → 3 天 → 7 天 → … 的间隔提醒；答错的题目进入错题本，明天优先出现。',
      '系統使用 SM-2 間隔記憶演算法。答對的題目按 1 天 → 3 天 → 7 天 → … 的間隔提醒；答錯的題目進入錯題本，明天優先出現。',
      'We use the SM-2 spaced-repetition algorithm. Correct answers reappear at 1d → 3d → 7d → … intervals; wrong ones go to your mistake book and surface first next day.',
    ],
  },
  {
    q: ['开放作答题是怎么评分的？', '開放作答題如何評分？', 'How is open-text grading done?'],
    a: [
      '由 AI 基于辅导员预设的关键点逐点比对您的答案，每命中一个关键点得一分，最后综合给出总分与要点反馈。',
      '由 AI 基於輔導員預設的關鍵點逐點比對您的答案，每命中一個關鍵點得一分，最後綜合給出總分與要點反饋。',
      'An AI compares your answer against the coach-defined key points; each hit scores a point, summed into a total with point-by-point feedback.',
    ],
  },
  {
    q: ['注销账号后数据去哪了？', '註銷賬號後數據去哪了？', 'What happens to my data after deletion?'],
    a: [
      '个人信息（邮箱、法名、头像）会在 30 天内删除；答题记录与 SM-2 卡片会脱敏后保留用于匿名统计。详见隐私政策。',
      '個人信息（郵箱、法名、頭像）會在 30 天內刪除；答題記錄與 SM-2 卡片會脫敏後保留用於匿名統計。詳見隱私政策。',
      'Personal info (email, name, avatar) is deleted within 30 days. Answer records and SM-2 cards are anonymized and kept for aggregate stats. See Privacy.',
    ],
  },
];

export default function HelpPage() {
  const { s } = useLang();
  return (
    <div>
      <TopNav titles={['帮助', '幫助', 'Help']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <SectionLabel>{s('常见问题', '常見問題', 'FAQ')}</SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {FAQS.map((qa, i) => (
            <details key={i} className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5, lineHeight: 1.5, listStyle: 'none' }}>
                <span style={{ color: 'var(--saffron)', marginRight: 6 }}>·</span>
                {s(qa.q[0], qa.q[1], qa.q[2])}
              </summary>
              <p style={{ marginTop: 'var(--sp-3)', font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: '.5px', lineHeight: 1.7 }}>
                {s(qa.a[0], qa.a[1], qa.a[2])}
              </p>
            </details>
          ))}
        </div>

        <SectionLabel style={{ marginTop: 'var(--sp-5)' }}>{s('联系我们', '聯繫我們', 'Contact')}</SectionLabel>

        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 4 }}>
            {s('邮件反馈', '郵件反饋', 'Email')}
          </div>
          <a href="mailto:support@juexue.app" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--saffron-dark)', fontWeight: 600, fontSize: '1rem', letterSpacing: '.5px' }}>
            support@juexue.app
          </a>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: '.5px', lineHeight: 1.7, marginTop: 'var(--sp-2)' }}>
            {s(
              '请附上您的账号邮箱与问题截图（如有）。我们通常在 2 个工作日内回复。',
              '請附上您的賬號郵箱與問題截圖（如有）。我們通常在 2 個工作日內回覆。',
              'Include your account email and screenshots if any. We usually reply within 2 working days.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{
      font: 'var(--text-caption)',
      color: 'var(--ink-3)',
      letterSpacing: 2,
      marginBottom: 'var(--sp-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      ...style,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
      {children}
    </h2>
  );
}
