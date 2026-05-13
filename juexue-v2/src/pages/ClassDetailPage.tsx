// ClassDetailPage · /class/:id
//   重做版本 · 统一卡片样式 · 线性图标 · 角色感知（学员 vs coach）
//   - Hero：班级名 + emoji + 共修班标签 + 成员/天数 stats + 邀请码（仅 coach/admin）
//   - 修法窗口：藏历日 strip（沿用）
//   - 3 个入口卡：主修法本 / 班级排课 / 班级观修榜（统一样式）
//   - 辅导员快捷区（仅 coach 可见）
//   - 辅导员 / 学员 列表（玻璃头像统一）
//   - 班级公告（仅有内容或 coach 视角显示）
//   - 退出班级（底部 · 危险按钮）
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import Skeleton from '@/components/Skeleton';
import TibetanClassWeekStrip from '@/components/TibetanClassWeekStrip';
import TopNav from '@/components/TopNav';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import {
  useClassDetail,
  useClasses,
  useCourseDetail,
  useEnrollments,
  usePracticeProjects,
  usePracticeTasks,
  useUpcomingEvents,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

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
  const isCoachOrAdmin = myRole === 'coach' || user?.role === 'admin';

  return (
    <div>
      <TopNav titles={['我的班级', '我的班級', 'My Class']} />

      <div style={{ padding: '0 var(--sp-5) var(--sp-8)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {/* ── Hero · 横向紧凑 ── */}
        <div className="glass-card-thick" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink)', letterSpacing: 2 }}>
                  {c.name}
                </h1>
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--saffron-pale)',
                    color: 'var(--saffron-dark)',
                    font: 'var(--text-caption)',
                    fontWeight: 700,
                    letterSpacing: 1,
                    fontSize: '0.65rem',
                  }}
                >
                  {s('共修班', '共修班', 'Class')}
                </span>
              </div>
              <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, fontSize: '0.75rem' }}>
                <span>{c.members.length} {s('成员', '成員', 'members')}</span>
                <span style={{ margin: '0 6px', color: 'var(--ink-4)' }}>·</span>
                <span>
                  {joinedDays === null
                    ? '—'
                    : joinedDays === 0
                    ? s('今日加入', '今日加入', 'Joined today')
                    : s(`加入 ${joinedDays} 天`, `加入 ${joinedDays} 天`, `${joinedDays} days`)}
                </span>
              </div>
            </div>
          </div>

          {/* 邀请码 · 仅 coach/admin · 与上方分隔的细 row */}
          {isCoachOrAdmin && c.joinCode && (
            <div
              style={{
                marginTop: 'var(--sp-3)',
                paddingTop: 'var(--sp-3)',
                borderTop: '1px dashed var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                font: 'var(--text-caption)',
                color: 'var(--ink-3)',
                letterSpacing: 1,
              }}
            >
              <span>{s('邀请码', '邀請碼', 'Invite code')}</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: 'var(--saffron-dark)', letterSpacing: 2 }}>
                {c.joinCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(c.joinCode!).then(
                      () => toast.ok(s('已复制', '已複製', 'Copied')),
                      () => toast.warn(s('复制失败', '複製失敗', 'Copy failed')),
                    );
                  }
                }}
                aria-label={s('复制', '複製', 'Copy')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--saffron-dark)', display: 'inline-flex', marginLeft: 'auto' }}
              >
                <IconCopy />
              </button>
            </div>
          )}
        </div>

        {/* ── 修法窗口（沿用现成组件） ── */}
        <TibetanClassWeekStrip />

        {/* ── 3 个入口卡（统一样式） ── */}
        {c.course && (
          <CourseEntryCard
            slug={c.course.slug}
            title={c.course.title}
            courseId={c.courseId}
          />
        )}

        <SessionEntryCard classId={cid} isCoach={isCoachOrAdmin} />

        {/* 班级综合修学排行（积分制 · 念诵 + 观修 + 阅读 + 答题 全维度） */}
        <EntryCard
          to={`/class/${encodeURIComponent(cid)}/ranking`}
          icon={<IconTrophy />}
          label={s('班级排行', '班級排行', 'Class ranking')}
          title={s('修学积分榜', '修學積分榜', 'Study score board')}
          subtitle={s('念诵 · 观修 · 阅读 · 答题 综合', '念誦 · 觀修 · 閱讀 · 答題 綜合', 'Chant · meditate · read · quiz')}
          accent="saffron"
        />

        {/* ── 辅导员快捷区（仅 coach 可见） ── */}
        {isCoachOrAdmin && (
          <CoachQuickActions classId={cid} />
        )}

        {/* ── 班级修学任务 ── */}
        <ClassPracticeTasksSection classId={cid} />
        <ClassPracticeProjectsSection classId={cid} />

        {/* ── 辅导员 ── */}
        {coaches.length > 0 && (
          <div>
            <SectionTitle icon={<IconUserCheck />} label={s(`辅导员 · ${coaches.length}`, `輔導員 · ${coaches.length}`, `Coaches · ${coaches.length}`)} />
            <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
              {coaches.map((m, idx) => (
                <MemberRow
                  key={m.id}
                  initial={m.user.dharmaName.slice(0, 1) || '·'}
                  name={m.user.dharmaName || '—'}
                  role="coach"
                  isMe={m.user.id === user?.id}
                  s={s}
                  isLast={idx === coaches.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── 学员列表 ── */}
        <div>
          <SectionTitle icon={<IconUsers />} label={s(`学员 · ${students.length}`, `學員 · ${students.length}`, `Students · ${students.length}`)} />
          <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
            {students.length > 0 ? (
              students.map((m, idx) => (
                <MemberRow
                  key={m.id}
                  initial={m.user.dharmaName.slice(0, 1) || '·'}
                  name={m.user.dharmaName || '—'}
                  role="student"
                  isMe={m.user.id === user?.id}
                  s={s}
                  isLast={idx === students.length - 1}
                />
              ))
            ) : (
              <div style={{ padding: 'var(--sp-4)', textAlign: 'center', font: 'var(--text-caption)', color: 'var(--ink-4)', letterSpacing: 1 }}>
                {s('暂无学员', '暫無學員', 'No students yet')}
              </div>
            )}
          </div>
        </div>

        {/* ── 班级公告（学员视角仅有公告时显示 · coach 总显示加 + 发公告 入口） ── */}
        <ClassAnnouncementsSection classId={cid} isCoach={isCoachOrAdmin} />

        {/* ── 退出班级 ── */}
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
            marginTop: 'var(--sp-4)',
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

// ─────────────────────────────────────────────────────
// 子组件
// ─────────────────────────────────────────────────────


function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <h2
      style={{
        font: 'var(--text-body)',
        fontWeight: 700,
        color: 'var(--ink)',
        letterSpacing: 2,
        marginBottom: 'var(--sp-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-serif)',
        fontSize: '1rem',
      }}
    >
      <span style={{ color: 'var(--saffron-dark)', display: 'inline-flex' }}>{icon}</span>
      {label}
    </h2>
  );
}

// 统一入口卡 · 三处用同款（主修法本 / 班级排课 / 班级观修榜）
function EntryCard({
  to, onClick, icon, label, title, subtitle, accent,
}: {
  to?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;        // 上灰字小 caption
  title: string;        // 主标题
  subtitle?: string;    // 副标题（如 "已学 5/14 课"）
  accent?: 'saffron' | 'gold' | 'sage';
}) {
  const tone = accent ?? 'saffron';
  const colorMap = {
    saffron: 'var(--saffron-dark)',
    gold: 'var(--gold-dark)',
    sage: 'var(--sage-dark)',
  };
  const iconColor = colorMap[tone];

  const content = (
    <>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 'var(--r-md)',
          background: 'rgba(255, 255, 255, 0.7)',
          border: '1px solid var(--glass-border)',
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 2, margin: 0 }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', fontSize: '0.9375rem', letterSpacing: 1.5, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" style={{ color: 'var(--ink-4)', flexShrink: 0 }} aria-hidden>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </>
  );

  const sharedStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-3) var(--sp-4)',
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: 'var(--r-lg)',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  };

  if (to) return <Link to={to} style={sharedStyle}>{content}</Link>;
  return <button type="button" onClick={onClick} style={{ ...sharedStyle, textAlign: 'left', width: '100%' }}>{content}</button>;
}

// 主修法本入口（含学习进度）
function CourseEntryCard({ slug, title, courseId }: { slug: string; title: string; courseId: string }) {
  const { s } = useLang();
  const enrollments = useEnrollments();
  const enrollment = (enrollments.data ?? []).find((e) => e.courseId === courseId);
  // 拉 course detail 算总课时
  const courseDetail = useCourseDetail(slug, { lite: true });
  const totalLessons = (courseDetail.data?.chapters ?? []).reduce((sum, ch) => sum + (ch.lessons?.length ?? 0), 0);
  const completed = enrollment?.lessonsCompleted.length ?? 0;
  const subtitle = totalLessons > 0
    ? s(`已学 ${completed} / ${totalLessons} 课`, `已學 ${completed} / ${totalLessons} 課`, `${completed}/${totalLessons} done`)
    : undefined;

  return (
    <EntryCard
      to={`/scripture-detail?slug=${encodeURIComponent(slug)}`}
      icon={<IconBook />}
      label={s('主修法本', '主修法本', 'Main text')}
      title={title}
      subtitle={subtitle}
      accent="gold"
    />
  );
}

// 班级排课入口
//   coach → 跳排课管理页 · 副标显示"管理排课"
//   学员 → 跳排课列表 · 副标显示下一场或"暂无排课"
function SessionEntryCard({ classId, isCoach }: { classId: string; isCoach: boolean }) {
  const { s } = useLang();
  const upcoming = useUpcomingEvents(60 * 24 * 7); // 未来 7 天
  const myClassUpcoming = (upcoming.data ?? []).filter((e) => e.kind === 'class_session' && e.classId === classId);
  const next = myClassUpcoming[0];

  const to = isCoach
    ? `/coach/classes/${encodeURIComponent(classId)}/sessions`
    : `/coach/classes/${encodeURIComponent(classId)}/sessions`; // 学员也能看 GET · 后端校验

  return (
    <EntryCard
      to={to}
      icon={<IconCalendar />}
      label={isCoach ? s('班级排课 · 管理', '班級排課 · 管理', 'Sessions · manage') : s('班级排课', '班級排課', 'Sessions')}
      title={next ? next.title : s('暂无未来排课', '暫無未來排課', 'No upcoming sessions')}
      subtitle={next ? formatRelativeStart(next.startAt, s) : undefined}
      accent="saffron"
    />
  );
}

function formatRelativeStart(iso: string, s: (sc: string, tc: string, en?: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 0) return s('已开始', '已開始', 'Started');
  if (diffMin < 60) return s(`${diffMin} 分钟后`, `${diffMin} 分鐘後`, `in ${diffMin}m`);
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return s(`${diffH} 小时后`, `${diffH} 小時後`, `in ${diffH}h`);
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateStr} ${timeStr}`;
}

// 辅导员快捷区
function CoachQuickActions({ classId }: { classId: string }) {
  const { s } = useLang();
  return (
    <div>
      <SectionTitle icon={<IconWrench />} label={s('辅导员快捷', '輔導員快捷', 'Coach quick actions')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
        <QuickActionTile
          to={`/coach/classes/${encodeURIComponent(classId)}/announcements?compose=1`}
          icon={<IconMegaphone />}
          label={s('发公告', '發公告', 'Post')}
        />
        <QuickActionTile
          to={`/coach/classes/${encodeURIComponent(classId)}/sessions`}
          icon={<IconCalendar />}
          label={s('排课', '排課', 'Sessions')}
        />
        <QuickActionTile
          to={`/coach/classes/${encodeURIComponent(classId)}/dashboard`}
          icon={<IconChart />}
          label={s('学员看板', '學員看板', 'Dashboard')}
        />
      </div>
    </div>
  );
}

function QuickActionTile({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: 'var(--sp-3) var(--sp-2)',
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        borderRadius: 'var(--r-lg)',
        textDecoration: 'none',
        color: 'var(--ink)',
      }}
    >
      <span style={{ color: 'var(--saffron-dark)', display: 'inline-flex' }}>{icon}</span>
      <span style={{ font: 'var(--text-caption)', fontWeight: 600, letterSpacing: 1, color: 'var(--ink-2)' }}>
        {label}
      </span>
    </Link>
  );
}

// 学员/辅导员行 · 玻璃头像统一
function MemberRow({
  initial, name, role, isMe, s, isLast,
}: {
  initial: string;
  name: string;
  role: 'coach' | 'student';
  isMe: boolean;
  s: (sc: string, tc: string, en?: string) => string;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-3) var(--sp-4)',
        borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.85)',
          border: '1px solid var(--glass-border)',
          color: 'var(--ink-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-serif)',
          fontWeight: 700,
          fontSize: '0.95rem',
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

// 班级修学任务（沿用 · 仅微调样式）
function ClassPracticeTasksSection({ classId }: { classId: string }) {
  const { s } = useLang();
  const tasks = usePracticeTasks();
  const classTasks = (tasks.data ?? []).filter((t) => t.scope === 'class' && t.class?.id === classId);
  if (tasks.isLoading || classTasks.length === 0) return null;
  return (
    <div>
      <SectionTitle icon={<IconTarget />} label={s('班级修学任务', '班級修學任務', 'Practice tasks')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
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
    </div>
  );
}

function ClassPracticeProjectsSection({ classId }: { classId: string }) {
  const { s } = useLang();
  const projects = usePracticeProjects();
  const classProjects = (projects.data ?? []).filter((p) => p.scope === 'class' && p.classId === classId);
  if (projects.isLoading || classProjects.length === 0) return null;
  return (
    <div>
      <SectionTitle icon={<IconBeads />} label={s('本班专修', '本班專修', 'Class focus')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
    </div>
  );
}

// 公告 section · placeholder 始终显示（让学员知道这个区域存在）
function ClassAnnouncementsSection({ classId, isCoach }: { classId: string; isCoach: boolean }) {
  const { s } = useLang();
  const list = useQuery({
    queryKey: ['/api/classes', classId, 'announcements'],
    queryFn: ({ signal }) => api.get<AnnouncementSummary[]>(`/api/classes/${encodeURIComponent(classId)}/announcements`, { signal }),
  });
  const items = list.data ?? [];

  return (
    <div>
      <SectionTitle icon={<IconMegaphone />} label={s('班级公告', '班級公告', 'Announcements')} />
      {isCoach && (
        <Link
          to={`/coach/classes/${encodeURIComponent(classId)}/announcements`}
          style={{ display: 'inline-block', font: 'var(--text-caption)', color: 'var(--saffron-dark)', textDecoration: 'none', marginBottom: 'var(--sp-2)' }}
        >
          + {s('管理公告', '管理公告', 'Manage')}
        </Link>
      )}
      {list.isLoading ? (
        <Skeleton.List />
      ) : items.length === 0 ? (
        <div className="glass-card" style={{ padding: 'var(--sp-4)', textAlign: 'center', borderRadius: 'var(--r-lg)' }}>
          <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
            {s('暂无公告', '暫無公告', 'No announcements')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {items.map((a) => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
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

// ─────────────────────────────────────────────────────
// 线性图标 · 统一 18×18 stroke 1.8
// ─────────────────────────────────────────────────────

function IconBook() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 9a6 6 0 0 0 12 0V3H6z" />
      <path d="M6 4H2v2a4 4 0 0 0 4 4" />
      <path d="M18 4h4v2a4 4 0 0 1-4 4" />
      <path d="M10 21h4" />
      <path d="M12 15v6" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconUserCheck() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M14.7 6.3a4 4 0 0 1 5.5 5.5l-1.7-.6L17 13.5l.6 1.7a4 4 0 0 1-5.5-5.5l1.7.6L15.3 8l-.6-1.7zM14 10l-8 8a2 2 0 1 1-3-3l8-8" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconBeads() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="6" r="2" />
      <circle cx="18" cy="10" r="1.5" />
      <circle cx="18" cy="14" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="6" cy="14" r="1.5" />
      <circle cx="6" cy="10" r="1.5" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
