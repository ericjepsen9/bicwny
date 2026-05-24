// MiniMax chatcompletion_v2 适配（OpenAI 兼容格式）
// Endpoint：POST {baseUrl}/text/chatcompletion_v2
// 业务错误：HTTP 200 但 base_resp.status_code != 0 也视为失败
import { config } from '../../../lib/config.js';
import { UpstreamError } from '../../../lib/errors.js';
import { postJson } from './http.js';
import type { ChatProvider, ChatRequest, ChatResponse } from './types.js';

interface MiniMaxResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  base_resp?: { status_code?: number; status_msg?: string };
}

export class MiniMaxProvider implements ChatProvider {
  readonly name = 'minimax';

  isConfigured(): boolean {
    return Boolean(config.MINIMAX_API_KEY);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured()) {
      throw UpstreamError('MiniMax 未配置 API Key');
    }

    const url = `${config.MINIMAX_BASE_URL.replace(/\/+$/, '')}/text/chatcompletion_v2`;
    const startedAt = Date.now();

    const resp = await postJson<MiniMaxResponse>(
      url,
      {
        model: req.model || config.MINIMAX_MODEL,
        messages: req.messages,
        temperature: req.temperature ?? 0.3,
        max_tokens: req.maxTokens ?? 1500,
      },
      {
        headers: { authorization: `Bearer ${config.MINIMAX_API_KEY}` },
        timeoutMs: req.timeoutMs,
      },
    );

    if (resp.base_resp?.status_code && resp.base_resp.status_code !== 0) {
      throw UpstreamError(
        `MiniMax 业务错误: ${resp.base_resp.status_msg ?? 'unknown'}`,
        { code: resp.base_resp.status_code },
      );
    }

    const content = resp.choices?.[0]?.message?.content ?? '';
    if (!content) {
      throw UpstreamError('MiniMax 返回内容为空', { raw: resp });
    }

    return {
      content,
      model: resp.model ?? req.model,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
      upstreamId: resp.id,
      finishReason: resp.choices?.[0]?.finish_reason,
    };
  }
}

export const minimaxProvider = new MiniMaxProvider();
