// CoachStudentsPage · /coach/students[?classId=...&uid=...]
//   班级选择 chips + 成员表 + 学员详情居中 Dialog（决策 4）
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DailyBarChart from '@/components/DailyBarChart';
import Dialog from '@/components/Dialog';
import Skeleton from '@/components/Skeleton';
import { useLang } from '@/lib/i18n';
import { relTime } from '@/lib/relTime';
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
                      {m.user.lastLoginAt ? relTime(m.user.lastLoginAt, s) : '—'}
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
        <Drawer onClose={closeDrawer} loading={student.isLoading} data={student.data} classId={classId ?? ''} uid={uidParam} />
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

function Drawer({ onClose, loading, data, classId, uid }: { onClose: () => void; loading: boolean; data: ReturnType<typeof useCoachStudent>['data']; classId: string; uid: string }) {
  const { s } = useLang();
  return (
    <Dialog open onClose={onClose} title={s('学员详情', '學員詳情', 'Student detail')} variant="centered" width={720}>
      <div>
        {classId && uid && (
          <Link
            to={`/coach/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(uid)}/stats`}
            onClick={onClose}
            className="btn btn-pill"
            style={{ display: 'inline-flex', padding: '6px 14px', font: 'var(--text-caption)', background: 'var(--saffron-pale)', color: 'var(--saffron-dark)', border: '1px solid var(--saffron-light)', textDecoration: 'none', marginBottom: 'var(--sp-3)' }}
          >
            📊 {s('完整学修档案', '完整學修檔案', 'Full dossier')} ›
          </Link>
        )}
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
                <p style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }} title={data.user.lastLoginAt ? new Date(data.user.lastLoginAt).toLocaleString() : ''}>
                  {data.user.lastLoginAt ? s('上次登录', '上次登入', 'Seen') + ' ' + relTime(data.user.lastLoginAt, s) : '—'}
                </p>
              </div>
            </div>

            {/* 总览 */}
            <SectionLabel>{s('总览', '總覽', 'Summary')}</SectionLabel>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <Mini value={String(data.summary.totalAnswers)} label={s('累计答题', '累計答題', 'Total')} />
              <Mini value={Math.round(data.summary.correctRate * 100) + '%'} label={s('正确率', '正確率', 'Accuracy')} color="var(--sage-dark)" />
            </div>

            {/* 30 天活跃柱图 */}
            <SectionLabel>{s('30 天活跃', '30 天活躍', '30-day activity')}</SectionLabel>
            <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <DailyBarChart
                data={data.dailySeries ?? []}
                emptyLabel={s('近 30 天暂无答题', '近 30 天暫無答題', 'No activity in last 30 days')}
              />
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
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }} title={new Date(a.createdAt).toLocaleString()}>
                      {relTime(a.createdAt, s)}
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
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }} title={new Date(m.lastWrongAt).toLocaleString()}>
                      {relTime(m.lastWrongAt, s)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 修学计数 · 4 大类（隐藏观修） */}
            {data.practice && (
              <>
                <SectionLabel>
                  {s('修学计数', '修學計數', 'Practice')}
                  {data.practice.streak > 0 && (
                    <span style={{ marginLeft: 8, font: 'var(--text-caption)', color: 'var(--gold-dark)', fontWeight: 700 }}>
                      🔥 {data.practice.streak}天
                    </span>
                  )}
                </SectionLabel>
                <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)' }}>
                  {data.practice.categories.map((c) => (
                    <div key={c.categoryId} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem' }}>{c.emoji}</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: c.totalCount > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                        {c.totalCount}
                      </div>
                      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{c.categoryName}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 观修完成（本班课程范围） */}
            {data.meditations && data.meditations.length > 0 && (
              <>
                <SectionLabel>{s('观修完成', '觀修完成', 'Meditations')} · {data.meditations.length}</SectionLabel>
                <div className="glass-card-thick" style={{ padding: 0, marginBottom: 'var(--sp-4)' }}>
                  {data.meditations.slice(0, 8).map((m, i) => (
                    <div key={m.meditationId + m.completedAt} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
                      <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🧘 {m.title}
                      </span>
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{Math.round(m.videoWatchedSec / 60)} min</span>
                      <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                        {relTime(m.completedAt, s)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
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
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }} title={e.lastStudiedAt ? new Date(e.lastStudiedAt).toLocaleString() : ''}>
                      {e.lastStudiedAt ? relTime(e.lastStudiedAt, s) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
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

