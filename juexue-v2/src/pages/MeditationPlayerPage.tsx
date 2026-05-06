// MeditationPlayerPage · /meditation/:id
//   学员观修播放页 · 视频 + 进度上报 + 手动完成兜底
//
//   生命周期：
//     1. mount 拉详情 · 决定 session：
//        · 已有未完成 latestSession → 复用 + 跳到 videoWatchedSec
//        · 已完成 / 不存在 → POST 新 session
//     2. 视频元数据加载后恢复 currentTime
//     3. 每 10s（仅 playing）PATCH session 上报进度
//     4. 后端在 ≥ 80% 时自动 isCompleted = true · 返回中检测并提示
//     5. 「完成观修」按钮兜底（不依赖 80%）

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useMeditationDetail } from '@/lib/queries';
import { toast } from '@/lib/toast';

const PROGRESS_INTERVAL_MS = 10_000;

export default function MeditationPlayerPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const meditationId = id || '';

  const detail = useMeditationDetail(meditationId || null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const initRef = useRef(false);              // 防 effect 重复 init
  const lastReportedSec = useRef(0);

  const meditation = detail.data?.meditation;
  const latestSession = detail.data?.latestSession;

  // ── 1. 初始化 session ────────────────────────────────
  useEffect(() => {
    if (!detail.data || initRef.current) return;
    initRef.current = true;

    const latest = detail.data.latestSession;
    if (latest && !latest.isCompleted) {
      setSessionId(latest.id);
      lastReportedSec.current = latest.videoWatchedSec;
    } else if (latest?.isCompleted) {
      setIsCompleted(true);
      // 已完成的可以再看 · 但不创新 session（直到用户点重新观修按钮）
      // 这里若想支持重看 → 创新 session 即可 · v1 简化：只回看
      setSessionId(latest.id);
    } else {
      // 新建 session
      api.post<{ id: string }>(`/api/meditations/${encodeURIComponent(meditationId)}/sessions`)
        .then((r) => setSessionId(r.id))
        .catch((e: ApiError) => toast.error(e.message));
    }
  }, [detail.data, meditationId]);

  // ── 2. 视频元数据加载后恢复 currentTime ─────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => {
      const resumeSec = latestSession?.videoWatchedSec ?? 0;
      if (resumeSec > 0 && resumeSec < video.duration - 5) {
        video.currentTime = resumeSec;
      }
    };
    video.addEventListener('loadedmetadata', handler);
    return () => video.removeEventListener('loadedmetadata', handler);
  }, [latestSession?.videoWatchedSec, meditation?.videoUrl]);

  // ── 3. 每 10s 上报进度 ──────────────────────────────
  async function reportProgress() {
    const video = videoRef.current;
    if (!video || !sessionId) return;
    const sec = Math.floor(video.currentTime);
    // 单调不递减 · 避免后退 / 重复请求
    if (sec <= lastReportedSec.current) return;
    lastReportedSec.current = sec;
    try {
      const r = await api.patch<{ isCompleted: boolean; videoWatchedSec: number }>(
        `/api/meditations/${encodeURIComponent(meditationId)}/sessions/${encodeURIComponent(sessionId)}`,
        { videoWatchedSec: sec },
      );
      if (r.isCompleted && !isCompleted) {
        setIsCompleted(true);
        toast.ok(s('🎉 观修已完成 · 功德圆满', '🎉 觀修已完成', '🎉 Meditation completed'));
        qc.invalidateQueries({ queryKey: ['/api/meditations', meditationId] });
      }
    } catch (e) {
      // 静默 · 下次重试
      console.warn('progress report failed', e);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      void reportProgress();
    }, PROGRESS_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // 卸载前再 patch 一次（兜底）
      void reportProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── 4. 手动完成 ────────────────────────────────────
  const manualComplete = useMutation({
    mutationFn: () => api.post(`/api/meditations/${encodeURIComponent(meditationId)}/complete`),
    onSuccess: () => {
      setIsCompleted(true);
      toast.ok(s('已标记完成', '已標記完成', 'Marked complete'));
      qc.invalidateQueries({ queryKey: ['/api/meditations', meditationId] });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  // ── 渲染 ───────────────────────────────────────────
  if (detail.isLoading) {
    return (
      <div style={{ padding: 'var(--sp-5)' }}>
        <Skeleton.Card />
      </div>
    );
  }
  if (!meditation) {
    return (
      <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
        <p>{(detail.error as ApiError | undefined)?.message ?? s('观修不存在', '觀修不存在', 'Not found')}</p>
        <button type="button" onClick={() => nav(-1)} className="btn btn-pill" style={{ marginTop: 'var(--sp-3)', padding: '8px 16px' }}>
          {s('返回', '返回', 'Back')}
        </button>
      </div>
    );
  }

  const durationLabel = useMemoFmt(meditation.videoDurationSec);

  return (
    <div style={{ padding: 'var(--sp-3)', paddingBottom: 'var(--sp-5)' }}>
      {/* 顶部 · 返回 + 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <button
          type="button"
          onClick={() => nav(-1)}
          aria-label={s('返回', '返回', 'Back')}
          style={{ width: 36, height: 36, background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 22 }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
            🧘 {s('观修', '觀修', 'Meditation')}
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 1.5, lineHeight: 1.4, margin: '2px 0 0' }}>
            {meditation.title}
          </h1>
        </div>
      </div>

      {/* 视频 */}
      {meditation.videoUrl ? (
        <div style={{ position: 'relative', borderRadius: 'var(--r)', overflow: 'hidden', background: '#000' }}>
          <video
            ref={videoRef}
            src={meditation.videoUrl}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', maxHeight: '60vh', display: 'block', background: '#000' }}
          />
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('（暂无视频）', '（暫無視頻）', '(no video)')}
        </div>
      )}

      {/* 元信息 · 时长 + 讲者 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)', font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
        <span>🎥 {durationLabel}</span>
        {meditation.authorName && <span>· {meditation.authorName}</span>}
        {isCompleted && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 8px', borderRadius: 'var(--r-pill)',
            background: 'rgba(125,154,108,.15)', color: 'var(--sage-dark)',
            fontWeight: 700, letterSpacing: 1,
          }}>
            ✓ {s('已完成', '已完成', 'Completed')}
          </span>
        )}
      </div>

      {/* 描述 */}
      {meditation.description && (
        <p style={{ marginTop: 'var(--sp-3)', font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: 1, whiteSpace: 'pre-wrap' }}>
          {meditation.description}
        </p>
      )}

      {/* PDF 入口 */}
      {meditation.slidesPdfUrl && (
        <a
          href={meditation.slidesPdfUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-pill"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 'var(--sp-4)', padding: '10px 16px',
            background: 'var(--glass-thick)', color: 'var(--ink-2)', border: '1px solid var(--glass-border)',
            textDecoration: 'none', letterSpacing: 1,
          }}
        >
          📄 {s('查看讲义 PDF', '查看講義 PDF', 'View slides (PDF)')}
        </a>
      )}

      {/* 手动完成按钮 */}
      {!isCompleted && (
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmAsync({
              title: s('确认手动标记完成？', '確認手動標記完成？', 'Confirm manual complete?'),
              body: s('系统会在视频看到 80% 时自动完成。手动完成不要求看完。', '系統會在 80% 時自動完成', 'Auto-completes at 80% playback. Manual marks now.'),
            });
            if (!ok) return;
            manualComplete.mutate();
          }}
          disabled={manualComplete.isPending}
          className="btn btn-primary btn-pill"
          style={{ width: '100%', marginTop: 'var(--sp-4)', padding: 12, justifyContent: 'center', letterSpacing: 1 }}
        >
          {manualComplete.isPending ? '…' : s('完成观修', '完成觀修', 'Complete')}
        </button>
      )}

      {/* 完成提示 */}
      {isCompleted && (
        <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--saffron-pale)', borderRadius: 'var(--r)', color: 'var(--ink-2)', font: 'var(--text-caption)', letterSpacing: 1 }}>
          ✓ {s('本课观修已完成 · 共完成', '本課觀修已完成 · 共完成', 'This meditation completed · total ')} {detail.data?.totalCompletions ?? 1} {s('次', '次', 'time(s)')}
        </div>
      )}
    </div>
  );
}

/** 时长格式化 mm:ss */
function useMemoFmt(sec: number): string {
  return useMemo(() => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [sec]);
}
