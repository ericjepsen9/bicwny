// LLM 供应商统一接口
// 所有具体实现（MiniMax、Claude…）都实现 ChatProvider，
// Gateway 只依赖本接口，替换供应商不改调用侧。

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** 用于上游请求去重 / 追踪，由 Gateway 生成 */
  requestId?: string;
  /** 单次请求超时（毫秒），供 http 层使用 */
  timeoutMs?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** 由 provider 返回的原始 requestId / traceId（可选） */
  upstreamId?: string;
  /** 结束原因：stop / length / content_filter / error_fallback… */
  finishReason?: string;
}

export interface ChatProvider {
  /** 对应 LlmProviderConfig.name（'minimax' | 'claude' …） */
  readonly name: string;
  /** 本 provider 是否已配置必要凭证（无 API Key 视为不可用） */
  isConfigured(): boolean;
  /** 发起一次 chat 调用；失败请抛出（Gateway 会捕获并切兜底） */
  chat(req: ChatRequest): Promise<ChatResponse>;
}
