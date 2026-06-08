// admin 画报管理 · /admin/posters
//   - 切年 · 12 月格子
//   - 每格：缩略图 + 月份 + 上传/替换/删除
//   - 上传 multipart → 拿到 URL → PUT upsert
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError, uploadWithProgress } from '@/lib/api';
import { toast } from '@/lib/toast';

interface Poster {
  id: string;
  year: number;
  month: number;
  imageUrl: string;
  caption: string | null;
  updatedAt: string;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AdminPostersPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ['/api/admin/posters', year],
    queryFn: ({ signal }) => api.get<Poster[]>(`/api/admin/posters/${year}`, { signal }),
  });

  const byMonth = new Map<number, Poster>();
  (data.data ?? []).forEach((p) => byMonth.set(p.month, p));

  return (
    <div>
      <TopNav titles={['首页画报', '首頁畫報', 'Posters']} backTo="/admin" />
      <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={() => setYear(year - 1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>‹</button>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.15rem', letterSpacing: 3, margin: 0 }}>
          {year}
        </h2>
        <button type="button" onClick={() => setYear(year + 1)} className="btn btn-pill" style={{ padding: '6px 12px' }}>›</button>
      </div>

      <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', textAlign: 'center', margin: 0 }}>
        每月一张壁纸 · 学员首页全屏背景 · 推荐 2:3 纵向 · jpg/png/webp ≤ 8MB
      </p>

      {data.isLoading ? <Skeleton.List /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-3)' }}>
          {MONTHS.map((m) => (
            <PosterCell key={m} year={year} month={m} poster={byMonth.get(m)} onChange={() => qc.invalidateQueries({ queryKey: ['/api/admin/posters', year] })} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function PosterCell({ year, month, poster, onChange }: { year: number; month: number; poster?: Poster; onChange: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(poster?.caption ?? '');
  const [uploading, setUploading] = useState(false);

  const remove = useMutation({
    mutationFn: () => api.del(`/api/admin/posters/${year}/${month}`),
    onSuccess: () => { toast.ok('已删除'); onChange(); },
    onError: (e) => toast.error('删除失败: ' + (e as ApiError).message),
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const res = await uploadWithProgress<{ url: string }>('/api/admin/posters/upload-image', file);
      await api.put(`/api/admin/posters/${year}/${month}`, { imageUrl: res.url, caption: caption.trim() || null });
      toast.ok('✓ 已上传');
      onChange();
    } catch (e) {
      toast.error('失败: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const updateCaption = useMutation({
    mutationFn: () => api.put(`/api/admin/posters/${year}/${month}`, { imageUrl: poster!.imageUrl, caption: caption.trim() || null }),
    onSuccess: () => { toast.ok('✓ 已保存副标'); onChange(); },
  });

  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.1rem' }}>{month} 月</span>
        {poster && <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', marginLeft: 'auto' }}>✓</span>}
      </div>

      {/* 缩略图 / 占位 */}
      <div
        style={{
          aspectRatio: '2 / 3',
          background: poster ? `url(${poster.imageUrl}) center/cover` : 'var(--surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--r-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-4)',
          fontSize: '2rem',
        }}
      >
        {!poster && '+'}
      </div>

      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="副标(可选,如「般若」)"
        maxLength={80}
        style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-light)', font: 'var(--text-caption)' }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn btn-pill"
          style={{ flex: 1, padding: '6px 10px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)' }}
        >
          {uploading ? '上传中…' : poster ? '替换' : '上传'}
        </button>
        {poster && (
          <>
            <button
              type="button"
              onClick={() => updateCaption.mutate()}
              disabled={updateCaption.isPending}
              className="btn btn-pill"
              style={{ padding: '6px 10px', font: 'var(--text-caption)', background: 'var(--surface)', border: '1px solid var(--border-light)' }}
            >
              💾
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await confirmAsync({ title: `删除 ${year}/${month} 画报？`, danger: true, okLabel: '删除' })) remove.mutate();
              }}
              disabled={remove.isPending}
              className="btn btn-pill"
              style={{ padding: '6px 10px', font: 'var(--text-caption)', background: 'transparent', border: '1px solid var(--crimson)', color: 'var(--crimson)' }}
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
}
