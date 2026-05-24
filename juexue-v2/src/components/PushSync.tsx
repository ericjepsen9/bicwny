// 推送同步 · 顶层挂载（审计 N3 / N5）· 无 UI
//   N3：登录后把当前浏览器订阅幂等同步到后端（覆盖订阅轮换后 endpoint 变更的情况）
//   N5：消费 push banner 点击带来的 ?nr=eventKind:eventId:tier 令牌 → 标该通知已读 → 剥除 query
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { resyncSubscription } from '@/lib/push';

export default function PushSync() {
  const { status } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const resyncedRef = useRef(false);

  // SW 收到 push → postMessage 通知此处即时刷新红点/列表（审计 · 否则红点陈旧 ≤5min）
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'jx-notif') {
        qc.invalidateQueries({ queryKey: ['/api/notifications'] });
        qc.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [qc]);

  // N3 · 登录后同步推送订阅
  useEffect(() => {
    if (status === 'authed') {
      if (!resyncedRef.current) {
        resyncedRef.current = true;
        resyncSubscription().catch(() => {});
      }
    } else {
      resyncedRef.current = false;
    }
  }, [status]);

  // N5 · 消费 nr 令牌（banner 点击标已读）
  useEffect(() => {
    if (status !== 'authed') return;
    const params = new URLSearchParams(loc.search);
    const nr = params.get('nr');
    if (!nr) return;
    // nr = eventKind:eventId:tier · eventId 可能含冒号 → 取首段为 kind、末段为 tier、中间为 id
    const parts = nr.split(':');
    if (parts.length >= 3) {
      const eventKind = parts[0];
      const tier = parts[parts.length - 1];
      const eventId = parts.slice(1, -1).join(':');
      api.post('/api/notifications/read-by-event', { eventKind, eventId, tier })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['/api/notifications'] });
          qc.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        })
        .catch(() => {});
    }
    // 剥除 nr · 保留其余 query · replace 不留历史
    params.delete('nr');
    const qs = params.toString();
    nav({ pathname: loc.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
  }, [loc.search, loc.pathname, status, nav, qc]);

  return null;
}
