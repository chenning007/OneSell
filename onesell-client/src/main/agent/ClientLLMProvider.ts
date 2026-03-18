/**
 * ClientLLMProvider — Direct OpenAI API calls using user's API key (A-05, #223).
 *
 * PRD §12.3, §12.6, ADR-005 D4:
 * - Implements LLMProvider interface
 * - Retrieves API key from ApiKeyManager (safeStorage)
 * - Handles rate limit (429), auth error (401), network errors
 * - Enforces token budget limit per request
 * - Key is NEVER logged (P1)
 *
 * Closes #223
 */

import type {
  LLMProvider,
  LLMResponse,
  ChatMessage,
  ChatOptions,
} from './LLMProvider.js';
import type { ApiKeyManager } from '../store/ApiKeyManager.js';

// ── Error types ─────────────────────────────────────────────────────

export class LLMRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Rate limited — retry after ${retryAfterMs}ms`);
    this.name = 'LLMRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class LLMAuthError extends Error {
  constructor(message = 'Invalid or expired API key') {
    super(message);
    this.name = 'LLMAuthError';
  }
}

export class LLMNetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network error communicating with OpenAI API');
    this.name = 'LLMNetworkError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export class LLMBudgetExceededError extends Error {
  readonly requestedTokens: number;
  readonly budgetLimit: number;
  constructor(requestedTokens: number, budgetLimit: number) {
    super(`Token budget exceeded: requested ${requestedTokens}, limit ${budgetLimit}`);
    this.name = 'LLMBudgetExceededError';
    this.requestedTokens = requestedTokens;
    this.budgetLimit = budgetLimit;
  }
}

// ── OpenAI response types ───────────────────────────────────────────

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

// ── Default configuration ───────────────────────────────────────────

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TOKEN_BUDGET = 100_000;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;

// ── ClientLLMProvider ───────────────────────────────────────────────

export class ClientLLMProvider implements LLMProvider {
  readonly providerId = 'openai-client';
  readonly #apiKeyManager: ApiKeyManager;
  readonly #baseUrl: string;
  readonly #tokenBudget: number;

  constructor(
    apiKeyManager: ApiKeyManager,
    options?: { baseUrl?: string; tokenBudget?: number },
  ) {
    this.#apiKeyManager = apiKeyManager;
    this.#baseUrl = options?.baseUrl ?? OPENAI_BASE_URL;
    this.#tokenBudget = options?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  }

  async chat(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<LLMResponse> {
    // Enforce token budget: maxTokens per request must not exceed budget
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    if (maxTokens > this.#tokenBudget) {
      throw new LLMBudgetExceededError(maxTokens, this.#tokenBudget);
    }

    // Retrieve key at call time (P1: never cache, never log)
    const apiKey = this.#apiKeyManager.getKey();

    const body: Record<string, unknown> = {
      model: options?.model ?? DEFAULT_MODEL,
      messages: messages.map((m) => formatMessage(m)),
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: maxTokens,
    };

    if (options?.tools?.length) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    let response: Response;
    try {
      response = await fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LLMNetworkError(err);
    }

    // Handle errors by status code
    if (response.status === 401) {
      throw new LLMAuthError();
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const retryMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : DEFAULT_RATE_LIMIT_RETRY_MS;
      throw new LLMRateLimitError(Number.isFinite(retryMs) ? retryMs : DEFAULT_RATE_LIMIT_RETRY_MS);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '(unreadable)');
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    return parseResponse(data);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatMessage(m: ChatMessage): Record<string, unknown> {
  const msg: Record<string, unknown> = { role: m.role, content: m.content };
  if (m.name) msg.name = m.name;
  if (m.toolCallId) msg.tool_call_id = m.toolCallId;
  return msg;
}

function parseResponse(data: OpenAIResponse): LLMResponse {
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error('No response choices from LLM');
  }

  const toolCalls = choice.message.tool_calls?.map((tc) => ({
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
