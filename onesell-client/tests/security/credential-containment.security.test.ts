/**
 * P1 — Credential Containment Security Test
 * Security Test Matrix: S1, S7
 * Covers: #60 (credential containment), P1 architectural principle
 */
import { describe, it, expect } from 'vitest';
import { PayloadBuilder } from '../../src/main/extraction/PayloadBuilder.js';
import type { NormalizedPlatformData } from '../../src/shared/types/ExtractionScript.js';
import type { UserPreferences } from '../../src/shared/types/AnalysisPayload.js';
import type { MarketContext } from '../../src/shared/types/MarketContext.js';

const CREDENTIAL_PATTERNS = [
  'password', 'token', 'cookie', 'credential', 'secret', 'auth',
  'session_id', 'accessToken', 'refreshToken', 'apiKey',
];

const usMarket: MarketContext = {
  marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'],
};

const basePreferences: UserPreferences = {
  market: usMarket,
  budget: { min: 100, max: 1000, currency: 'USD' },
  riskTolerance: 'medium',
  targetPlatforms: ['amazon-us'],
  categories: ['electronics'],
  sellerExperience: 'some',
};

function collectAllKeys(obj: unknown): string[] {
  const keys: string[] = [];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      keys.push(k);
      keys.push(...collectAllKeys(v));
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) keys.push(...collectAllKeys(item));
  }
  return keys;
}

function makeCleanNormalized(platformId = 'amazon-us'): NormalizedPlatformData {
  return {
    platformId, marketId: 'us',
    extractedAt: new Date().toISOString(), scriptVersion: '1.0.0',
    listings: [{ title: 'Product', price: 29.99, currency: 'USD', reviewCount: 10, rating: 4.0, url: 'https://example.com/p' }],
  };
}

describe('Security: Credential Containment (P1)', () => {
  const builder = new PayloadBuilder();

  it('S1: strips credential-shaped keys from normalized data at top level', () => {
    const leaky = {
      ...makeCleanNormalized(),
      password: 'leaked', token: 'leaked', cookie: 'leaked', auth: 'leaked', secret: 'leaked',
    } as unknown as NormalizedPlatformData;
    const payload = builder.build('s1', basePreferences, new Map([['amazon-us', leaky]]));
    const allKeys = collectAllKeys(payload).map(k => k.toLowerCase());
    for (const p of CREDENTIAL_PATTERNS) {
      expect(allKeys.filter(k => k === p.toLowerCase()), `Found "${p}" in payload`).toEqual([]);
    }
  });

  it('S1: strips deeply nested credential fields inside listings', () => {
    const nested = {
      ...makeCleanNormalized(),
      listings: [{ title: 'P', price: 10, currency: 'USD', reviewCount: 1, rating: 5, url: 'https://x.com', cookie: 'stolen', auth: 'Bearer x' } as Record<string, unknown>],
    } as unknown as NormalizedPlatformData;
    const payload = builder.build('s2', basePreferences, new Map([['amazon-us', nested]]));
    const json = JSON.stringify(payload);
    expect(json).not.toContain('stolen');
    expect(json).not.toContain('Bearer x');
  });

  it('S1: clean payload has zero credential key matches', () => {
    const payload = builder.build('s3', basePreferences, new Map([['amazon-us', makeCleanNormalized()]]));
    const credHits = collectAllKeys(payload).filter(k => CREDENTIAL_PATTERNS.some(p => k.toLowerCase() === p.toLowerCase()));
    expect(credHits).toEqual([]);
  });

  it('S7: rejects payload exceeding 5MB', () => {
    const huge: NormalizedPlatformData = {
      ...makeCleanNormalized(),
      listings: Array.from({ length: 50000 }, (_, i) => ({
        title: `Product ${i} ${'x'.repeat(100)}`, price: 99, currency: 'USD', reviewCount: 1, rating: 5, url: `https://x.com/${i}`,
      })),
    };
    expect(() => builder.build('big', basePreferences, new Map([['amazon-us', huge]]))).toThrow(/exceeds 5MB/);
  });
});
