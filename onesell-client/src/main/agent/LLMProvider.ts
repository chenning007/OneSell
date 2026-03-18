/**
 * LLMProvider — Market-aware LLM abstraction (P1, P4).
 * Relocated from onesell-backend for v2 client-only architecture.
 *
 * v2: API key comes from ApiKeyManager (safeStorage), not server env.
 * Key is NEVER logged or exposed (P1).
 */

// ── Types ───────────────────────────────────────────────────────────

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string; // JSON string
}

export interface LLMResponse {
  readonly content: string;
  readonly toolCalls?: ToolCall[];
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
}

export interface ChatOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly tools?: readonly FunctionDef[];
}

export interface FunctionDef {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

// ── Abstract interface ──────────────────────────────────────────────

export interface LLMProvider {
  readonly providerId: string;
  chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<LLMResponse>;
}

// ── OpenAI Response types ───────────────────────────────────────────

interface OpenAIToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface OpenAIChoice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

// ── Shared helpers ──────────────────────────────────────────────────

function formatMessage(m: ChatMessage): Record<string, unknown> {
  const msg: Record<string, unknown> = { role: m.role, content: m.content };
  if (m.name) msg.name = m.name;
  if (m.toolCallId) msg.tool_call_id = m.toolCallId;
  return msg;
}

function parseOpenAIResponse(data: OpenAIResponse): LLMResponse {
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error('No response choices from LLM');
  }

  const toolCalls = choice.message.tool_calls?.map(tc => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    content: choice.message.content ?? '',
    toolCalls: toolCalls?.length ? toolCalls : undefined,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

// ── OpenAI Provider ─────────────────────────────────────────────────

export class OpenAIProvider implements LLMProvider {
  readonly providerId = 'openai';
  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    if (!apiKey) throw new Error('OpenAI API key is required');
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl;
  }

  async chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    const model = options?.model ?? 'gpt-4o';
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => formatMessage(m)),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools?.length) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const response = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data = await response.json() as OpenAIResponse;
    return parseOpenAIResponse(data);
  }
}

// ── Qwen Provider (China market) ────────────────────────────────────

export class QwenProvider implements LLMProvider {
  readonly providerId = 'qwen';
  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1') {
    if (!apiKey) throw new Error('Qwen API key is required');
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl;
  }

  async chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    const model = options?.model ?? 'qwen-plus';
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => formatMessage(m)),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools?.length) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const response = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qwen API error ${response.status}: ${text}`);
    }

    const data = await response.json() as OpenAIResponse;
    return parseOpenAIResponse(data);
  }
}

// ── DeepSeek Provider (China market) ────────────────────────────────

export class DeepSeekProvider implements LLMProvider {
  readonly providerId = 'deepseek';
  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.deepseek.com/v1') {
    if (!apiKey) throw new Error('DeepSeek API key is required');
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl;
  }

  async chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    const model = options?.model ?? 'deepseek-chat';
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => formatMessage(m)),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools?.length) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const response = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${text}`);
    }

    const data = await response.json() as OpenAIResponse;
    return parseOpenAIResponse(data);
  }
}
