// ClassDetailPage · /class/:id
//   班级 hero · 加入码 · 主修法本卡 · 辅导员独立卡 · 学员列表 · 班级公告 placeholder · 退出班级
import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useClassDetail, useClasses } from '@/lib/queries';
import { toast } from '@/lib/toast';

export default function ClassDetailPage() {
  const { s } = useLang();
  const { id } = useParams<{ id: string }>();
  const cid = id || '';
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const detail = useClassDetail(cid);
  const myClasses = useClasses();

  // 当前用户在该班的 membership · 取 joinedAt 算"已加入 N 天"
  const myMembership = useMemo(
    () => (myClasses.data ?? []).find((m) => m.classId === cid),
    [myClasses.data, cid],
  );
  const joinedDays = useMemo(() => {
    if (!myMembership?.joinedAt) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(myMembership.joinedAt).getTime()) / 86400000));
  }, [myMembership]);

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
  const coaches = c.members.filter((m) => m.role === 'coach');
  const students = c.members.filter((m) => m.role === 'student');
  const myRole = user ? c.members.find((m) => m.user.id === user.id)?.role : undefined;

  return (
    <div>
      <TopNav titles={['我的班级', '我的班級', 'My Class']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)' }}>
        {/* Hero */}
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--saffron-pale)',
              color: 'var(--saffron-dark)',
              font: 'var(--text-caption)',
              fontWeight: 700,
              letterSpacing: 2,
              marginBottom: 'var(--sp-3)',
            }}
          >
            {s('共修班', '共修班', 'Class')}
          </span>
          <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-2)' }}>{c.coverEmoji || '📚'}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 3, marginBottom: 4 }}>
            {c.name}
          </h1>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)', alignItems: 'baseline' }}>
            <Stat n={c.members.length} label={s('成员', '成員', 'Members')} />
            <Stat n={joinedDays} label={s('加入 / 天', '加入 / 天', 'Days')} fallback="—" />
            <StatText
              text={c.joinCode || '—'}
              label={s('邀请码', '邀請碼', 'Code')}
              mono
            />
          </div>
        </div>

        {/* 主修法本卡 */}
        {c.course && (
          <Link
            to={`/scripture-detail?slug=${encodeURIComponent(c.course.slug)}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-4)',
              background: 'var(--glass-thick)',
              border: '1px solid var(--glass-border)',
              borderLeft: '3px solid var(--gold-dark)',
              borderRadius: 'var(--r-lg)',
              marginBottom: 'var(--sp-4)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--r-lg)',
                flexShrink: 0,
                background: 'var(--gold-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              {c.course.coverEmoji || '🪷'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ font: 'var(--text-caption)', color: 'var(--gold-dark)', letterSpacing: 1.5, marginBottom: 2 }}>
                📍 {s('主修法本', '主修法本', 'Main text')}
              </p>
              <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '1rem', letterSpacing: 2 }}>
                {c.course.title}
              </p>
            </div>
            <svg width="16" height="16" fill="none" stroke="var(--ink-4)" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}

        {/* 辅导员独立卡 */}
        {coaches.length > 0 && (
          <>
            <SectionHead label={s('辅导员', '輔導員', 'Coaches')} />
            <div className="group" style={{ marginBottom: 'var(--sp-4)' }}>
              {coaches.map((m) => (
                <MemberRow
                  key={m.id}
                  initial={m.user.dharmaName.slice(0, 1) || '·'}
                  name={m.user.dharmaName || '—'}
                  role="coach"
                  isMe={m.user.id === user?.id}
                  s={s}
                />
              ))}
            </div>
          </>
        )}

        {/* 学员列表 */}
        <SectionHead label={s('学员 · ' + students.length, '學員 · ' + students.length, `Students · ${students.length}`)} />
        <div className="group" style={{ marginBottom: 'var(--sp-4)' }}>
          {students.length > 0 ? (
            students.map((m) => (
              <MemberRow
                key={m.id}
                initial={m.user.dharmaName.slice(0, 1) || '·'}
                name={m.user.dharmaName || '—'}
                role="student"
                isMe={m.user.id === user?.id}
                s={s}
              />
            ))
          ) : (
            <div style={{ padding: 'var(--sp-4)', textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
              {s('暂无学员', '暫無學員', 'No students yet')}
            </div>
          )}
        </div>

        {/* 班级公告 placeholder · 后端尚未实现公告字段 · 给空态 */}
        <SectionHead label={s('班级公告', '班級公告', 'Announcements')} />
        <div
          className="glass-card"
          style={{
            padding: 'var(--sp-4)',
            background: 'var(--glass)',
            border: '1px solid var(--glass-border)',
            borderLeft: '3px solid var(--saffron-light)',
            borderRadius: 'var(--r-lg)',
            marginBottom: 'var(--sp-5)',
            textAlign: 'center',
          }}
        >
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1.5, lineHeight: 1.6 }}>
            {myRole === 'coach'
              ? s('班级公告功能即将开放', '班級公告功能即將開放', 'Announcements coming soon')
              : s('暂无公告 · 辅导员发布后将出现在此', '暫無公告 · 輔導員發佈後將出現在此', 'No announcements yet')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!confirm(s('确定退出班级？退出后学习数据保留。', '確定退出班級？退出後學習資料保留。', 'Leave class? Your study data will be kept.'))) return;
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

function Stat({ n, label, fallback }: { n: number | null; label: string; fallback?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)' }}>
        {n == null ? (fallback ?? '—') : n}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function StatText({ text, label, mono }: { text: string; label: string; mono?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: mono ? 'var(--font-mono, monospace)' : 'var(--font-serif)',
          fontWeight: 700,
          fontSize: '0.9375rem',
          letterSpacing: 2,
          color: 'var(--saffron-dark)',
        }}
      >
        {text}
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <h2
      style={{
        font: 'var(--text-caption)',
        color: 'var(--ink-3)',
        letterSpacing: 2,
        marginBottom: 'var(--sp-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
      {label}
    </h2>
  );
}

function MemberRow({
  initial, name, role, isMe, s,
}: {
  initial: string;
  name: string;
  role: 'coach' | 'student';
  isMe: boolean;
  s: (sc: string, tc: string, en?: string) => string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: role === 'coach'
            ? 'linear-gradient(135deg, var(--gold), var(--gold-dark))'
            : 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: '0.875rem',
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9375rem', color: 'var(--ink)', letterSpacing: 1.5 }}>
          {name}
          {isMe && (
            <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1, marginLeft: 6, fontWeight: 400 }}>
              ({s('我', '我', 'me')})
            </span>
          )}
        </div>
      </div>
      {role === 'coach' && (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--gold-pale)',
            color: 'var(--gold-dark)',
            font: 'var(--text-caption)',
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {s('辅导员', '輔導員', 'Coach')}
        </span>
      )}
    </div>
  );
}
