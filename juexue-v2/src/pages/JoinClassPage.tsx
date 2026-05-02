// JoinClassPage · /join-class
//   通过加入码加入班级
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Field from '@/components/Field';
import TopNav from '@/components/TopNav';
import { api, ApiError } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { toast } from '@/lib/toast';

export default function JoinClassPage() {
  const { s } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const join = useMutation({
    mutationFn: (joinCode: string) => api.post<{ class: { id: string } }>('/api/classes/join', { joinCode }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['/api/my/classes'] });
      toast.ok(s('已加入班级', '已加入班級', 'Joined'));
      nav(`/class/${encodeURIComponent(r.class.id)}`, { replace: true });
    },
    onError: (e) => setErr((e as ApiError).message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const c = code.trim();
    if (!c) {
      setErr(s('请输入加入码', '請輸入加入碼', 'Enter join code'));
      return;
    }
    join.mutate(c);
  }

  return (
    <div>
      <TopNav titles={['加入班级', '加入班級', 'Join Class']} />

      <div style={{ padding: 'var(--sp-5)' }}>
        <div style={{ textAlign: 'center', padding: 'var(--sp-5) 0 var(--sp-6)' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: 'var(--sp-2)' }}>📚</div>
          <p style={{ font: 'var(--text-body)', color: 'var(--ink-2)', letterSpacing: 1, lineHeight: 1.6 }}>
            {s('输入辅导员发的加入码', '輸入輔導員發的加入碼', 'Enter join code from your coach')}
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Field
            label={s('加入码', '加入碼', 'Join code')}
            value={code}
            onChange={setCode}
            placeholder="ABCD-1234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          {err && <p style={{ color: 'var(--crimson)', font: 'var(--text-caption)' }}>{err}</p>}
          <button
            type="submit"
            disabled={join.isPending}
            className="btn btn-primary btn-pill btn-full"
            style={{ padding: 12, justifyContent: 'center', marginTop: 'var(--sp-2)' }}
          >
            {join.isPending ? s('加入中…', '加入中…', 'Joining…') : s('加入', '加入', 'Join')}
          </button>
        </form>
      </div>
    </div>
  );
}
