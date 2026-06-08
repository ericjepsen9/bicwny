// ClassNewPage · /admin/classes/new · /coach/classes/new（决策 5 · 独立页）
//   新建班级 · 创建成功后回列表
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Field from '@/components/Field';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useCourses } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ClassNewPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const courses = useCourses();
  const { pathname } = useLocation();
  const base = pathname.startsWith('/admin') ? '/admin/classes' : '/coach/classes';

  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/classes', {
      name: name.trim(),
      courseId,
      coverEmoji: emoji.trim() || undefined,
      description: desc.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/classes'] });
      // coach 建班后也要刷新 coach 班级列表（useCoachClasses · 仪表盘 / 日历发公告入口）
      qc.invalidateQueries({ queryKey: ['/api/coach/classes'] });
      toast.ok(s('已创建', '已創建', 'Created'));
      nav(base);
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('新建班级', '新建班級', 'New class')}</h1>
          <p className="page-sub">{s('指定主修闻思 + 班级元数据', '指定主修聞思 + 班級元資料', 'Pick course + class meta')}</p>
        </div>
        <div className="top-actions">
          <Link to={base} className="btn btn-pill" style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            {s('返回', '返回', 'Back')}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErr('');
            if (!courseId) {
              setErr(s('请选闻思', '請選聞思', 'Pick a course'));
              return;
            }
            create.mutate();
          }}
          className="glass-card-thick"
          style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          <Field label={s('班级名', '班級名', 'Name')} value={name} onChange={setName} required maxLength={64} />
          <div>
            <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>
              {s('闻思', '聞思', 'Course')}
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              disabled={courses.isLoading}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--ink)', font: 'var(--text-body)', outline: 'none', opacity: courses.isLoading ? 0.6 : 1 }}
            >
              <option value="">
                {courses.isLoading
                  ? s('加载中…', '載入中…', 'Loading…')
                  : s('— 请选 —', '— 請選 —', '— pick —')}
              </option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.coverEmoji} {c.title}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: 'var(--sp-3)' }}>
            <Field label={s('图标', '圖示', 'Emoji')} value={emoji} onChange={setEmoji} maxLength={2} />
            <Field label={s('简介（可选）', '簡介（可選）', 'Description (opt)')} value={desc} onChange={setDesc} />
          </div>
          {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Link to={base} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center', textDecoration: 'none', textAlign: 'center' }}>
              {s('取消', '取消', 'Cancel')}
            </Link>
            <button type="submit" disabled={create.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
              {create.isPending ? '…' : s('创建', '創建', 'Create')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
