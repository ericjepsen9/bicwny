// SideNavSettings · admin/coach 桌面 shell 通用设置块
//   - 主题切换（auto/light/dark · 循环）
//   - 退出登录（confirm 防误触）
// 嵌在 side-nav 底部的「其他」区
import { useNavigate } from 'react-router-dom';
import { confirmAsync } from './ConfirmDialog';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';

export default function SideNavSettings() {
  const { s } = useLang();
  const { logout } = useAuth();
  const { mode, cycle } = useTheme();
  const nav = useNavigate();

  const themeLabel =
    mode === 'auto' ? s('主题：自动', '主題：自動', 'Theme: Auto')
    : mode === 'light' ? s('主题：浅色', '主題：淺色', 'Theme: Light')
    : s('主题：深色', '主題：深色', 'Theme: Dark');
  const themeIcon = mode === 'auto' ? '🌗' : mode === 'light' ? '☀️' : '🌙';

  async function handleLogout() {
    const ok = await confirmAsync({
      title: s('确定退出登录？', '確定退出登入？', 'Sign out?'),
      okLabel: s('退出', '退出', 'Sign out'),
      danger: true,
    });
    if (!ok) return;
    try {
      await logout();
      toast.ok(s('已退出', '已退出', 'Signed out'));
      nav('/auth', { replace: true });
    } catch {
      toast.error(s('退出失败', '退出失敗', 'Sign-out failed'));
    }
  }

  return (
    <>
      <button type="button" onClick={cycle} className="nav-item" style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>{themeIcon}</span>
        {themeLabel}
      </button>
      <button type="button" onClick={handleLogout} className="nav-item" style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--crimson)' }}>
        <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>↪</span>
        {s('退出登录', '退出登入', 'Sign out')}
      </button>
    </>
  );
}
