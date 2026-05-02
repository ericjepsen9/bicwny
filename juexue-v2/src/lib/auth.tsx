// 觉学 v2 · 认证 hook + Provider
// 对应老版 prototypes/shared/require-auth.js 的逻辑 · 但 React 化
//
// 提供：
//   useAuth() · 当前用户 + 操作（login/register/logout/refreshUser）
//   <AuthProvider> · 应用最外层 · boot 时调 GET /api/auth/me 拉用户
//   loading 期间不渲染 children · 由 RequireAuth 决定路由跳转
//
// 业务约定：
//   user.role: 'admin' | 'coach' | 'student'
//   user.hasOnboarded: 是否完成 onboarding
//   user.emailVerifiedAt: 邮箱是否已验证（AU3）
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from './api';
import { clearTokens, getAccess, setTokens, whenReady } from './tokenStore';

export interface AuthUser {
  id: string;
  email: string | null;
  emailVerifiedAt: string | null;
  role: 'admin' | 'coach' | 'student';
  isActive: boolean;
  dharmaName: string | null;
  avatar: string | null;
  timezone: string;
  locale: string;
  hasOnboarded: boolean;
  contentCohort: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  /** 'loading'=正在 hydrate · 'authed'=登录 · 'guest'=未登录 */
  status: 'loading' | 'authed' | 'guest';
  refreshUser: () => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    dharmaName?: string;
    captchaToken?: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

interface AuthResp {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthCtx['status']>('loading');

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.get<AuthUser>('/api/auth/me');
      setUser(u);
      setStatus('authed');
    } catch (e) {
      // 401 / 网络都视为未登录
      const status = (e as ApiError).status;
      if (status === 401 || status === 0 || status === 403) {
        setUser(null);
        setStatus('guest');
      } else {
        // 5xx 不清登录态 · 让用户看到错误
        setStatus('guest');
      }
    }
  }, []);

  // boot · 等 token hydrate 完再决定
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await whenReady();
      if (cancelled) return;
      if (!getAccess()) {
        setStatus('guest');
        return;
      }
      await refreshUser();
    })();
    return () => { cancelled = true; };
  }, [refreshUser]);

  const login = useCallback<AuthCtx['login']>(async (input) => {
    const r = await api.post<AuthResp>('/api/auth/login', input, { noAuth: true });
    await setTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    setUser(r.user);
    setStatus('authed');
    return r.user;
  }, []);

  const register = useCallback<AuthCtx['register']>(async (input) => {
    const r = await api.post<AuthResp>('/api/auth/register', input, { noAuth: true });
    await setTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    setUser(r.user);
    setStatus('authed');
    return r.user;
  }, []);

  const logout = useCallback<AuthCtx['logout']>(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // 服务端拒绝也无所谓 · 前端清 token 就行
    }
    await clearTokens();
    setUser(null);
    setStatus('guest');
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, status, refreshUser, login, register, logout }),
    [user, status, refreshUser, login, register, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
