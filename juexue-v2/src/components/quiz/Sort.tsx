// 排序题 · payload { items:[{text,order}] · order 是正确顺序 1-based }
//
// 交互：click-to-rank
//   1. 用户看到打乱后的固定列表（位置不变）
//   2. 点击未排序的项 → 自动标当前序号（已选数 + 1）
//   3. 点击已排序的项 → 取消该序号 · 后续项序号自动减 1
//   4. 全部排完 → 可提交
//
// 提交格式：{ order: number[] }（与 backend grading.objective.ts gradeSort 严格一致）
//   - order[i] = 用户认为应排第 i+1 位的「原始 items 数组下标」（不是 shuffled 下标！）
//   - 例：原 items = [A(order=2), B(order=1), C(order=3)]
//     用户排 B → A → C（正确）· 提交 { order: [1, 0, 2] }（B 在原数组 idx=1, A=0, C=2）
//   - 后端 items[order[i]].order === i+1 全成立得 100
//
// confirmed 后渲染：
//   - 用户排名 vs 正确排名 (从 payload.items[].order 读 · publicView 在 grade 后会
//     把完整 payload 回填进 displayQuestion · order 字段可用)
//   - 正确：✓ 绿色
//   - 错误：✗ 红色 + '应排第 N 位'
import { useEffect, useMemo, useState } from 'react';
import type { QuestionRendererProps } from './types';

interface OrigItem { text: string; order?: number }

function shuffleIdx(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default function Sort({ question, value, onChange, confirmed }: QuestionRendererProps) {
  const items = (question.payload.items as OrigItem[] | undefined) ?? [];

  // 打乱后的显示顺序 · 一旦生成不再变（unless items 数变）· 保存的是原 items 的下标
  const shuffledOrigIdx = useMemo(() => shuffleIdx(items.length), [items.length]);

  // ranks: shuffled 显示位置 → 用户给的排名 (1-based · 0 = 未排)
  // value.order = 用户排名顺序的原 items 下标数组（提交给后端用的格式）
  const initialRanks = useMemo<number[]>(() => {
    const ord = (value as { order?: number[] } | null)?.order;
    if (!Array.isArray(ord) || ord.length === 0) return new Array(items.length).fill(0);
    // 反推 ranks · ord[r-1] = origIdx · 找 origIdx 在 shuffled 的位置
    const ranks = new Array(items.length).fill(0);
    ord.forEach((origIdx, r) => {
      const pos = shuffledOrigIdx.indexOf(origIdx);
      if (pos >= 0) ranks[pos] = r + 1;
    });
    return ranks;
  }, [items.length, shuffledOrigIdx, value]);

  const [ranks, setRanks] = useState<number[]>(initialRanks);

  // ranks 改变时同步 onChange
  useEffect(() => {
    // ord[r-1] = 排第 r 位的原 items 下标
    const assigned = ranks
      .map((rank, displayPos) => ({ rank, origIdx: shuffledOrigIdx[displayPos]! }))
      .filter((x) => x.rank > 0)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.origIdx);
    onChange({ order: assigned });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranks]);

  function clickItem(displayPos: number) {
    if (confirmed) return;
    const cur = ranks[displayPos]!;
    const next = [...ranks];
    if (cur > 0) {
      // 取消该项排名 · 后续 > cur 的项排名 -1
      next[displayPos] = 0;
      for (let i = 0; i < next.length; i++) {
        if (i !== displayPos && next[i]! > cur) next[i] = next[i]! - 1;
      }
    } else {
      // 新增排名 = 当前已排数 + 1
      const used = ranks.filter((r) => r > 0).length;
      next[displayPos] = used + 1;
    }
    setRanks(next);
  }

  function clearAll() {
    if (confirmed) return;
    setRanks(new Array(items.length).fill(0));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {shuffledOrigIdx.map((origIdx, displayPos) => {
        const it = items[origIdx]!;
        const userRank = ranks[displayPos]!;
        const correctOrder = it.order; // confirmed 后从完整 payload 拿
        const isCorrect = confirmed && userRank > 0 && correctOrder !== undefined && userRank === correctOrder;
        const isWrong = confirmed && userRank > 0 && correctOrder !== undefined && userRank !== correctOrder;

        return (
          <button
            type="button"
            key={`${it.text}-${origIdx}`}
            onClick={() => clickItem(displayPos)}
            disabled={confirmed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: confirmed
                ? isCorrect ? 'rgba(125,154,108,.12)' : isWrong ? 'rgba(192,57,43,.08)' : 'var(--glass-thick)'
                : userRank > 0 ? 'var(--saffron-pale)' : 'var(--glass-thick)',
              border: '1px solid ' + (confirmed
                ? isCorrect ? 'var(--sage-dark)' : isWrong ? 'var(--crimson)' : 'var(--glass-border)'
                : userRank > 0 ? 'var(--saffron-light)' : 'var(--glass-border)'),
              borderRadius: 'var(--r-lg)',
              cursor: confirmed ? 'default' : 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'all .15s var(--ease)',
            }}
          >
            {/* 序号圈 · 未点空圆 · 点了显示数字 · 答错显示用户的数字（红） */}
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: '0.95rem',
                background: userRank > 0
                  ? (confirmed
                      ? isCorrect ? 'var(--sage-dark)' : 'var(--crimson)'
                      : 'var(--saffron-dark)')
                  : 'transparent',
                color: userRank > 0 ? '#fff' : 'var(--ink-4)',
                border: userRank > 0 ? 'none' : '1px dashed var(--ink-4)',
                flexShrink: 0,
              }}
            >
              {userRank > 0 ? userRank : ''}
            </span>

            <span style={{ flex: 1, font: 'var(--text-body)', color: 'var(--ink)', lineHeight: 1.6 }}>
              {it.text}
            </span>

            {/* confirmed 错误时显示正确顺序 */}
            {confirmed && isWrong && correctOrder !== undefined && (
              <span style={{ font: 'var(--text-caption)', color: 'var(--crimson)', fontWeight: 600 }}>
                {`应排第 ${correctOrder} 位`}
              </span>
            )}
            {confirmed && isCorrect && (
              <span style={{ font: 'var(--text-caption)', color: 'var(--sage-dark)', fontWeight: 700 }}>
                ✓
              </span>
            )}
          </button>
        );
      })}

      {/* 编辑模式 · 清除按钮 */}
      {!confirmed && ranks.some((r) => r > 0) && (
        <button
          type="button"
          onClick={clearAll}
          style={{
            alignSelf: 'flex-end',
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-pill)',
            color: 'var(--ink-3)',
            font: 'var(--text-caption)',
            cursor: 'pointer',
          }}
        >
          清除排序
        </button>
      )}
    </div>
  );
}
