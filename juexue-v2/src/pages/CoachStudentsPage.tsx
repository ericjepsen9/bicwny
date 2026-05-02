// CoachStudentsPage · /coach/students[?classId=...&uid=...]
//   班级选择 chips + 成员表 + 学员详情侧栏（drawer）
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import {
  useCoachClassMembers,
  useCoachClasses,
  useCoachStudent,
} from '@/lib/queries';

export default function CoachStudentsPage() {
  const { s } = useLang();
  const [sp, setSp] = useSearchParams();
  const classes = useCoachClasses();

  const classIdParam = sp.get('classId');
  const uidParam = sp.get('uid');

  // 默认选第一个班
  useEffect(() => {
    if (!classIdParam && classes.data && classes.data.length > 0) {
      setSp({ classId: classes.data[0]!.id }, { replace: true });
    }
  }, [classIdParam, classes.data, setSp]);

  const classId = classIdParam || (classes.data?.[0]?.id ?? null);
  const members = useCoachClassMembers(classId);
  const student = useCoachStudent(classId, uidParam);

  const sortedMembers = useMemo(
    () => (members.data ?? []).slice().sort((a, b) => {
      // 辅导员置顶 · 然后按 joinedAt 升序
      if (a.role !== b.role) return a.role === 'coach' ? -1 : 1;
      return +new Date(a.joinedAt) - +new Date(b.joinedAt);
    }),
    [members.data],
  );

  function pickClass(id: string) {
    setSp({ classId: id });
  }
  function pickStudent(uid: string) {
    setSp({ classId: classId || '', uid });
  }
  function closeDrawer() {
    if (classId) setSp({ classId });
    else setSp({});
  }

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('班级学员', '班級學員', 'Students')}</h1>
          <p className="page-sub">{s('查看个人进度与错题', '查看個人進度與錯題', 'Per-student progress')}</p>
        </div>
      </div>

      {/* 班级 chips */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        {classes.isLoading ? (
          <Skeleton.LineSm style={{ width: 220 }} />
        ) : (
          (classes.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickClass(c.id)}
              className="btn btn-pill"
              style={{
                padding: '6px 14px',
                background: c.id === classId ? 'var(--saffron-pale)' : 'var(--glass-thick)',
                color: c.id === classId ? 'var(--saffron-dark)' : 'var(--ink-2)',
                border: '1px solid ' + (c.id === classId ? 'var(--saffron-light)' : 'var(--glass-border)'),
                font: 'var(--text-caption)',
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              {c.coverEmoji || '📚'} {c.name}
            </button>
          ))
        )}
      </div>

      {/* 成员表 */}
      {!classId ? (
        <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('请选一个班级', '請選一個班級', 'Pick a class')}
        </div>
      ) : members.isLoading ? (
        <Skeleton.Card />
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
                <Th>{s('成员', '成員', 'Member')}</Th>
                <Th>{s('角色', '角色', 'Role')}</Th>
                <Th>{s('加入', '加入', 'Joined')}</Th>
                <Th>{s('上次登录', '上次登入', 'Last seen')}</Th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => pickStudent(m.user.id)}
                  style={{ cursor: 'pointer', borderTop: '1px solid var(--border-light)', background: m.user.id === uidParam ? 'var(--saffron-pale)' : 'transparent' }}
                >
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '0.75rem' }}>
                        {m.user.dharmaName.slice(0, 1)}
                      </span>
                      <div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--ink)', letterSpacing: 1 }}>
                          {m.user.dharmaName}
                        </div>
                        {m.user.email && (
                          <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                            {m.user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: m.role === 'coach' ? 'var(--gold-pale)' : 'var(--saffron-pale)', color: m.role === 'coach' ? 'var(--gold-dark)' : 'var(--saffron-dark)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
                      {m.role === 'coach' ? s('辅导员', '輔導員', 'Coach') : s('学员', '學員', 'Student')}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      {m.user.lastLoginAt ? relTime(m.user.lastLoginAt) : '—'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 学员详情 drawer */}
      {uidParam && (
        <Drawer onClose={closeDrawer} loading={student.isLoading} data={student.data} />
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function Drawer({ onClose, loading, data }: { onClose: () => void; loading: boolean; data: ReturnType<typeof useCoachStudent>['data'] }) {
  const { s } = useLang();
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(43,34,24,.35)',
          zIndex: 200,
          backdropFilter: 'blur(2px)',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(560px, 100vw)',
          background: 'var(--bg-scene)',
          borderLeft: '1px solid var(--glass-border)',
          boxShadow: '-12px 0 32px rgba(43,34,24,.18)',
          zIndex: 201,
          overflowY: 'auto',
          padding: 'var(--sp-5)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: 'var(--ink)', letterSpacing: 2 }}>
            {s('学员详情', '學員詳情', 'Student detail')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s('关闭', '關閉', 'Close')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: '1.4rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <Skeleton.Card />
        ) : !data ? (
          <p style={{ color: 'var(--ink-3)' }}>{s('加载失败', '載入失敗', 'Failed')}</p>
        ) : (
          <>
            {/* hero */}
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem' }}>
                {data.user.dharmaName.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)', letterSpacing: 2, fontSize: '1rem' }}>
                  {data.user.dharmaName}
                </h3>
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{data.user.email}</p>
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>
                  {data.user.lastLoginAt ? s('上次登录', '上次登入', 'Seen') + ' ' + relTime(data.user.lastLoginAt) : '—'}
                </p>
              </div>
            </div>

            {/* 总览 */}
            <SectionLabel>{s('总览', '總覽', 'Summary')}</SectionLabel>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <Mini value={String(data.summary.totalAnswers)} label={s('累计答题', '累計答題', 'Total')} />
              <Mini value={Math.round(data.summary.correctRate * 100) + '%'} label={s('正确率', '正確率', 'Accuracy')} color="var(--sage-dark)" />
            </div>

            {/* SM2 */}
            <SectionLabel>{s('SM-2 状态', 'SM-2 狀態', 'SM-2')}</SectionLabel>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
              <Mini value={String(data.sm2.new)} label={s('新卡', '新卡', 'New')} />
              <Mini value={String(data.sm2.learning)} label={s('学习', '學習', 'Learn')} />
              <Mini value={String(data.sm2.review)} label={s('复习', '複習', 'Review')} />
              <Mini value={String(data.sm2.mastered)} label={s('掌握', '掌握', 'Mastered')} color="var(--sage-dark)" />
              <Mini value={String(data.sm2.due)} label={s('到期', '到期', 'Due')} color="var(--gold-dark)" />
              <Mini value={String(data.sm2.total)} label={s('总计', '總計', 'Total')} />
            </div>

            {/* 近期答题 */}
            <SectionLabel>{s('近期答题', '近期答題', 'Recent answers')}</SectionLabel>
            {data.recentAnswers.length === 0 ? (
              <Empty>{s('暂无记录', '暫無記錄', 'No records')}</Empty>
            ) : (
              <div className="glass-card-thick" style={{ padding: 0, marginBottom: 'var(--sp-4)' }}>
                {data.recentAnswers.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                    <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.lessonTitle || '—'}
                    </span>
                    <span style={{ font: 'var(--text-caption)', color: a.isCorrect ? 'var(--sage-dark)' : 'var(--crimson)', fontWeight: 700 }}>
                      {a.isCorrect ? '✓' : '✗'}
                    </span>
                    {a.score != null && (
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                        {a.score}
                      </span>
                    )}
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                      {relTime(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 错题 */}
            <SectionLabel>{s('错题', '錯題', 'Mistakes')}</SectionLabel>
            {data.mistakes.length === 0 ? (
              <Empty>{s('无错题 · 棒', '無錯題 · 棒', 'None')}</Empty>
            ) : (
              <div className="glass-card-thick" style={{ padding: 0, marginBottom: 'var(--sp-4)' }}>
                {data.mistakes.slice(0, 10).map((m, i) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                    <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.questionText}
                    </span>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 700 }}>
                      ×{m.wrongCount}
                    </span>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                      {relTime(m.lastWrongAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 已选法本 */}
            <SectionLabel>{s('已选法本', '已選法本', 'Enrollments')}</SectionLabel>
            {data.enrollments.length === 0 ? (
              <Empty>{s('暂未选修', '暫未選修', 'None')}</Empty>
            ) : (
              <div className="glass-card-thick" style={{ padding: 0 }}>
                {data.enrollments.map((e, i) => (
                  <div key={e.courseId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                    <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)' }}>
                      {e.courseTitle}
                    </span>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
                      {e.status}
                    </span>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                      {e.lastStudiedAt ? relTime(e.lastStudiedAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--saffron)' }} />
      {children}
    </h3>
  );
}
function Mini({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.125rem', color: color ?? 'var(--ink)' }}>{value}</div>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', textAlign: 'center', color: 'var(--ink-3)', font: 'var(--text-caption)' }}>
      {children}
    </div>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + '天前';
  return new Date(iso).toLocaleDateString();
}
