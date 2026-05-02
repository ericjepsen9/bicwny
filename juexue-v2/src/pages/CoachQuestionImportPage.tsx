// CoachQuestionImportPage · /coach/questions/import
//   JSON 粘贴批量导入 ≤ 200 条 · partial 模式（单条失败不中断整批）
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

interface BatchResult {
  ok: number;
  failed: number;
  items: Array<{
    index: number;
    success: boolean;
    id?: string;
    error?: string;
  }>;
}

const SAMPLE = `[
  {
    "courseId": "<courseId>",
    "chapterId": "<chapterId>",
    "lessonId": "<lessonId>",
    "type": "single",
    "visibility": "class_private",
    "questionText": "下列哪一项是菩提心的本质？",
    "correctText": "为度化一切众生愿成佛的心",
    "wrongText": "",
    "source": "《入菩萨行论》第一品",
    "difficulty": 2,
    "tags": ["菩提心"],
    "payload": {
      "options": [
        { "text": "为度化一切众生愿成佛的心", "correct": true },
        { "text": "求自身解脱的心", "correct": false },
        { "text": "对法的恭敬心", "correct": false },
        { "text": "厌离轮回的心", "correct": false }
      ]
    }
  }
]`;

export default function CoachQuestionImportPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [text, setText] = useState('');
  const [partial, setPartial] = useState(true);
  const [result, setResult] = useState<BatchResult | null>(null);

  // 实时解析状态
  const parsed = useMemo<{ ok: boolean; count: number; err?: string; items?: unknown[] }>(() => {
    if (!text.trim()) return { ok: false, count: 0 };
    try {
      const j = JSON.parse(text);
      if (!Array.isArray(j)) return { ok: false, count: 0, err: 'JSON 必须是数组' };
      if (j.length === 0) return { ok: false, count: 0, err: '数组为空' };
      if (j.length > 200) return { ok: false, count: j.length, err: '超过 200 条上限' };
      return { ok: true, count: j.length, items: j };
    } catch (e) {
      return { ok: false, count: 0, err: (e as Error).message };
    }
  }, [text]);

  const submit = useMutation({
    mutationFn: () => api.post<BatchResult>('/api/coach/questions/batch', {
      partial,
      items: parsed.items,
    }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ['/api/coach/questions'] });
      if (r.failed === 0) {
        toast.ok(s(`已成功导入 ${r.ok} 条`, `已成功匯入 ${r.ok} 條`, `Imported ${r.ok}`));
      } else {
        toast.warn(s(`成功 ${r.ok} · 失败 ${r.failed}`, `成功 ${r.ok} · 失敗 ${r.failed}`, `${r.ok} ok · ${r.failed} failed`));
      }
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">{s('批量导入', '批量匯入', 'Batch import')}</h1>
          <p className="page-sub">{s('粘贴 JSON · 一次最多 200 条', '貼上 JSON · 一次最多 200 條', 'Paste JSON · ≤ 200 items')}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ padding: '8px 14px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            {s('返回', '返回', 'Back')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sp-4)', maxWidth: 880 }}>
        <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
            <label style={{ font: 'var(--text-caption)', color: 'var(--ink-3)', letterSpacing: 1.5, fontWeight: 700 }}>
              {s('JSON 题目数组', 'JSON 題目數組', 'JSON array')}
            </label>
            <button type="button" onClick={() => setText(SAMPLE)} style={{ background: 'transparent', border: 'none', color: 'var(--saffron-dark)', font: 'var(--text-caption)', letterSpacing: 1, cursor: 'pointer' }}>
              {s('插入示例', '插入示例', 'Sample')}
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            placeholder={SAMPLE}
            spellCheck={false}
            style={{
              width: '100%', padding: 'var(--sp-3) var(--sp-4)',
              borderRadius: 'var(--r)', border: '1px solid var(--border)',
              background: 'var(--bg-input)', color: 'var(--ink)',
              fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', lineHeight: 1.5,
              outline: 'none', resize: 'vertical',
            }}
          />

          <div style={{ marginTop: 'var(--sp-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <span style={{
              font: 'var(--text-caption)',
              color: parsed.err ? 'var(--crimson)' : parsed.ok ? 'var(--sage-dark)' : 'var(--ink-3)',
              letterSpacing: 1,
            }}>
              {!text.trim() ? s('待粘贴 JSON', '待貼上 JSON', 'Awaiting JSON')
                : parsed.err ? '❌ ' + parsed.err
                : `✓ ${s('已识别', '已識別', 'Parsed')} ${parsed.count} ${s('条', '條', 'items')}`}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: 'var(--text-caption)', color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
              {s('partial 模式（单条失败不中断）', 'partial 模式（單條失敗不中斷）', 'partial mode (skip failures)')}
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-pill" style={{ flex: 1, padding: 12, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
            {s('取消', '取消', 'Cancel')}
          </button>
          <button
            type="button"
            disabled={!parsed.ok || submit.isPending}
            onClick={() => { setResult(null); submit.mutate(); }}
            className="btn btn-primary btn-pill"
            style={{ flex: 2, padding: 12, justifyContent: 'center', opacity: parsed.ok ? 1 : 0.5 }}
          >
            {submit.isPending ? '…' : s(`提交 ${parsed.count} 条`, `提交 ${parsed.count} 條`, `Submit ${parsed.count}`)}
          </button>
        </div>

        {result && (
          <div className="glass-card-thick" style={{ padding: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', letterSpacing: 2 }}>
                {s('结果', '結果', 'Result')}
              </h2>
              <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>✓ {result.ok}</span>
              {result.failed > 0 && <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 700 }}>✗ {result.failed}</span>}
            </div>

            {result.items.length > 0 && (
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.items.map((it) => (
                  <div key={it.index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '6px 10px', background: it.success ? 'rgba(125,154,108,.08)' : 'rgba(192,57,43,.08)', borderRadius: 'var(--r-sm)', borderLeft: '3px solid ' + (it.success ? 'var(--sage-dark)' : 'var(--crimson)') }}>
                    <span style={{ font: 'var(--text-caption)', color: 'var(--ink-4)', minWidth: 36 }}>#{it.index + 1}</span>
                    <span style={{ font: 'var(--text-caption)', color: it.success ? 'var(--sage-dark)' : 'var(--crimson)', fontWeight: 700, minWidth: 24 }}>
                      {it.success ? '✓' : '✗'}
                    </span>
                    {it.success && it.id ? (
                      <code style={{ font: 'var(--text-caption)', color: 'var(--ink-3)' }}>{it.id.slice(0, 12)}</code>
                    ) : (
                      <span style={{ flex: 1, font: 'var(--text-caption)', color: 'var(--crimson)' }}>{it.error || s('未知错误', '未知錯誤', 'Unknown error')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <button type="button" onClick={() => nav('/coach/questions')} className="btn btn-primary btn-pill" style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
                {s('返回题库', '返回題庫', 'Back to questions')}
              </button>
              {result.failed > 0 && (
                <button type="button" onClick={() => setResult(null)} className="btn btn-pill" style={{ flex: 1, padding: 10, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', justifyContent: 'center' }}>
                  {s('再试', '再試', 'Try again')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
