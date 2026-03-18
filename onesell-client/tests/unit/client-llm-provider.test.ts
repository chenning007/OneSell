/**
 * A-05 (#223) — ClientLLMProvider unit tests.
 *
 * AC:
 *   1. Implements LLMProvider interface (chat method exists)
 *   2. Calls OpenAI API with key from ApiKeyManager
 *   3. Handles rate limit (429) / auth error (401) with typed errors
 *   4. Enforces token budget limit per request
 *   5. Key never logged
 *
 * Principles:
 *   P1 — Key never logged or exposed
 *   P9 — Validate at boundaries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock ApiKeyManager ──────────────────────────────────────────────

const mockGetKey = vi.fn().mockReturnValue('sk-test-key-1234');
const mockApiKeyManager = {
  getKey: mockGetKey,
  hasKey: vi.fn().mockReturnValue(true),
  saveKey: vi.fn(),
  clearKey: vi.fn(),
  ready: vi.fn().mockResolvedValue(undefined),
} as unknown as import('../../src/main/store/ApiKeyManager.js').ApiKeyManager;

// ── Mock fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helper: valid OpenAI response ───────────────────────────────────

function openAIResponse(content: string, promptTokens = 100, completionTokens = 50) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve({
      choices: [{
        message: { role: 'assistant', content, tool_calls: undefined },
      }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    }),
    text: () => Promise.resolve(''),
  };
}

// ── Import after mocks ──────────────────────────────────────────────

import {
  ClientLLMProvider,
  LLMRateLimitError,
  LLMAuthError,
  LLMNetworkError,
  LLMBudgetExceededError,
} from '../../src/main/agent/ClientLLMProvider.js';

// ── Tests ───────────────────────────────────────────────────────────

describe('ClientLLMProvider', () => {
  let provider: ClientLLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClientLLMProvider(mockApiKeyManager);
  });

  // ── AC-1: Implements LLMProvider interface ─────────────────────

  it('has providerId and chat method (LLMProvider interface)', () => {
    expect(provider.providerId).toBe('openai-client');
    expect(typeof provider.chat).toBe('function');
  });

  // ── AC-2: Calls OpenAI API with key from ApiKeyManager ────────

  it('calls OpenAI API with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse('Hello world'));

    const result = await provider.chat([
      { role: 'user', content: 'Hi' },
    ]);

    expect(mockGetKey).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test-key-1234');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('Hello world');
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(50);
  });

  it('passes tool definitions when provided', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse('tool result'));

    await provider.chat(
      [{ role: 'user', content: 'test' }],
      {
        tools: [{
          name: 'calc',
          description: 'Calculator',
          parameters: { type: 'object', properties: {} },
        }],
      },
    );

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function.name).toBe('calc');
  });

  it('parses tool calls from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'calc', arguments: '{"x":1}' },
            }],
          },
        }],
        usage: { prompt_tokens: 50, completion_tokens: 30 },
      }),
      text: () => Promise.resolve(''),
    });

    const result = await provider.chat([{ role: 'user', content: 'test' }]);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].name).toBe('calc');
    expect(result.toolCalls![0].arguments).toBe('{"x":1}');
  });

  // ── AC-3: Handles rate limit / auth errors ────────────────────

  it('throws LLMAuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(provider.chat([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow(LLMAuthError);
  });

  it('throws LLMRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '30' }),
      text: () => Promise.resolve('Rate limited'),
    });

    await expect(provider.chat([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow(LLMRateLimitError);

    try {
      await provider.chat([{ role: 'user', content: 'Hi' }]);
    } catch (e) {
      // Previous call already confirmed the type, but let's check retryAfterMs
    }
  });

  it('LLMRateLimitError includes retryAfterMs from header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '10' }),
      text: () => Promise.resolve('Rate limited'),
    });

    try {
      await provider.chat([{ role: 'user', content: 'Hi' }]);
    } catch (e) {
      expect(e).toBeInstanceOf(LLMRateLimitError);
      expect((e as LLMRateLimitError).retryAfterMs).toBe(10_000);
    }
  });

  it('throws LLMNetworkError on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(provider.chat([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow(LLMNetworkError);
  });

  it('throws on other HTTP errors (e.g., 500)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: () => Promise.resolve('Internal Server Error'),
    });

    await expect(provider.chat([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow('OpenAI API error 500');
  });

  // ── AC-4: Enforces token budget limit ─────────────────────────

  it('throws LLMBudgetExceededError when maxTokens exceeds budget', async () => {
    const smallBudgetProvider = new ClientLLMProvider(mockApiKeyManager, {
      tokenBudget: 1000,
    });

    await expect(
      smallBudgetProvider.chat(
        [{ role: 'user', content: 'Hi' }],
        { maxTokens: 5000 },
      ),
    ).rejects.toThrow(LLMBudgetExceededError);
  });

  it('allows requests within budget', async () => {
    const smallBudgetProvider = new ClientLLMProvider(mockApiKeyManager, {
      tokenBudget: 5000,
    });
    mockFetch.mockResolvedValueOnce(openAIResponse('OK'));

    const result = await smallBudgetProvider.chat(
      [{ role: 'user', content: 'Hi' }],
      { maxTokens: 4000 },
    );
    expect(result.content).toBe('OK');
  });

  // ── AC-5: Key never logged ────────────────────────────────────

  it('does not include the API key in error messages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: () => Promise.resolve('Server error'),
    });

    try {
      await provider.chat([{ role: 'user', content: 'Hi' }]);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain('sk-test-key-1234');
    }
  });

  // ── Message formatting ────────────────────────────────────────

  it('formats tool messages with tool_call_id', async () => {
    mockFetch.mockResolvedValueOnce(openAIResponse('done'));

    await provider.chat([
      { role: 'tool', content: '42', toolCallId: 'call_1', name: 'calc' },
    ]);

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.messages[0].tool_call_id).toBe('call_1');
    expect(body.messages[0].name).toBe('calc');
  });

  it('throws when LLM returns no choices', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } }),
      text: () => Promise.resolve(''),
    });

    await expect(provider.chat([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow('No response choices');
  });
});
