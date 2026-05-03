// 觉学 v2 · i18n · sc / tc / en 三语
// 对应老版 prototypes/shared/{lang.js, i18n.js}
//
// React 化重点：
//   - useLang() / useT() hook · 自动 re-render 当切语言时
//   - <I18nProvider> 在最外层 · 提供 lang state + setLang
//   - 兼容旧式 <span class="sc"/.tc/.en>：同时设 documentElement.dataset.lang
//     让现有 CSS 选择器（[data-lang="en"] .en/.sc/.tc）继续工作 · 保留 CSS 复用
//   - 字典 key-based · 支持 {0} {1} 占位
//
// 存储：localStorage['jx-lang'] = 'sc' | 'tc' | 'en'  · 默认 'sc'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'sc' | 'tc' | 'en';
const VALID: Record<string, true> = { sc: true, tc: true, en: true };
const STORAGE_KEY = 'jx-lang';

// ── 词典 ──
// 三元组：[sc, tc, en]
type Entry = readonly [string, string, string];
const DICT: Record<string, Entry> = {
  // 通用
  'common.confirm':    ['确定', '確定', 'Confirm'],
  'common.cancel':     ['取消', '取消', 'Cancel'],
  'common.save':       ['保存', '保存', 'Save'],
  'common.delete':     ['删除', '刪除', 'Delete'],
  'common.edit':       ['编辑', '編輯', 'Edit'],
  'common.retry':      ['重试', '重試', 'Retry'],
  'common.refresh':    ['刷新', '刷新', 'Refresh'],
  'common.loading':    ['加载中…', '載入中…', 'Loading…'],
  'common.empty':      ['暂无数据', '暫無資料', 'No data'],
  'common.error':      ['出错了', '出錯了', 'Something went wrong'],
  'common.success':    ['成功', '成功', 'Success'],
  'common.networkErr': ['网络异常', '網絡異常', 'Network error'],
  'common.back':       ['返回', '返回', 'Back'],
  'common.close':      ['关闭', '關閉', 'Close'],
  'common.search':     ['搜索', '搜尋', 'Search'],

  // Tab
  'tab.home':    ['首页', '首頁', 'Home'],
  'tab.courses': ['法本', '法本', 'Texts'],
  'tab.quiz':    ['答题', '答題', 'Quiz'],
  'tab.profile': ['我的', '我的', 'Profile'],
};

function readLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID[v as Lang] ? (v as Lang) : 'sc';
  } catch {
    return 'sc';
  }
}

function applyDocLang(lang: Lang) {
  document.documentElement.setAttribute('data-lang', lang);
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, ...args: unknown[]) => string;
  /** 三参数文本选择器 · 兼容老 JX.sc(sc, tc, en?) · 不写 en 自动 fallback sc */
  s: (sc: string, tc: string, en?: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readLang());

  // 一上来同步 documentElement · 让 CSS 选择器立刻生效
  useEffect(() => {
    applyDocLang(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  }, [lang]);

  // 跨标签页同步
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue;
      if (next && VALID[next]) setLangState(next as Lang);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLang = useCallback((l: Lang) => {
    if (VALID[l]) setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, ...args: unknown[]) => {
      const row = DICT[key];
      if (!row) return key;
      const idx = lang === 'tc' ? 1 : lang === 'en' ? 2 : 0;
      let s = row[idx] ?? row[0];
      if (args.length === 0) return s;
      return s.replace(/\{(\d+)\}/g, (_, n: string) => {
        const v = args[+n];
        return v == null ? '' : String(v);
      });
    },
    [lang],
  );

  const s = useCallback(
    (sc: string, tc: string, en?: string) => {
      if (lang === 'tc') return tc;
      if (lang === 'en') return en ?? sc;
      return sc;
    },
    [lang],
  );

  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t, s }), [lang, setLang, t, s]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be inside <I18nProvider>');
  return ctx;
}

/** 注册自定义 key（业务模块可在 init 时调用） */
export function registerI18n(map: Record<string, Entry>) {
  Object.assign(DICT, map);
}
