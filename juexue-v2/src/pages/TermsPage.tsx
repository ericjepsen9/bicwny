// TermsPage · /terms
//   服务条款（占位草稿 · 上线前由律师审定）
import TopNav from '@/components/TopNav';
import { useLang } from '@/lib/i18n';

interface Section {
  title: [string, string, string];
  body: [string, string, string] | string[];
}

const SECTIONS: Section[] = [
  {
    title: ['一、服务说明', '一、服務說明', '1. About'],
    body: [
      '觉学（以下简称"本服务"）是一款面向佛教班级共修的学习 App。您在注册或使用本服务前，应仔细阅读并同意本条款。',
      '覺學（以下簡稱「本服務」）是一款面向佛教班級共修的學習 App。您在註冊或使用本服務前，應仔細閱讀並同意本條款。',
      'Juexue (the "Service") is a Buddhist study app for cohort learning. Please read these terms carefully before signing up.',
    ],
  },
  {
    title: ['二、用户责任', '二、用戶責任', '2. Responsibilities'],
    body: [
      '· 提供真实有效的注册信息，并妥善保管账号密码\n· 不得从事违反法律法规、侵害他人权益、或扰乱班级秩序的活动\n· 不得恶意攻击、逆向、爬取本服务',
      '· 提供真實有效的註冊資訊，並妥善保管賬號密碼\n· 不得從事違反法律法規、侵害他人權益、或擾亂班級秩序的活動\n· 不得惡意攻擊、逆向、爬取本服務',
      '· Provide accurate registration info and protect your password\n· Do not engage in unlawful activity or disrupt class\n· No malicious attacks, reverse engineering, or scraping',
    ],
  },
  {
    title: ['三、内容版权', '三、內容版權', '3. Content Rights'],
    body: [
      '· 法本原文及讲记版权归原作者与传承机构所有，本服务仅作为学习工具\n· 班级题库由辅导员创建或平台审核，版权归本服务与相应创建者共有\n· 您上传的笔记、答题内容版权归您所有，授予本服务在必要范围内使用的权利',
      '· 法本原文及講記版權歸原作者與傳承機構所有，本服務僅作為學習工具\n· 班級題庫由輔導員創建或平台審核，版權歸本服務與相應創建者共有\n· 您上傳的筆記、答題內容版權歸您所有，授予本服務在必要範圍內使用的權利',
      '· Source texts and commentary remain with their authors and lineages; we are a study tool only\n· Question banks are jointly held by us and the authoring coach\n· Your notes and answers remain yours; you grant us limited rights to use them as needed',
    ],
  },
  {
    title: ['四、账号与班级', '四、賬號與班級', '4. Accounts & Classes'],
    body: [
      '· 班级由辅导员建立并维护，您可通过加入码加入班级\n· 辅导员可查看所带班级学员的答题与学习进度（仅用于教学）\n· 平台可因违反本条款或法律法规暂停或注销您的账号',
      '· 班級由輔導員建立並維護，您可通過加入碼加入班級\n· 輔導員可查看所帶班級學員的答題與學習進度（僅用於教學）\n· 平台可因違反本條款或法律法規暫停或註銷您的賬號',
      '· Coaches create and maintain classes; join via invite code\n· Coaches can see your answers and progress within the class (teaching purposes only)\n· We may suspend or terminate accounts for violations',
    ],
  },
  {
    title: ['五、免责声明', '五、免責聲明', '5. Disclaimer'],
    body: [
      '本服务力求稳定可靠，但因不可抗力、第三方服务中断（网络、云平台、LLM 供应商等）造成的损失，本服务不承担责任。学习成效因人而异，本服务不做保证。',
      '本服務力求穩定可靠，但因不可抗力、第三方服務中斷（網路、雲平台、LLM 供應商等）造成的損失，本服務不承擔責任。學習成效因人而異，本服務不做保證。',
      'We strive for reliability but are not liable for losses due to force majeure or third-party service outages. Learning outcomes vary; we make no guarantees.',
    ],
  },
  {
    title: ['六、条款变更', '六、條款變更', '6. Changes'],
    body: [
      '本条款可能因法规或产品演进而更新，更新后将通过站内通知告知。继续使用本服务即视为接受新条款。',
      '本條款可能因法規或產品演進而更新，更新後將通過站內通知告知。繼續使用本服務即視為接受新條款。',
      'These terms may change over time; we will notify in-app. Continued use implies acceptance.',
    ],
  },
];

export default function TermsPage() {
  const { s } = useLang();
  return (
    <div>
      <TopNav titles={['服务条款', '服務條款', 'Terms']} />

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
              {s(sec.body[0]!, sec.body[1]!, sec.body[2]!)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
