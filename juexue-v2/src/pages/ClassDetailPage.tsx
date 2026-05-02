// ClassDetailPage · /class/:id
//   班级信息 · 成员列表 · 加入码 · 退出班级
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { useClassDetail } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ClassDetailPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const cid = id || '';
  const nav = useNavigate();
  const qc = useQueryClient();

  const detail = useClassDetail(cid);

  const leave = useMutation({
    mutationFn: () => api.post(`/api/classes/${encodeURIComponent(cid)}/leave`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/my/classes'] });
      toast.ok(s('已退出班级', '已退出班級', 'Left class'));
      nav('/profile', { replace: true });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  if (detail.isLoading) {
    return (
      <div>
        <TopNav titles={['我的班级', '我的班級', 'My Class']} />
        <div style={{ padding: 'var(--sp-5)' }}>
          <Skeleton.Title style={{ marginBottom: 12 }} />
          <Skeleton.Card />
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div>
        <TopNav titles={['我的班级', '我的班級', 'My Class']} />
        <p style={{ color: 'var(--crimson)', textAlign: 'center', padding: 'var(--sp-6)' }}>
          {detail.isError ? (detail.error as ApiError).message : s('班级不存在', '班級不存在', 'Class not found')}
        </p>
      </div>
    );
  }

  const c = detail.data;
  const coachCount = c.members.filter((m) => m.role === 'coach').length;
  const studentCount = c.members.length - coachCount;

  return (
    <div>
      <TopNav titles={['我的班级', '我的班級', 'My Class']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-2)' }}>{c.coverEmoji || '📚'}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 3, marginBottom: 4 }}>
            {c.name}
          </h1>
          {c.course && (
            <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5 }}>
              {c.course.coverEmoji} {c.course.title}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-5)', marginTop: 'var(--sp-4)' }}>
            <Stat n={coachCount} label={s('辅导员', '輔導員', 'Coach')} />
            <Stat n={studentCount} label={s('学员', '學員', 'Students')} />
          </div>
          {c.joinCode && (
            <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--saffron-pale)', borderRadius: 'var(--r-md)' }}>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginBottom: 4 }}>
                {s('加入码', '加入碼', 'Join code')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--saffron-dark)', letterSpacing: 4 }}>
                {c.joinCode}
              </div>
            </div>
          )}
        </div>

        <h2 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
          {s('成员', '成員', 'Members')}
        </h2>
        <div className="group" style={{ marginBottom: 'var(--sp-5)' }}>
          {c.members.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.875rem',
              }}>
                {m.user.dharmaName.slice(0, 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
                  {m.user.dharmaName}
                </div>
              </div>
              {m.role === 'coach' && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--gold-pale)',
                  color: 'var(--gold-dark)',
                  font: 'var(--text-caption)',
                  fontWeight: 700,
                  letterSpacing: 1,
                }}>
                  {s('辅导员', '輔導員', 'Coach')}
                </span>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!confirm(s('确定退出班级？', '確定退出班級？', 'Leave class?'))) return;
            leave.mutate();
          }}
          disabled={leave.isPending}
          className="btn btn-pill btn-full"
          style={{
            padding: 12,
            background: 'transparent',
            color: 'var(--crimson)',
            border: '1px solid rgba(192,57,43,.3)',
            justifyContent: 'center',
          }}
        >
          {leave.isPending ? s('处理中…', '處理中…', 'Processing…') : s('退出班级', '退出班級', 'Leave class')}
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)' }}>{n}</div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}
