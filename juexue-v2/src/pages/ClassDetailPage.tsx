// ClassDetailPage · /class/:id
//   班级 hero · 加入码 · 主修法本卡 · 辅导员独立卡 · 学员列表 · 班级公告 placeholder · 退出班级
import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import TibetanClassWeekStrip from '@/components/TibetanClassWeekStrip';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { useClassDetail, useClasses, usePracticeProjects, usePracticeTasks } from '@/lib/queries';
import { toast } from '@/lib/toast';
import { useQuery } from '@tanstack/react-query';

interface AnnouncementSummary {
  id: string;
  classId: string;
  authorId: string;
  title: string;
  body: string;
  imageUrls: string[] | null;
  pinnedAt: string | null;
  createdAt: string;
}

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

        <TibetanClassWeekStrip />

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

        {/* 班级观修排行入口卡 */}
        <Link
          to={`/class/${c.id}/meditations`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-4)',
            background: 'var(--saffron-pale)',
            border: '1px solid var(--saffron-light)',
            borderLeft: '3px solid var(--saffron)',
            borderRadius: 'var(--r-lg)',
            marginBottom: 'var(--sp-4)',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{
            width: 46, height: 46, borderRadius: 'var(--r-lg)', flexShrink: 0,
            background: 'var(--saffron)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
          }}>
            🧘
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ font: 'var(--text-caption)', color: 'var(--saffron-dark)', letterSpacing: 1.5, marginBottom: 2 }}>
              {s('观修排行', '觀修排行', 'Ranking')}
            </p>
            <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '1rem', letterSpacing: 2, margin: 0 }}>
              {s('班级观修榜', '班級觀修榜', 'Class meditation board')}
            </p>
          </div>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" style={{ color: 'var(--ink-3)' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        {/* 辅导员独立卡 */}
        {coaches.length > 0 && (
          <>
            <SectionHead label={s('辅导员', '輔導員', 'Coaches')} />
            <div className="menu-card" style={{ marginBottom: 'var(--sp-4)' }}>
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
        <div className="menu-card" style={{ marginBottom: 'var(--sp-4)' }}>
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

        {/* 班级修学任务（教师下达的 PracticeTask scope=class） */}
        <ClassPracticeTasksSection classId={cid} />

        {/* 本班专修咒种（class-scope PracticeProject） */}
        <ClassPracticeProjectsSection classId={cid} />

        {/* 班级排行入口 */}
        <SectionHead label={s('排行', '排行', 'Ranking')} />
        <div className="glass-card-thick" style={{ padding: 0, marginBottom: 'var(--sp-4)', overflow: 'hidden' }}>
          <Link to={`/class/${encodeURIComponent(cid)}/meditations`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border-light)', textDecoration: 'none', color: 'var(--ink)' }}>
            <span style={{ font: 'var(--text-body)' }}>🧘 {s('观修排行', '觀修排行', 'Meditation ranking')}</span>
            <span style={{ color: 'var(--ink-3)' }}>›</span>
          </Link>
        </div>

        {/* 班级公告 */}
        <SectionHead label={s('班级公告', '班級公告', 'Announcements')} />
        <ClassAnnouncementsSection classId={cid} myRole={myRole} />

        <button
          type="button"
          onClick={async () => {
            if (!(await confirmAsync({ title: s('确定退出班级？退出后学习数据保留。', '確定退出班級？退出後學習資料保留。', 'Leave class? Your study data will be kept.') }))) return;
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

// 班级修学任务 section · 学员视角（来自 usePracticeTasks 过滤 scope=class && classId）
function ClassPracticeTasksSection({ classId }: { classId: string }) {
  const { s } = useLang();
  const tasks = usePracticeTasks();
  const classTasks = (tasks.data ?? []).filter((t) => t.scope === 'class' && t.class?.id === classId);
  if (tasks.isLoading || classTasks.length === 0) return null;
  return (
    <>
      <SectionHead label={s('班级修学任务', '班級修學任務', 'Practice tasks')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        {classTasks.map((t) => {
          const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
          return (
            <Link key={t.id} to={`/practice/project/${encodeURIComponent(t.project.id)}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ font: 'var(--text-body-serif)', color: 'var(--ink)', letterSpacing: 1.2 }}>
                    {t.title || `${t.project.emoji ?? ''} ${t.project.name}`}
                  </span>
                  {t.isDone && <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--glass)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: t.isDone ? 'var(--sage-dark)' : 'linear-gradient(90deg, var(--saffron) 0%, var(--saffron-dark) 100%)' }} />
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                  {t.progress} / {t.target} · {pct}%
                  {t.endAt && ` · ${s('截止', '截止', 'due')} ${new Date(t.endAt).toLocaleDateString()}`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// 本班专修咒种 section
function ClassPracticeProjectsSection({ classId }: { classId: string }) {
  const { s } = useLang();
  const projects = usePracticeProjects();
  const classProjects = (projects.data ?? []).filter((p) => p.scope === 'class' && p.classId === classId);
  if (projects.isLoading || classProjects.length === 0) return null;
  return (
    <>
      <SectionHead label={s('本班专修', '本班專修', 'Class focus')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--sp-4)' }}>
        {classProjects.map((p) => (
          <Link key={p.id} to={`/practice/project/${encodeURIComponent(p.id)}`} style={{ textDecoration: 'none' }}>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-2) var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <span style={{ fontSize: '1.2rem' }}>{p.emoji ?? '📿'}</span>
              <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)' }}>{p.name}</span>
              <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                {p.totalCount > 0 ? `${p.totalCount}` : '——'}
              </span>
              <span style={{ color: 'var(--ink-3)' }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// 班级公告 section · 学员视角
function ClassAnnouncementsSection({ classId, myRole }: { classId: string; myRole?: 'coach' | 'student' }) {
  const { s } = useLang();
  const list = useQuery({
    queryKey: ['/api/classes', classId, 'announcements'],
    queryFn: ({ signal }) => api.get<AnnouncementSummary[]>(`/api/classes/${encodeURIComponent(classId)}/announcements`, { signal }),
  });
  if (list.isLoading) return <Skeleton.List />;
  const items = list.data ?? [];
  return (
    <>
      {myRole === 'coach' && (
        <Link to={`/coach/classes/${encodeURIComponent(classId)}/announcements`} style={{ display: 'inline-block', font: 'var(--text-caption)', color: 'var(--saffron-dark)', textDecoration: 'none', marginBottom: 'var(--sp-2)' }}>
          + {s('发新公告', '發新公告', 'New announcement')}
        </Link>
      )}
      {items.length === 0 ? (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', textAlign: 'center', borderLeft: '3px solid var(--saffron-light)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-4)' }}>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
            {s('暂无公告 · 辅导员发布后将出现在此', '暫無公告', 'No announcements yet')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          {items.map((a) => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}
    </>
  );
}

function AnnouncementCard({ a }: { a: AnnouncementSummary }) {
  const imgs = a.imageUrls ?? [];
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        {a.pinnedAt && <span style={{ color: 'var(--saffron-dark)' }}>📌</span>}
        <h3 style={{ flex: 1, fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 1.5, fontSize: '1rem' }}>
          {a.title}
        </h3>
      </div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginBottom: 6 }}>
        {new Date(a.createdAt).toLocaleString()}
      </div>
      <div style={{ font: 'var(--text-body)', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {a.body}
      </div>
      {imgs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {imgs.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noopener noreferrer">
              <img src={u} alt="" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--glass-border)' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
