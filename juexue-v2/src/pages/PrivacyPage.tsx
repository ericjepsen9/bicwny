// PrivacyPage · /privacy
//   隐私政策（占位草稿 · 上线前由律师审定）
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';

interface Section {
  title: [string, string, string];
  body: [string, string, string];
}

const SECTIONS: Section[] = [
  {
    title: ['一、我们收集的信息', '一、我們收集的資訊', '1. What we collect'],
    body: [
      '· 账号信息：邮箱、法名（可选）、头像、偏好语言\n· 学习记录：答题记录、SM-2 复习卡片、错题、收藏、学习时长\n· 班级信息：所属班级、加入时间、班内角色\n· 技术信息：登录设备、IP、User-Agent（仅用于安全审计）',
      '· 賬號資訊：郵箱、法名（可選）、頭像、偏好語言\n· 學習記錄：答題記錄、SM-2 複習卡片、錯題、收藏、學習時長\n· 班級資訊：所屬班級、加入時間、班內角色\n· 技術資訊：登入裝置、IP、User-Agent（僅用於安全審計）',
      '· Account: email, dharma name (optional), avatar, preferred language\n· Learning: answers, SM-2 cards, mistakes, favorites, study time\n· Class: which class, join date, role\n· Technical: device, IP, user-agent (security audit only)',
    ],
  },
  {
    title: ['二、我们如何使用', '二、我們如何使用', '2. How we use it'],
    body: [
      '· 提供学习功能（答题、复习、进度同步）\n· 班级内部统计（仅辅导员可见，且仅用于教学辅导）\n· 匿名聚合数据用于产品改进（不关联个人）',
      '· 提供學習功能（答題、複習、進度同步）\n· 班級內部統計（僅輔導員可見，且僅用於教學輔導）\n· 匿名聚合數據用於產品改進（不關聯個人）',
      '· Provide learning features (quiz, review, sync)\n· In-class stats visible only to your coach for teaching\n· Anonymized aggregates for product improvement',
    ],
  },
  {
    title: ['三、我们不会做', '三、我們不會做', '3. What we won\'t do'],
    body: [
      '· 向第三方出售您的个人信息\n· 向非本班辅导员披露您的学习记录\n· 在未征得同意时使用您的内容进行商业推广',
      '· 向第三方出售您的個人資訊\n· 向非本班輔導員披露您的學習記錄\n· 在未徵得同意時使用您的內容進行商業推廣',
      '· Sell your personal info to third parties\n· Share your records with anyone outside your coach\n· Use your content for ads without consent',
    ],
  },
  {
    title: ['四、您的权利', '四、您的權利', '4. Your rights'],
    body: [
      '· 随时修改或导出您的个人信息\n· 随时注销账号，注销后个人数据将在 30 天内删除\n· 答题记录与 SM-2 卡片注销后可匿名保留用于统计',
      '· 隨時修改或匯出您的個人資訊\n· 隨時註銷賬號，註銷後個人數據將在 30 天內刪除\n· 答題記錄與 SM-2 卡片註銷後可匿名保留用於統計',
      '· Edit or export your personal info anytime\n· Delete your account anytime; personal data is purged within 30 days\n· Answer records and SM-2 cards may be anonymized and kept for stats',
    ],
  },
  {
    title: ['五、联系方式', '五、聯繫方式', '5. Contact'],
    body: [
      '如对本政策有疑问，请通过"帮助 → 邮件反馈"联系我们。',
      '如對本政策有疑問，請通過「幫助 → 郵件反饋」聯繫我們。',
      'For questions, contact us via Help → Email.',
    ],
  },
];

export default function PrivacyPage() {
  const { s } = useLang();
  return (
    <div>
      <TopNav titles={['隐私政策', '隱私政策', 'Privacy']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 'var(--sp-2)' }}>
          {s('最后更新', '最後更新', 'Updated')}: 2026-04-24
        </p>
        <div className="glass-card" style={{ padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', background: 'var(--gold-pale)', borderLeft: '3px solid var(--gold)' }}>
          <p style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)', letterSpacing: '.5px', lineHeight: 1.6 }}>
            ⚠️ {s(
              '本文档为上线前占位模板。正式法务文本由项目律师审定后替换，本文条款不具法律效力。',
              '本文件為上線前佔位模板。正式法務文本由專案律師審定後替換，本文條款不具法律效力。',
              'Placeholder draft. Official legal text will be reviewed by counsel before launch.',
            )}
          </p>
        </div>

        {SECTIONS.map((sec, i) => (
          <section key={i} style={{ marginBottom: 'var(--sp-5)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-2)' }}>
              {s(sec.title[0], sec.title[1], sec.title[2])}
            </h2>
            <p style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: '.5px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {s(sec.body[0], sec.body[1], sec.body[2])}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
