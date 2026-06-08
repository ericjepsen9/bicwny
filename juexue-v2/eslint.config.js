// 觉学 v2 · ESLint flat config
// 重点：抓住「我们实际踩过坑」的规则
//   1. react-hooks/rules-of-hooks → React #310（hooks 顺序）
//   2. react-hooks/exhaustive-deps → effect 依赖缺失（stale closure 幽灵 bug）
//   3. no-unused-vars → 未使用变量（之前 mode 变量漏删）
//   4. prefer-const / no-var → JS 基础卫生
//
// 用法：npm run lint
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // 全局忽略
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'ios/**', '**/*.d.ts'],
  },

  // 基础 JS 规则
  js.configs.recommended,

  // TypeScript 规则
  ...tseslint.configs.recommended,

  // React + Hooks 规则
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2024 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── ERROR · 关键防线（我们踩过坑 · 必须挡住） ──
      'react-hooks/rules-of-hooks': 'error',         // hook 不能在条件 / 循环里调（防 React #310）← 这次 MeditationPlayerPage 就栽过
      'react/jsx-key': 'error',                      // 数组 render 必须 key
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-react': 'off',                 // React 17+ 不需要 import React
      'react/react-in-jsx-scope': 'off',

      // ── WARN · 提醒级（现有代码已存在 · 不阻塞 · 新增的会冒红线） ──
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unknown-property': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',

      // ── OFF · 项目风格冲突的关掉 ──
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
