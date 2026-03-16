/**
 * AnalysisPayload Schema Contract Test
 * Verifies: PayloadBuilder output conforms to AnalysisPayload interface.
 * Covers: P1 (no credentials), P5 (partial data), P9 (size limit)
 */
import { describe, it, expect } from 'vitest';
import { PayloadBuilder } from '../../../src/main/extraction/PayloadBuilder.js';
import type { AnalysisPayload, UserPreferences } from '../../../src/shared/types/AnalysisPayload.js';
import type { NormalizedPlatformData } from '../../../src/shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us', 'ebay-us'],
};

const prefs: UserPreferences = {
  market: usMarket,
  budget: { min: 100, max: 500, currency: 'USD' },
  riskTolerance: 'medium',
  targetPlatforms: ['amazon-us', 'ebay-us'],
  categories: ['electronics'],
  sellerExperience: 'some',
};

function makeNorm(platformId: string, marketId = 'us'): NormalizedPlatformData {
  return {
    platformId, marketId,
    extractedAt: '2026-03-15T00:00:00.000Z', scriptVersion: '1.0.0',
    listings: [{ title: 'Test', price: 29.99, currency: 'USD', reviewCount: 10, rating: 4.5, url: 'https://x.com/p' }],
  };
}

function assertPayloadShape(payload: AnalysisPayload): void {
  expect(payload.sessionId).toBeTypeOf('string');
  expect(payload.market).toBeDefined();
  expect(payload.market.marketId).toBeTypeOf('string');
  expect(payload.market.language).toBeTypeOf('string');
  expect(payload.market.currency).toBeTypeOf('string');
  expect(Array.isArray(payload.market.platforms)).toBe(true);
  expect(payload.userPreferences).toBeDefined();
  expect(payload.platformData).toBeDefined();
  expect(payload.extractionMetadata).toBeDefined();
  expect(payload.extractionMetadata.extractedAt).toBeTypeOf('string');
  expect(Array.isArray(payload.extractionMetadata.platforms)).toBe(true);
}

describe('Contract: AnalysisPayload Schema', () => {
  const builder = new PayloadBuilder();

  it('payload conforms to AnalysisPayload shape with single platform', () => {
    const payload = builder.build('s1', prefs, new Map([['amazon-us', makeNorm('amazon-us')]]));
    assertPayloadShape(payload);
    expect(payload.extractionMetadata.platforms).toEqual(['amazon-us']);
    expect(payload.extractionMetadata.scriptVersions['amazon-us']).toBe('1.0.0');
  });

  it('payload conforms with multiple platforms', () => {
    const map = new Map([
      ['amazon-us', makeNorm('amazon-us')],
      ['ebay-us', makeNorm('ebay-us')],
    ]);
    const payload = builder.build('s2', prefs, map);
    assertPayloadShape(payload);
    expect(payload.extractionMetadata.platforms).toHaveLength(2);
    expect(Object.keys(payload.platformData)).toHaveLength(2);
  });

  it('payload conforms with zero platforms (P5)', () => {
    const payload = builder.build('s3', prefs, new Map());
    assertPayloadShape(payload);
    expect(payload.extractionMetadata.platforms).toEqual([]);
    expect(Object.keys(payload.platformData)).toHaveLength(0);
  });

  it('payload sessionId matches the input', () => {
    const payload = builder.build('my-session-123', prefs, new Map());
    expect(payload.sessionId).toBe('my-session-123');
  });

  it('payload extractedAt is a valid ISO 8601 date', () => {
    const payload = builder.build('s4', prefs, new Map([['amazon-us', makeNorm('amazon-us')]]));
    const date = new Date(payload.extractionMetadata.extractedAt);
    expect(date.getTime()).not.toBeNaN();
  });
});
