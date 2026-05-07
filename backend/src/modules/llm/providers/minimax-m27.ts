// MiniMax M2.7 适配 · 走 MiniMax 的 Anthropic 兼容 endpoint
//   - endpoint: https://api.minimax.io/anthropic/v1/messages
//   - auth: x-api-key: <sk-cp-...> (Token Plan key)
//   - 请求体格式与 Anthropic Messages API 100% 兼容
// 区别于 claude.ts：URL 不同 + key 走单独 env 变量 MINIMAX_M27_API_KEY
//
// 命名 minimax-m27 与 DB LlmProviderConfig.name 对齐
import { config } from '../../../lib/config.js';
import { UpstreamError } from '../../../lib/errors.js';
import { postJson } from './http.js';
import type { ChatMessage, ChatProvider, ChatRequest, ChatResponse } from './types.js';

interface AnthropicResponse {
  id?: string;
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

const ANTHROPIC_VERSION = '2023-06-01';
const MINIMAX_M27_URL = 'https://api.minimax.io/anthropic/v1/messages';

export class MinimaxM27Provider implements ChatProvider {
  readonly name = 'minimax-m27';

  isConfigured(): boolean {
    return Boolean(config.MINIMAX_M27_API_KEY);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw UpstreamError('MiniMax M2.7 未配置 API Key');
    }

    const { system, messages } = splitSystem(req.messages);
    const startedAt = Date.now();

    const resp = await postJson<AnthropicResponse>(
      MINIMAX_M27_URL,
      {
        model: req.model || 'MiniMax-M2.7',
        max_tokens: req.maxTokens ?? 1500,
        temperature: req.temperature ?? 0.3,
        ...(system ? { system } : {}),
        messages,
      },
      {
        headers: {
          'x-api-key': config.MINIMAX_M27_API_KEY!,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        timeoutMs: req.timeoutMs,
      },
    );

    if (resp.error) {
      throw UpstreamError(
        `MiniMax M2.7 业务错误: ${resp.error.message ?? 'unknown'}`,
        { type: resp.error.type },
      );
    }

    const content = (resp.content ?? [])
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text)
      .join('');
    if (!content) {
      throw UpstreamError('MiniMax M2.7 返回内容为空', { raw: resp });
    }

    return {
      content,
      model: resp.model ?? req.model,
      inputTokens: resp.usage?.input_tokens ?? 0,
      outputTokens: resp.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
      upstreamId: resp.id,
      finishReason: resp.stop_reason,
    };
  }
}

type AnthropicMsg = { role: 'user' | 'assistant'; content: string };

function splitSystem(messages: ChatMessage[]): { system?: string; messages: AnthropicMsg[] } {
  const systems: string[] = [];
  const rest: AnthropicMsg[] = [];
  for (const m of messages) {
    if (m.role === 'system') systems.push(m.content);
    else rest.push({ role: m.role, content: m.content });
  }
  return {
    system: systems.length > 0 ? systems.join('\n\n') : undefined,
    messages: rest,
  };
}

export const minimaxM27Provider = new MinimaxM27Provider();
