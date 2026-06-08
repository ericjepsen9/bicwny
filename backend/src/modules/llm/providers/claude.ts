// Anthropic Messages API 适配
// 注意：Claude 的 messages 只允许 user/assistant；
// system 指令必须单独放在顶层 system 字段。
import { config } from '../../../lib/config.js';
import { UpstreamError } from '../../../lib/errors.js';
import { postJson } from './http.js';
import type { ChatMessage, ChatProvider, ChatRequest, ChatResponse } from './types.js';

interface ClaudeResponse {
  id?: string;
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeProvider implements ChatProvider {
  readonly name = 'claude';

  isConfigured(): boolean {
    return Boolean(config.ANTHROPIC_API_KEY);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw UpstreamError('Claude 未配置 API Key');
    }

    const { system, messages } = splitSystem(req.messages);
    const startedAt = Date.now();

    const resp = await postJson<ClaudeResponse>(
      ANTHROPIC_URL,
      {
        model: req.model || config.ANTHROPIC_MODEL,
        max_tokens: req.maxTokens ?? 1500,
        temperature: req.temperature ?? 0.3,
        ...(system ? { system } : {}),
        messages,
      },
      {
        headers: {
          'x-api-key': config.ANTHROPIC_API_KEY!,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        timeoutMs: req.timeoutMs,
      },
    );

    if (resp.error) {
      throw UpstreamError(
        `Claude 业务错误: ${resp.error.message ?? 'unknown'}`,
        { type: resp.error.type },
      );
    }

    const content = (resp.content ?? [])
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text)
      .join('');
    if (!content) {
      throw UpstreamError('Claude 返回内容为空', { raw: resp });
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

type ClaudeMsg = { role: 'user' | 'assistant'; content: string };

function splitSystem(messages: ChatMessage[]): { system?: string; messages: ClaudeMsg[] } {
  const systems: string[] = [];
  const rest: ClaudeMsg[] = [];
  for (const m of messages) {
    if (m.role === 'system') systems.push(m.content);
    else rest.push({ role: m.role, content: m.content });
  }
  return {
    system: systems.length > 0 ? systems.join('\n\n') : undefined,
    messages: rest,
  };
}

export const claudeProvider = new ClaudeProvider();
