// 题型 payload 工厂 / 校验 / 归一化 / 反归一化（6 题型 · 跨流程共享）
//
// 解决问题：之前 CoachQuestionNewPage 和 QuestionAdminInline 各有一份独立实现 ·
//   加新字段两处都要改 · 极易遗漏（如 fill mode 字段最初只加在一处）
//
// 现在唯一来源：所有创建/编辑/评分相关 shape 修改都在这里改 · 调用方 import
//
// shape 约定：
//   single/multi: { options: [{text, correct}], scoringMode? }
//   fill (typing 默认): { verseLines: [...含 ____ 占位], correctWord, mode: 'typing' }
//   fill (choice opt-in): { verseLines, correctWord, mode: 'choice', options: [string × ≥2] }
//   sort: { items: [{text, order: 1-based}] }（DB shape）
//   match: { left: [{id,text}], right: [{id,text,match}] }（DB shape）
//   open: { referenceAnswer, keyPoints: [{point, signals}], minLength, maxLength }
//   flip: { front, frontSub, back, backExample }
//   verse: { tokens: string[], distractors?: string[], hintText?: string }（DB shape）
//
// 编辑器中间状态 shape（仅用于 UI 控件 · normalize 时转 DB shape）：
//   sort: { itemsText: '行1\n行2' }  ← 单 textarea 编辑
//   match: { pairsText: 'A = B\nC = D' } ← 单 textarea 编辑
//   verse: { tokensText: '词1·词2·词3', distractorsText: '干扰1·干扰2', hintText: '...' } ← · 分隔
//   其他题型：编辑状态 = DB shape

import type { QuestionType } from './queries';

/** 新建题目时的初始 payload（编辑器中间状态 · 等用户填完用 normalize 转 DB） */
export function emptyPayload(t: QuestionType): Record<string, unknown> {
  switch (t) {
    case 'single':
    case 'multi':
      return { options: [{ text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }] };
    case 'fill':
      // 默认 typing · options 留空（typing 不要求 options）
      return { verseLines: [''], correctWord: '', options: ['', '', '', ''], verseSource: '', mode: 'typing' };
    case 'sort':
      return { itemsText: '' };
    case 'open':
      return { referenceAnswer: '', keyPoints: [{ point: '', signals: '' }], minLength: 80, maxLength: 400 };
    case 'match':
      return { pairsText: '' };
    case 'flip':
      return { front: '', frontSub: '', back: '', backExample: '' };
    case 'verse':
      return { tokensText: '', distractorsText: '', hintText: '' };
    default:
      return {};
  }
}

/** 编辑器状态校验 · 不通过则禁用提交按钮 */
export function validatePayload(t: QuestionType, p: Record<string, unknown>): boolean {
  switch (t) {
    case 'single': {
      const opts = (p.options as { text: string; correct: boolean }[]) ?? [];
      return opts.filter((o) => o.text.trim()).length >= 2 && opts.filter((o) => o.correct && o.text.trim()).length === 1;
    }
    case 'multi': {
      const opts = (p.options as { text: string; correct: boolean }[]) ?? [];
      return opts.filter((o) => o.text.trim()).length >= 3 && opts.filter((o) => o.correct && o.text.trim()).length >= 2;
    }
    case 'fill': {
      const lines = (p.verseLines as string[]) ?? [];
      const opts = (p.options as string[]) ?? [];
      const correctWord = (p.correctWord as string).trim();
      const hasBlank = lines.some((l) => l.includes('___')) || lines.some((l) => l.includes(correctWord));
      const mode = (p.mode as string | undefined) === 'choice' ? 'choice' : 'typing';
      if (!hasBlank || correctWord.length === 0) return false;
      if (mode === 'choice') return opts.filter((o) => o.trim()).length >= 2;
      return true; // typing 模式 · 仅需 verse + correctWord
    }
    case 'open': {
      const kps = (p.keyPoints as { point: string }[]) ?? [];
      return (p.referenceAnswer as string).trim().length >= 10 && kps.filter((k) => k.point.trim()).length >= 1;
    }
    case 'sort': {
      const lines = ((p.itemsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.length >= 2;
    }
    case 'match': {
      const lines = ((p.pairsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.length >= 2 && lines.every((l) => l.includes('='));
    }
    case 'flip': {
      return (p.front as string).trim().length > 0 && (p.back as string).trim().length > 0;
    }
    case 'verse': {
      const tokens = parseVerseTokens((p.tokensText as string) ?? '');
      // 至少 2 词 · 上限 30（颂词 UI 一屏上限）
      return tokens.length >= 2 && tokens.length <= 30;
    }
    default:
      return false;
  }
}

/** 颂词词块切分 · 支持 · / 中点 / 换行 / 顿号 / 多个空格 多种分隔 */
function parseVerseTokens(text: string): string[] {
  return text
    .split(/[·•、\n\r]+|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 编辑器状态 → DB 入库 shape · 提交前调 */
export function normalizePayload(t: QuestionType, p: Record<string, unknown>): Record<string, unknown> {
  switch (t) {
    case 'single':
      return {
        options: ((p.options as { text: string; correct: boolean }[]) ?? [])
          .filter((o) => o.text.trim())
          .map((o) => ({ text: o.text.trim(), correct: !!o.correct })),
      };
    case 'multi':
      return {
        options: ((p.options as { text: string; correct: boolean }[]) ?? [])
          .filter((o) => o.text.trim())
          .map((o) => ({ text: o.text.trim(), correct: !!o.correct })),
        scoringMode: 'partial',
      };
    case 'fill': {
      const lines = ((p.verseLines as string[]) ?? []).map((l) => l.trim()).filter(Boolean);
      const opts = ((p.options as string[]) ?? []).map((o) => o.trim()).filter(Boolean);
      const mode = (p.mode as string | undefined) === 'choice' ? 'choice' : 'typing';
      const out: Record<string, unknown> = {
        verseLines: lines,
        correctWord: (p.correctWord as string).trim(),
        mode,
      };
      if (mode === 'choice') out.options = opts;
      const verseSource = (p.verseSource as string | undefined ?? '').trim();
      if (verseSource) out.verseSource = verseSource;
      return out;
    }
    case 'sort': {
      const lines = ((p.itemsText as string) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      return { items: lines.map((text, i) => ({ text, order: i + 1 })) };
    }
    case 'open':
      return {
        referenceAnswer: (p.referenceAnswer as string).trim(),
        keyPoints: ((p.keyPoints as { point: string; signals: string }[]) ?? [])
          .filter((k) => k.point.trim())
          .map((k) => ({
            point: k.point.trim(),
            signals: k.signals.split(',').map((s) => s.trim()).filter(Boolean),
          })),
        minLength: Number(p.minLength) || 80,
        maxLength: Number(p.maxLength) || 400,
      };
    case 'match': {
      // 'A = B\nC = D' → { left: [{id,text}], right: [{id,text,match}] }
      const pairs = ((p.pairsText as string) ?? '')
        .split('\n').map((l) => l.trim()).filter(Boolean)
        .map((l) => {
          const [a, b] = l.split('=').map((s) => s.trim());
          return { a: a ?? '', b: b ?? '' };
        }).filter((x) => x.a && x.b);
      return {
        left: pairs.map((p, i) => ({ id: 'L' + i, text: p.a })),
        right: pairs.map((p, i) => ({ id: 'R' + i, text: p.b, match: 'L' + i })),
      };
    }
    case 'flip':
      return {
        front: (p.front as string).trim(),
        frontSub: (p.frontSub as string).trim(),
        back: (p.back as string).trim(),
        backExample: (p.backExample as string).trim(),
      };
    case 'verse': {
      const tokens = parseVerseTokens((p.tokensText as string) ?? '');
      const distractors = parseVerseTokens((p.distractorsText as string) ?? '');
      const hintText = (p.hintText as string | undefined ?? '').trim();
      const out: Record<string, unknown> = { tokens };
      if (distractors.length > 0) out.distractors = distractors;
      if (hintText) out.hintText = hintText;
      return out;
    }
    default:
      return p;
  }
}

/** DB shape → 编辑器中间状态 · 编辑已有题时调（normalize 的反函数 · 用于 round-trip） */
export function denormalizePayload(t: QuestionType, p: unknown): Record<string, unknown> {
  const payload = (p ?? {}) as Record<string, unknown>;
  switch (t) {
    case 'sort': {
      const items = (payload.items as Array<{ text: string; order?: number }> | undefined) ?? [];
      const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { itemsText: sorted.map((it) => it.text).join('\n') };
    }
    case 'match': {
      const left = (payload.left as Array<{ id: string; text: string }> | undefined) ?? [];
      const right = (payload.right as Array<{ id: string; text: string; match?: string }> | undefined) ?? [];
      const lines = left.map((l) => {
        const r = right.find((x) => x.match === l.id);
        return r ? `${l.text} = ${r.text}` : l.text;
      });
      return { pairsText: lines.join('\n') };
    }
    case 'verse': {
      const tokens = (payload.tokens as string[] | undefined) ?? [];
      const distractors = (payload.distractors as string[] | undefined) ?? [];
      return {
        tokensText: tokens.join(' · '),
        distractorsText: distractors.join(' · '),
        hintText: (payload.hintText as string | undefined) ?? '',
      };
    }
    default:
      // single / multi / fill / open / flip · DB shape 即编辑器 shape
      return payload;
  }
}
