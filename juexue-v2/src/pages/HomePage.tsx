// HomePage 占位（Phase 4 替换为完整实现）
//   验证 Phase 1 仅需：路由可达 + tab 切换无进度条 + 样式 token 生效
export default function HomePage() {
  return (
    <div style={{ padding: 'var(--sp-5)' }}>
      <h1 className="t-h1" style={{ marginBottom: 'var(--sp-4)' }}>
        <span className="sc">首页</span>
        <span className="tc">首頁</span>
        <span className="en">Home</span>
      </h1>
      <div className="glass-card" style={{ padding: 'var(--sp-5)' }}>
        <p className="t-body" style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
          <span className="sc">这是觉学 v2 的占位首页 · 切到其他 tab 应该没有任何浏览器进度条</span>
          <span className="tc">這是覺學 v2 的佔位首頁 · 切到其他 tab 應該沒有任何瀏覽器進度條</span>
          <span className="en">Placeholder for Juexue v2 · switching tabs should show no browser progress bar</span>
        </p>
      </div>
    </div>
  );
}
