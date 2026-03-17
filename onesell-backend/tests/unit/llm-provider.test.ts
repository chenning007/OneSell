/**
 * Unit tests for LLMProvider abstraction (#124).
 * Covers: provider creation, mock responses, key isolation, market routing.
 */

import { describe, it, expect } from 'vitest';
import {
  OpenAIProvider,
  QwenProvider,
  DeepSeekProvider,
  MockLLMProvider,
  createLLMProvider,
  getProviderForMarket,
  type LLMResponse,
  type ChatMessage,
} from '../../src/services/agent/llm-provider.js';

// ── Provider creation ───────────────────────────────────────────────

describe('createLLMProvider', () => {
  it('creates OpenAI provider with valid key', () => {
    const provider = createLLMProvider('openai', { openaiApiKey: 'sk-test-key' });
    expect(provider.providerId).toBe('openai');
  });

  it('creates Qwen provider with valid key', () => {
    const provider = createLLMProvider('qwen', { qwenApiKey: 'qwen-test-key' });
    expect(provider.providerId).toBe('qwen');
  });

  it('creates DeepSeek provider with valid key', () => {
    const provider = createLLMProvider('deepseek', { deepseekApiKey: 'ds-test-key' });
    expect(provider.providerId).toBe('deepseek');
  });

  it('throws for unknown provider', () => {
    expect(() => createLLMProvider('unknown', {})).toThrow('Unknown LLM provider: unknown');
  });

  it('throws when OpenAI key is missing', () => {
    expect(() => createLLMProvider('openai', {})).toThrow('OPENAI_API_KEY not configured');
  });

  it('throws when Qwen key is missing', () => {
    expect(() => createLLMProvider('qwen', {})).toThrow('QWEN_API_KEY not configured');
  });

  it('throws when DeepSeek key is missing', () => {
    expect(() => createLLMProvider('deepseek', {})).toThrow('DEEPSEEK_API_KEY not configured');
  });
});

// ── Key isolation (P1) ──────────────────────────────────────────────

describe('key isolation', () => {
  it('OpenAIProvider rejects empty key', () => {
    expect(() => new OpenAIProvider('')).toThrow('OpenAI API key is required');
  });

  it('QwenProvider rejects empty key', () => {
    expect(() => new QwenProvider('')).toThrow('Qwen API key is required');
  });

  it('DeepSeekProvider rejects empty key', () => {
    expect(() => new DeepSeekProvider('')).toThrow('DeepSeek API key is required');
  });

  it('API key is not exposed on provider instance', () => {
    const provider = new OpenAIProvider('sk-secret-key');
    const keys = Object.keys(provider);
    const values = Object.values(provider);
    // The key should be private — not enumerable on the object
    expect(keys).not.toContain('apiKey');
    expect(values).not.toContain('sk-secret-key');
  });
});

// ── Market → Provider routing ───────────────────────────────────────

describe('getProviderForMarket', () => {
  it('returns openai for US market', () => {
    expect(getProviderForMarket('us')).toBe('openai');
  });

  it('returns openai for UK market', () => {
    expect(getProviderForMarket('uk')).toBe('openai');
  });

  it('returns qwen for CN market', () => {
    expect(getProviderForMarket('cn')).toBe('qwen');
  });

  it('defaults to openai for unknown market', () => {
    expect(getProviderForMarket('xx')).toBe('openai');
  });

  it('returns openai for all non-CN markets', () => {
    for (const market of ['us', 'uk', 'de', 'jp', 'au', 'sea']) {
      expect(getProviderForMarket(market)).toBe('openai');
    }
  });
});

// ── MockLLMProvider ─────────────────────────────────────────────────

describe('MockLLMProvider', () => {
  it('returns configured responses in order', async () => {
    const responses: LLMResponse[] = [
      { content: 'First response', usage: { promptTokens: 10, completionTokens: 20 } },
      { content: 'Second response', usage: { promptTokens: 15, completionTokens: 25 } },
    ];

    const mock = new MockLLMProvider(responses);
    const msg: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    const r1 = await mock.chat(msg);
    expect(r1.content).toBe('First response');
    expect(r1.usage.promptTokens).toBe(10);

    const r2 = await mock.chat(msg);
    expect(r2.content).toBe('Second response');
    expect(r2.usage.completionTokens).toBe(25);
  });

  it('returns empty response when responses exhausted', async () => {
    const mock = new MockLLMProvider([
      { content: 'Only one', usage: { promptTokens: 5, completionTokens: 5 } },
    ]);
    const msg: ChatMessage[] = [{ role: 'user', content: 'Hi' }];

    await mock.chat(msg);
    const r2 = await mock.chat(msg);
    expect(r2.content).toBe('');
    expect(r2.usage.promptTokens).toBe(0);
  });

  it('records all calls for verification', async () => {
    const mock = new MockLLMProvider([
      { content: 'ok', usage: { promptTokens: 1, completionTokens: 1 } },
    ]);

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helper.' },
      { role: 'user', content: 'Analyze this product.' },
    ];
    await mock.chat(messages, { model: 'gpt-4o', temperature: 0.5 });

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].messages).toEqual(messages);
    expect(mock.calls[0].options?.model).toBe('gpt-4o');
    expect(mock.calls[0].options?.temperature).toBe(0.5);
  });

  it('supports tool call responses', async () => {
    const response: LLMResponse = {
      content: '',
      toolCalls: [
        { id: 'tc_1', name: 'calc_margin', arguments: '{"sellPrice":30}' },
      ],
      usage: { promptTokens: 20, completionTokens: 10 },
    };

    const mock = new MockLLMProvider([response]);
    const result = await mock.chat([{ role: 'user', content: 'Calculate margin' }]);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].name).toBe('calc_margin');
    expect(result.toolCalls![0].id).toBe('tc_1');
  });

  it('setResponses resets the response queue', async () => {
    const mock = new MockLLMProvider([
      { content: 'old', usage: { promptTokens: 1, completionTokens: 1 } },
    ]);

    mock.setResponses([
      { content: 'new', usage: { promptTokens: 2, completionTokens: 2 } },
    ]);

    const result = await mock.chat([{ role: 'user', content: 'test' }]);
    expect(result.content).toBe('new');
  });

  it('has correct providerId', () => {
    const mock = new MockLLMProvider();
    expect(mock.providerId).toBe('mock');
  });

  it('works with no responses configured', async () => {
    const mock = new MockLLMProvider();
    const result = await mock.chat([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('');
  });
});
