// AdminLlmPage · /admin/llm
//   月度 KPI 4 + provider 表（toggle/edit/reset-circuit）+ 调用日志
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Dialog from '@/components/Dialog';
import Field from '@/components/Field';
import Skeleton from '@/components/Skeleton';
import { confirmAsync } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import {
  type LlmProvider,
  type OveragePolicy,
  type LlmRole,
  useAdminLlmLogs,
  useAdminLlmProviders,
  useAdminLlmUsage,
} from '@/lib/queries';
import { toast } from '@/lib/toast';

type LogFilter = 'all' | 'ok' | 'err';

export default function AdminLlmPage() {
  const { s } = useLang();
  const providers = useAdminLlmProviders();
  const usage = useAdminLlmUsage('month');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const logs = useAdminLlmLogs({
    success: logFilter === 'all' ? undefined : logFilter === 'ok',
    limit: 50,
  });

  const editing = providers.data?.find((p) => p.id === editingId) ?? null;
  const totals = usage.data?.totals;

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('LLM 管理', 'LLM 管理', 'LLM')}</h1>
          <p className="page-sub">{s('供应商配置 · 用量 · 调用日志', '供應商配置 · 用量 · 調用日誌', 'Providers · usage · logs')}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => setCreateOpen(true)} className="btn btn-primary btn-pill" style={{ padding: '8px 16px' }}>
            + {s('新增供应商', '新增供應商', 'New provider')}
          </button>
        </div>
      </div>

      {/* KPI · 月度 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        <Kpi loading={usage.isLoading} value={fmtNum(totals?.requestCount)} label={s('本月请求', '本月請求', 'Requests · m')} />
        <Kpi loading={usage.isLoading} value={fmtNum(totals?.tokenCount)} label={s('本月 tokens', '本月 tokens', 'Tokens · m')} color="var(--saffron)" />
        <Kpi loading={usage.isLoading} value={'$' + (totals?.cost ?? 0).toFixed(2)} label={s('本月成本', '本月成本', 'Cost · m')} color="var(--gold-dark)" />
        <Kpi
          loading={usage.isLoading}
          value={(totals && totals.requestCount > 0 ? Math.round((totals.errorCount / totals.requestCount) * 100) : 0) + '%'}
          label={s('错误率', '錯誤率', 'Error rate')}
          color={totals && totals.errorCount > 0 ? 'var(--crimson)' : 'var(--sage-dark)'}
        />
      </div>

      {/* Provider 表 */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2, marginBottom: 'var(--sp-3)' }}>
        {s('供应商', '供應商', 'Providers')}
      </h2>
      {providers.isLoading ? (
        <Skeleton.Card />
      ) : !providers.data || providers.data.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('还没有供应商', '還沒有供應商', 'No providers yet')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
              <Th>{s('供应商', '供應商', 'Provider')}</Th>
              <Th>{s('角色', '角色', 'Role')}</Th>
              <Th>{s('健康', '健康', 'Health')}</Th>
              <Th>{s('成本 / 1k', '成本 / 1k', 'Cost / 1k')}</Th>
              <Th>{s('配额 / 限速', '配額 / 限速', 'Quota / Limits')}</Th>
              <Th>{s('启用', '啟用', 'Enabled')}</Th>
              <Th>{s('操作', '操作', 'Actions')}</Th>
            </tr></thead>
            <tbody>
              {[...providers.data].sort((a, b) => a.priority - b.priority).map((p) => (
                <ProviderRow key={p.id} p={p} onEdit={() => setEditingId(p.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 调用日志 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
          {s('调用日志', '調用日誌', 'Call logs')}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'ok', 'err'] as LogFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setLogFilter(k)}
              className="btn btn-pill"
              style={{
                padding: '4px 12px', font: 'var(--text-caption)', fontWeight: 600,
                background: logFilter === k ? 'var(--saffron-pale)' : 'transparent',
                color: logFilter === k ? 'var(--saffron-dark)' : 'var(--ink-3)',
                border: '1px solid ' + (logFilter === k ? 'var(--saffron-light)' : 'transparent'),
              }}
            >
              {k === 'all' ? s('全部', '全部', 'All') : k === 'ok' ? s('成功', '成功', 'OK') : s('失败', '失敗', 'Err')}
            </button>
          ))}
        </div>
      </div>
      {logs.isLoading ? (
        <Skeleton.Card />
      ) : !logs.data || logs.data.length === 0 ? (
        <div className="glass-card-thick" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--ink-3)' }}>
          {s('暂无日志', '暫無日誌', 'No logs')}
        </div>
      ) : (
        <div className="glass-card-thick" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--glass)', textAlign: 'left' }}>
              <Th>{s('时间', '時間', 'Time')}</Th>
              <Th>{s('状态', '狀態', 'Status')}</Th>
              <Th>{s('场景', '場景', 'Scenario')}</Th>
              <Th>{s('供应商', '供應商', 'Provider')}</Th>
              <Th>{s('模型', '模型', 'Model')}</Th>
              <Th>{s('Tokens', 'Tokens', 'Tokens')}</Th>
              <Th>{s('成本', '成本', 'Cost')}</Th>
              <Th>{s('延迟', '延遲', 'Latency')}</Th>
            </tr></thead>
            <tbody>
              {logs.data.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{new Date(l.timestamp).toLocaleString()}</span></Td>
                  <Td>
                    {l.success
                      ? <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'rgba(125,154,108,.15)', color: 'var(--sage-dark)', font: 'var(--text-caption)', fontWeight: 700 }}>ok</span>
                      : <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--crimson-light)', color: 'var(--crimson)', font: 'var(--text-caption)', fontWeight: 700 }} title={l.errorMessage ?? ''}>err</span>}
                    {l.switched && <span style={{ marginLeft: 4, font: 'var(--text-caption)', color: 'var(--saffron-dark)' }}>降级</span>}
                  </Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-2)' }}>{l.scenario}</span></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink)' }}>{l.providerUsed}</span></Td>
                  <Td>
                    <span
                      style={{
                        padding: '1px 7px',
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--glass)',
                        border: '1px solid var(--glass-border)',
                        font: 'var(--text-caption)',
                        color: 'var(--ink-3)',
                        letterSpacing: '.5px',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    >
                      {l.model}
                    </span>
                  </Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', textAlign: 'right' }}>{l.inputTokens + l.outputTokens}</span></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>${l.cost.toFixed(4)}</span></Td>
                  <Td><span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)' }}>{l.latencyMs}ms</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={s('新增供应商', '新增供應商', 'New provider')}>
        <ProviderForm onDone={() => setCreateOpen(false)} mode="create" />
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditingId(null)} title={s('编辑供应商', '編輯供應商', 'Edit provider')}>
        {editing && <ProviderForm onDone={() => setEditingId(null)} mode="edit" initial={editing} />}
      </Dialog>
    </>
  );
}

function Kpi({ value, label, color, loading }: { value: string; label: string; color?: string; loading?: boolean }) {
  return (
    <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {loading ? <Skeleton.Title style={{ width: 60 }} /> : (
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.5rem', color: color ?? 'var(--ink)', letterSpacing: 1 }}>{value}</div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 'var(--sp-3) var(--sp-4)', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>{children}</td>;
}

function formatTokens(raw: string | number | null): string {
  if (raw == null) return '—';
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return String(raw);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function ProviderRow({ p, onEdit }: { p: LlmProvider; onEdit: () => void }) {
  const { s } = useLang();
  const qc = useQueryClient();
  const tripped = !!p.circuitOpenUntil && new Date(p.circuitOpenUntil) > new Date();

  const toggle = useMutation({
    mutationFn: () => api.post(`/api/admin/llm/providers/${encodeURIComponent(p.id)}/toggle`, { isEnabled: !p.isEnabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/llm/providers'] });
      toast.ok(p.isEnabled ? s('已停用', '已停用', 'Disabled') : s('已启用', '已啟用', 'Enabled'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const reset = useMutation({
    mutationFn: () => api.post(`/api/admin/llm/providers/${encodeURIComponent(p.id)}/reset-circuit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/llm/providers'] });
      toast.ok(s('熔断已重置', '熔斷已重置', 'Circuit reset'));
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const healthMap: Record<string, { color: string; label: string }> = {
    healthy:        { color: 'var(--sage-dark)',  label: '✓ healthy' },
    degraded:       { color: 'var(--gold-dark)',  label: '⚠ degraded' },
    down:           { color: 'var(--crimson)',    label: '✗ down' },
    quota_exceeded: { color: 'var(--crimson)',    label: '✗ quota' },
  };
  const h = healthMap[p.healthStatus] ?? healthMap.healthy!;

  return (
    <tr style={{ borderTop: '1px solid var(--border-light)' }}>
      <Td>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--ink)' }}>
          {p.displayName}
          <span style={{ marginLeft: 6, font: 'var(--text-caption)', color: 'var(--ink-4)', fontWeight: 400 }}>· {p.name}</span>
        </div>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', marginTop: 2 }}>{p.defaultModel}</div>
      </Td>
      <Td>
        <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: p.role === 'primary' ? 'var(--saffron-pale)' : p.role === 'fallback' ? 'var(--gold-pale)' : 'var(--border-light)', color: p.role === 'primary' ? 'var(--saffron-dark)' : p.role === 'fallback' ? 'var(--gold-dark)' : 'var(--ink-3)', font: 'var(--text-caption)', fontWeight: 700, letterSpacing: 1 }}>
          {p.role}
        </span>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', marginTop: 2 }}>P{p.priority}</div>
      </Td>
      <Td>
        <span style={{ color: h.color, font: 'var(--text-caption)', fontWeight: 700 }}>{h.label}</span>
        {tripped && (
          <div style={{ font: 'var(--text-caption)', color: 'var(--crimson)', marginTop: 2 }}>⚡ 熔断中</div>
        )}
      </Td>
      <Td>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>
          in ${p.inputCostPer1k.toFixed(4)}<br />
          out ${p.outputCostPer1k.toFixed(4)}
        </div>
      </Td>
      <Td>
        <div style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {p.monthlyTokenQuota
            ? <div>📅 {formatTokens(p.monthlyTokenQuota)} / {s('月', '月', 'mo')}</div>
            : <div style={{ color: 'var(--ink-4)' }}>— / {s('月', '月', 'mo')}</div>}
          {p.dailyRequestQuota != null
            ? <div>☀️ {p.dailyRequestQuota.toLocaleString()} {s('请求/日', '請求/日', 'req/d')}</div>
            : <div style={{ color: 'var(--ink-4)' }}>— {s('请求/日', '請求/日', 'req/d')}</div>}
          <div style={{ color: 'var(--ink-4)' }}>
            {p.rpmLimit != null ? `${p.rpmLimit} rpm` : '— rpm'}
            {' · '}
            {p.concurrencyLimit != null ? `${p.concurrencyLimit} ` + s('并发', '併發', 'conc') : '— ' + s('并发', '併發', 'conc')}
          </div>
        </div>
      </Td>
      <Td>
        <button
          type="button"
          role="switch"
          aria-checked={p.isEnabled}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate()}
          title={p.isEnabled ? s('停用', '停用', 'Disable') : s('启用', '啟用', 'Enable')}
          style={{
            width: 40, height: 22, borderRadius: 11,
            background: p.isEnabled ? 'var(--sage-dark)' : 'var(--border-light)',
            border: 'none', cursor: 'pointer', position: 'relative',
            transition: 'background var(--dur) var(--ease)',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: p.isEnabled ? 20 : 2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff',
            transition: 'left var(--dur) var(--ease)',
          }} />
        </button>
      </Td>
      <Td>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onEdit} style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 700 }}>
            {s('编辑', '編輯', 'Edit')}
          </button>
          {tripped && (
            <button
              type="button"
              onClick={async () => { (await confirmAsync({ title: s('重置熔断器？', '重置熔斷器？', 'Reset circuit?') })) && reset.mutate(); }}
              disabled={reset.isPending}
              style={{ background: 'transparent', border: 'none', color: 'var(--crimson)', cursor: 'pointer', font: 'var(--text-caption)', fontWeight: 700 }}
            >
              {reset.isPending ? '…' : s('重置', '重置', 'Reset')}
            </button>
          )}
        </div>
      </Td>
    </tr>
  );
}

interface ProviderFormProps {
  mode: 'create' | 'edit';
  initial?: LlmProvider;
  onDone: () => void;
}
function ProviderForm({ mode, initial, onDone }: ProviderFormProps) {
  const { s } = useLang();
  const qc = useQueryClient();

  const [name, setName] = useState(initial?.name ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [apiKeyEnv, setApiKeyEnv] = useState('');  // 安全：edit 时不回填 · 留空 = 不变
  const [defaultModel, setDefaultModel] = useState(initial?.defaultModel ?? '');
  const [role, setRole] = useState<LlmRole>(initial?.role ?? 'primary');
  const [priority, setPriority] = useState(initial?.priority ?? 100);
  const [inputCost, setInputCost] = useState(initial?.inputCostPer1k ?? 0);
  const [outputCost, setOutputCost] = useState(initial?.outputCostPer1k ?? 0);
  const [monthlyQuota, setMonthlyQuota] = useState<string>(initial?.monthlyTokenQuota ?? '');
  const [dailyReq, setDailyReq] = useState<string>(initial?.dailyRequestQuota?.toString() ?? '');
  const [rpm, setRpm] = useState<string>(initial?.rpmLimit?.toString() ?? '');
  const [conc, setConc] = useState<string>(initial?.concurrencyLimit?.toString() ?? '');
  const [overage, setOverage] = useState<OveragePolicy>(initial?.overagePolicy ?? 'stop');
  const [err, setErr] = useState('');

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      name: name.trim(),
      displayName: displayName.trim(),
      baseUrl: baseUrl.trim(),
      defaultModel: defaultModel.trim(),
      role,
      priority,
      inputCostPer1k: inputCost,
      outputCostPer1k: outputCost,
      overagePolicy: overage,
      monthlyTokenQuota: monthlyQuota.trim() ? Number(monthlyQuota) : null,
      dailyRequestQuota: dailyReq.trim() ? Number(dailyReq) : null,
      rpmLimit: rpm.trim() ? Number(rpm) : null,
      concurrencyLimit: conc.trim() ? Number(conc) : null,
    };
    if (apiKeyEnv.trim()) body.apiKeyEnv = apiKeyEnv.trim();
    return body;
  }

  const submit = useMutation({
    mutationFn: () => mode === 'create'
      ? api.post('/api/admin/llm/providers', buildBody())
      : api.patch(`/api/admin/llm/providers/${encodeURIComponent(initial!.id)}`, buildBody()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/admin/llm/providers'] });
      toast.ok(s('已保存', '已保存', 'Saved'));
      onDone();
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (mode === 'create' && !apiKeyEnv.trim()) {
      setErr(s('apiKeyEnv 必填', 'apiKeyEnv 必填', 'apiKeyEnv required'));
      return;
    }
    submit.mutate();
  }

  return (
    <form onSubmit={onSubmit} style={{ padding: 'var(--sp-2) 0 var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <Field label={s('内部名 (lowercase_underscore)', '內部名 (lowercase_underscore)', 'Name (lowercase_underscore)')} value={name} onChange={setName} required pattern="[a-z0-9_-]+" maxLength={64} />
        <Field label={s('显示名', '顯示名', 'Display name')} value={displayName} onChange={setDisplayName} required maxLength={120} />
      </div>
      <Field label={s('Base URL', 'Base URL', 'Base URL')} type="url" value={baseUrl} onChange={setBaseUrl} required maxLength={500} />
      <Field
        label={s(`API Key 环境变量名 (UPPER_SNAKE)${mode === 'edit' ? ' · 留空不变' : ''}`, `API Key 環境變數名 (UPPER_SNAKE)${mode === 'edit' ? ' · 留空不變' : ''}`, `API Key env (UPPER_SNAKE)${mode === 'edit' ? ' · empty = unchanged' : ''}`)}
        value={apiKeyEnv}
        onChange={setApiKeyEnv}
        pattern="[A-Z][A-Z0-9_]*"
        maxLength={100}
        placeholder={initial?.apiKeyEnvHint ?? 'CLAUDE_API_KEY'}
      />
      <Field label={s('默认模型', '默認模型', 'Default model')} value={defaultModel} onChange={setDefaultModel} required maxLength={120} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <div>
          <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>{s('角色', '角色', 'Role')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as LlmRole)} style={selectStyle}>
            <option value="primary">primary</option>
            <option value="fallback">fallback</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <Field label={s('优先级（小→前）', '優先級（小→前）', 'Priority (low first)')} type="number" value={String(priority)} onChange={(v) => setPriority(Number(v) || 100)} />
      </div>

      <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 700, marginTop: 'var(--sp-2)' }}>
        {s('成本（USD / 1k tokens）', '成本（USD / 1k tokens）', 'Cost (USD / 1k tokens)')}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <Field label={s('输入', '輸入', 'Input')} type="number" value={String(inputCost)} onChange={(v) => setInputCost(Number(v) || 0)} />
        <Field label={s('输出', '輸出', 'Output')} type="number" value={String(outputCost)} onChange={(v) => setOutputCost(Number(v) || 0)} />
      </div>

      <h3 style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 700, marginTop: 'var(--sp-2)' }}>
        {s('配额与限速', '配額與限速', 'Quotas & rate limits')}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <Field label={s('月度 token 配额', '月度 token 配額', 'Monthly token quota')} value={monthlyQuota} onChange={setMonthlyQuota} type="number" placeholder={s('留空 = 无限', '留空 = 無限', 'empty = unlimited')} />
        <Field label={s('日请求配额', '日請求配額', 'Daily request quota')} value={dailyReq} onChange={setDailyReq} type="number" />
        <Field label={s('RPM 限速', 'RPM 限速', 'RPM limit')} value={rpm} onChange={setRpm} type="number" />
        <Field label={s('并发限制', '並發限制', 'Concurrency')} value={conc} onChange={setConc} type="number" />
      </div>

      <div>
        <label style={{ display: 'block', font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>{s('超额策略', '超額策略', 'Overage policy')}</label>
        <select value={overage} onChange={(e) => setOverage(e.target.value as OveragePolicy)} style={selectStyle}>
          <option value="stop">{s('停用', '停用', 'stop')}</option>
          <option value="pay_as_you_go">{s('按量计费', '按量計費', 'pay_as_you_go')}</option>
          <option value="fallback">{s('降级到 fallback', '降級到 fallback', 'fallback')}</option>
        </select>
      </div>

      {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
        <button type="button" onClick={onDone} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
          {s('取消', '取消', 'Cancel')}
        </button>
        <button type="submit" disabled={submit.isPending} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          {submit.isPending ? '…' : mode === 'create' ? s('创建', '創建', 'Create') : s('保存', '保存', 'Save')}
        </button>
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--ink)',
  font: 'var(--text-body)',
  outline: 'none',
};

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
