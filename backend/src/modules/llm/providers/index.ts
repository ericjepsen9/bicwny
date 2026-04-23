// Provider 注册表
// Gateway 以 LlmProviderConfig.name 为键查找实现；
// 新增 provider 只需在此表加一行。
import { Internal } from '../../../lib/errors.js';
import { claudeProvider } from './claude.js';
import { minimaxProvider } from './minimax.js';
import type { ChatProvider } from './types.js';

export const PROVIDERS: Readonly<Record<string, ChatProvider>> = Object.freeze({
  minimax: minimaxProvider,
  claude: claudeProvider,
});

export function getProvider(name: string): ChatProvider {
  const p = PROVIDERS[name];
  if (!p) throw Internal(`未知 LLM provider: ${name}`);
  return p;
}

export function listProviders(): ChatProvider[] {
  return Object.values(PROVIDERS);
}

export type { ChatProvider, ChatRequest, ChatResponse, ChatMessage } from './types.js';
