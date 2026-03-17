/**
 * LLMProvider abstraction — Market-aware LLM selection (P1, P4).
 *
 * Defines a provider interface for chat completion with tool-calling support.
 * Concrete implementations for OpenAI, Qwen, and DeepSeek.
 * API keys are read from env — never logged or exposed (P1).
 *
 * Closes #124
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

    // Qwen uses OpenAI-compatible API format
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

    // DeepSeek uses OpenAI-compatible API format
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

// ── Mock Provider (for tests) ───────────────────────────────────────

export class MockLLMProvider implements LLMProvider {
  readonly providerId = 'mock';
  private responses: LLMResponse[];
  private callIndex = 0;
  public readonly calls: Array<{ messages: readonly ChatMessage[]; options?: ChatOptions }> = [];

  constructor(responses: LLMResponse[] = []) {
    this.responses = responses;
  }

  setResponses(responses: LLMResponse[]): void {
    this.responses = responses;
    this.callIndex = 0;
  }

  async chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    this.calls.push({ messages, options });

    if (this.callIndex >= this.responses.length) {
      return {
        content: '',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    }

    return this.responses[this.callIndex++];
  }
}

// ── Factory ─────────────────────────────────────────────────────────

export type ProviderId = 'openai' | 'qwen' | 'deepseek';

const MARKET_PROVIDER_MAP: Record<string, ProviderId> = {
  us: 'openai',
  uk: 'openai',
  de: 'openai',
  jp: 'openai',
  au: 'openai',
  sea: 'openai',
  cn: 'qwen',
};

export function getProviderForMarket(marketId: string): ProviderId {
  return MARKET_PROVIDER_MAP[marketId] ?? 'openai';
}

export interface ProviderConfig {
  readonly openaiApiKey?: string;
  readonly qwenApiKey?: string;
  readonly deepseekApiKey?: string;
}

export function createLLMProvider(providerId: string, config: ProviderConfig): LLMProvider {
  switch (providerId) {
    case 'openai':
      if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY not configured');
      return new OpenAIProvider(config.openaiApiKey);

    case 'qwen':
      if (!config.qwenApiKey) throw new Error('QWEN_API_KEY not configured');
      return new QwenProvider(config.qwenApiKey);

    case 'deepseek':
      if (!config.deepseekApiKey) throw new Error('DEEPSEEK_API_KEY not configured');
      return new DeepSeekProvider(config.deepseekApiKey);

    default:
      throw new Error(`Unknown LLM provider: ${providerId}`);
  }
}

// ── Internal helpers ────────────────────────────────────────────────

function formatMessage(m: ChatMessage): Record<string, unknown> {
  const msg: Record<string, unknown> = { role: m.role, content: m.content };
  if (m.name) msg.name = m.name;
  if (m.toolCallId) msg.tool_call_id = m.toolCallId;
  return msg;
}

interface OpenAIToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface OpenAIChoice {
  message: {
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

function parseOpenAIResponse(data: OpenAIResponse): LLMResponse {
  const choice = data.choices?.[0];
  const toolCalls = choice?.message?.tool_calls?.map(tc => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    content: choice?.message?.content ?? '',
    toolCalls: toolCalls?.length ? toolCalls : undefined,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
