// AdminDharmaAssembliesPage · /admin/dharma-assemblies
//   admin 发布 / 编辑 / 软删 法会 / 系统活动（spec §3.7）
//   - 创建后自动 dispatch 给所有 active 用户（created tier · normal severity）
//   - cron 每分钟扫描 · 法会 1h 前自动发 daily_t1h push（urgent）
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { confirmAsync } from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import Skeleton from '@/components/Skeleton';

type Category = 'assembly' | 'system_session' | 'memorial';

interface DharmaAssembly {
  id: string;
  title: string;
  category: Category;
  startAt: string;
  endAt: string;
  description: string;
  coverImage: string | null;
  externalLink: string | null;
  deletedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABEL: Record<Category, [string, string, string]> = {
  assembly: ['法会', '法會', 'Assembly'],
  system_session: ['共修', '共修', 'Session'],
  memorial: ['纪念日', '紀念日', 'Memorial'],
};

export default function AdminDharmaAssembliesPage() {
  const { s } = useLang();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['/api/admin/dharma-assemblies'],
    queryFn: () => api.get<DharmaAssembly[]>('/api/admin/dharma-assemblies'),
  });

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('assembly');
  // 默认 1 天后开始 · 持续 3 天
  const now = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, [now]);
  const defaultEnd = useMemo(() => {
    const d = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, [now]);
  const [startLocal, setStartLocal] = useState(defaultStart);
  const [endLocal, setEndLocal] = useState(defaultEnd);
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [externalLink, setExternalLink] = useState('');

  const create = useMutation({
    mutationFn: (input: {
      title: string;
      category: Category;
      startAt: string;
      endAt: string;
      description: string;
      coverImage: string | null;
      externalLink: string | null;
    }) => api.post('/api/admin/dharma-assemblies', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/dharma-assemblies'] });
      setShowForm(false);
      setTitle('');
      setCategory('assembly');
      setStartLocal(defaultStart);
      setEndLocal(defaultEnd);
      setDescription('');
      setCoverImage('');
      setExternalLink('');
      toast.ok(s('已发布并通知所有用户', '已發布並通知所有用戶', 'Published'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/dharma-assemblies/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/dharma-assemblies'] });
      toast.ok(s('已软删', '已軟刪', 'Deleted'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  function submit() {
    if (!title.trim()) return toast.error(s('标题必填', '標題必填', 'Title required'));
    if (!description.trim()) return toast.error(s('介绍必填', '介紹必填', 'Description required'));
    if (externalLink && !/^https?:\/\//.test(externalLink)) {
      return toast.error(s('外部链接必须 https:// 开头', '外部連結必須 https:// 開頭', 'Link must start with http(s)://'));
    }
    create.mutate({
      title: title.trim(),
      category,
      startAt: new Date(startLocal).toISOString(),
      endAt: new Date(endLocal).toISOString(),
      description: description.trim(),
      coverImage: coverImage.trim() || null,
      externalLink: externalLink.trim() || null,
    });
  }

  async function onDelete(a: DharmaAssembly) {
    const ok = await confirmAsync({
      title: s('软删此法会？', '軟刪此法會？', 'Delete?'),
      body: s('软删后已调度的 cron 提醒会自动跳过 · 用户端详情页显示「已取消」', '軟刪後已調度的 cron 提醒會自動跳過 · 用戶端詳情頁顯示「已取消」', 'Soft-deleted · pending reminders auto-skip'),
      okLabel: s('删除', '刪除', 'Delete'),
      danger: true,
    });
    if (ok) remove.mutate(a.id);
  }

  const items = list.data ?? [];

  return (
    <div style={{ padding: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h1 style={{ font: 'var(--text-h1)', color: 'var(--ink)', margin: 0, flex: 1 }}>
          {s('法会 / 系统活动', '法會 / 系統活動', 'Dharma Assemblies')}
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '8px 14px',
            background: showForm ? 'var(--glass)' : 'var(--saffron)',
            color: showForm ? 'var(--ink)' : '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            font: 'var(--text-body)',
            letterSpacing: 1,
          }}
        >
          {showForm
            ? s('取消', '取消', 'Cancel')
            : s('+ 新建', '+ 新建', '+ New')}
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <Field label={s('标题', '標題', 'Title')}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              style={inputStyle}
              placeholder={s('如「文殊菩萨圣诞法会」', '如「文殊菩薩聖誕法會」', 'e.g. "Manjushri Birthday Assembly"')}
            />
          </Field>
          <Field label={s('类型', '類型', 'Category')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
                const [sc, tc, en] = CATEGORY_LABEL[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid ' + (category === c ? 'var(--saffron)' : 'var(--border)'),
                      background: category === c ? 'var(--saffron-pale)' : 'transparent',
                      color: category === c ? 'var(--saffron-dark)' : 'var(--ink-3)',
                      cursor: 'pointer',
                      font: 'var(--text-body)',
                      fontWeight: category === c ? 600 : 400,
                    }}
                  >
                    {s(sc, tc, en)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={s('开始时间', '開始時間', 'Start')}>
            <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={s('结束时间', '結束時間', 'End')}>
            <input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={s('介绍', '介紹', 'Description')}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={s('法会缘起、主题、参与方式…', '法會緣起、主題、參與方式…', 'Origin, theme, participation…')}
            />
          </Field>
          <Field label={s('封面图 URL（可选）', '封面圖 URL（可選）', 'Cover Image URL (optional)')}>
            <input type="text" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} style={inputStyle} placeholder="/uploads/... or https://..." />
          </Field>
          <Field label={s('外部参与链接（可选）', '外部參與連結（可選）', 'External Link (optional)')}>
            <input type="text" value={externalLink} onChange={(e) => setExternalLink(e.target.value)} style={inputStyle} placeholder="https://zoom.us/j/..." />
            <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 4 }}>
              {s('用户点详情页「加入会议」直接跳转', '用戶點詳情頁「加入會議」直接跳轉', 'Users tap "Join" to open external')}
            </div>
          </Field>
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending || !title.trim() || !description.trim()}
            style={{
              padding: '10px 20px',
              background: 'var(--saffron)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: create.isPending ? 'wait' : 'pointer',
              font: 'var(--text-body)',
              letterSpacing: 1,
              opacity: !title.trim() || !description.trim() ? 0.5 : 1,
            }}
          >
            {create.isPending ? s('发布中…', '發布中…', 'Publishing…') : s('发布并通知所有用户', '發布並通知所有用戶', 'Publish & notify all')}
          </button>
        </div>
      )}

      {/* 列表 */}
      {list.isLoading ? (
        <Skeleton.Card />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="🪷" title={s('暂无法会', '暫無法會', 'None')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {items.map((a) => {
            const isDeleted = !!a.deletedAt;
            const [sc, tc, en] = CATEGORY_LABEL[a.category];
            return (
              <div key={a.id} className="glass-card-thick" style={{ padding: 'var(--sp-4)', opacity: isDeleted ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'var(--saffron-pale)',
                      color: 'var(--saffron-dark)',
                      border: '1px solid var(--saffron)',
                      font: 'var(--text-caption)',
                      fontWeight: 600,
                    }}
                  >
                    {s(sc, tc, en)}
                  </span>
                  {isDeleted && <span style={chipStyle}>{s('已删除', '已刪除', 'Deleted')}</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ font: 'var(--text-body)', fontWeight: 700, marginBottom: 4, textDecoration: isDeleted ? 'line-through' : 'none' }}>
                  {a.title}
                </div>
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4 }}>
                  {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleString()}
                </div>
                {a.externalLink && (
                  <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginBottom: 4 }}>
                    🔗 {a.externalLink}
                  </div>
                )}
                <div style={{ font: 'var(--text-caption)', color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {a.description.length > 200 ? a.description.slice(0, 200) + '…' : a.description}
                </div>
                {!isDeleted && (
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <button
                      type="button"
                      onClick={() => onDelete(a)}
                      disabled={remove.isPending}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        borderRadius: 6,
                        cursor: 'pointer',
                        font: 'var(--text-caption)',
                        letterSpacing: 1,
                      }}
                    >
                      {s('软删', '軟刪', 'Delete')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginBottom: 4, letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  font: 'var(--text-body)',
  color: 'var(--ink)',
  background: 'var(--bg-card)',
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--glass)',
  color: 'var(--ink-3)',
  font: 'var(--text-caption)',
};
