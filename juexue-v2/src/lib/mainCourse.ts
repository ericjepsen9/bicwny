// 用户当前主修法本偏好（首页"当前法本卡"显示哪本）
//   存储：localStorage['jx-main-course-id']
//   默认：用户已加入法本中的第一本（enrollments[0]）
//   切换入口：法本详情页 ⋯ 菜单的「设为主修法本」
//
// 跨标签页同步：用 storage 事件 + 通过监听 fire 简单 React state
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'jx-main-course-id';

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setMainCourseId(courseId: string | null): void {
  try {
    if (courseId) localStorage.setItem(STORAGE_KEY, courseId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  // 主动派发 storage event 让本页面其他 listener 也立即响应
  // （storage 事件原生只在跨标签页触发 · 同标签页要手动派发）
  try {
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: courseId }),
    );
  } catch { /* ignore */ }
}

export function useMainCourseId(): string | null {
  const [id, setId] = useState<string | null>(() => read());
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setId(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return id;
}
