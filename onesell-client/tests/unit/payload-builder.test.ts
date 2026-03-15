import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayloadBuilder } from '../../src/main/extraction/PayloadBuilder.js';
import { ExtractionScriptRegistry, registry } from '../../src/main/extraction/ExtractionScriptRegistry.js';
import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../src/shared/types/ExtractionScript.js';
import type { UserPreferences } from '../../src/shared/types/AnalysisPayload.js';
import type { MarketContext } from '../../src/shared/types/MarketContext.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon-us'],
};

const basePreferences: UserPreferences = {
  market: usMarket,
  budget: { min: 100, max: 1000, currency: 'USD' },
  riskTolerance: 'medium',
  targetPlatforms: ['amazon-us'],
  categories: ['electronics'],
  sellerExperience: 'some',
};

function makeNormalized(platformId: string, marketId = 'us'): NormalizedPlatformData {
  return {
    platformId,
    marketId,
    extractedAt: new Date().toISOString(),
    scriptVersion: '1.0.0',
    listings: [
      {
        title: 'Test Product',
        price: 99.99,
        currency: 'USD',
        reviewCount: 42,
        rating: 4.5,
        url: 'https://example.com/product',
      },
    ],
  };
}

function makeRaw(platformId: string): RawPlatformData {
  return {
    platformId,
    url: 'https://example.com',
    extractedAt: new Date().toISOString(),
    data: { listings: [{ title: 'Test', price: 9.99 }] },
  };
}

function makeScript(platformId: string, marketId: string): ExtractionScript {
  return {
    platformId,
    marketId,
    version: '1.0.0',
    getNavigationTargets: () => [],
    extractFromPage: (_doc: Document, url: string) => makeRaw(platformId),
    normalizeData: (raw: RawPlatformData[]) => makeNormalized(platformId, marketId),
  };
}

// ---------------------------------------------------------------------------
// Tests: PayloadBuilder.build()
// ---------------------------------------------------------------------------

describe('PayloadBuilder.build()', () => {
  let builder: PayloadBuilder;

  beforeEach(() => {
    builder = new PayloadBuilder();
  });

  it('produces a valid AnalysisPayload with all required fields', () => {
    const normalized = new Map([['amazon-us', makeNormalized('amazon-us')]]);
    const payload = builder.build('session-123', basePreferences, normalized);

    expect(payload.sessionId).toBe('session-123');
    expect(payload.market).toEqual(usMarket);
    expect(payload.userPreferences).toEqual(basePreferences);
    expect(payload.platformData['amazon-us']).toBeDefined();
    expect(payload.extractionMetadata.platforms).toContain('amazon-us');
    expect(typeof payload.extractionMetadata.extractedAt).toBe('string');
    expect(payload.extractionMetadata.scriptVersions['amazon-us']).toBe('1.0.0');
  });

  it('strips credential-shaped keys (cookie, password, token) from nested data', () => {
    const dirtyNormalized: NormalizedPlatformData = {
      ...makeNormalized('amazon-us'),
      // Inject credential-shaped keys via type cast (defense-in-depth scenario)
      ...(({ cookie: 'abc', token: 'xyz', password: 'secret' } as unknown) as object),
    };
    const normalized = new Map([['amazon-us', dirtyNormalized]]);
    const payload = builder.build('session-clean', basePreferences, normalized);

    const platformEntry = payload.platformData['amazon-us'] as unknown as Record<string, unknown>;
    expect(platformEntry['cookie']).toBeUndefined();
    expect(platformEntry['token']).toBeUndefined();
    expect(platformEntry['password']).toBeUndefined();
  });

  it('throws when payload exceeds 5MB', () => {
    // Create a large NormalizedPlatformData that will exceed 5MB
    const bigListings = Array.from({ length: 50000 }, (_, i) => ({
      title: `Product ${i} `.repeat(20),
      price: i,
      currency: 'USD',
      reviewCount: i,
      rating: 4.5,
      url: `https://example.com/product/${i}`,
    }));
    const bigNormalized: NormalizedPlatformData = {
      ...makeNormalized('amazon-us'),
      listings: bigListings,
    };
    const normalized = new Map([['amazon-us', bigNormalized]]);

    expect(() => builder.build('session-big', basePreferences, normalized)).toThrow(
      /exceeds 5MB/,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: PayloadBuilder.normalizeAll()
// ---------------------------------------------------------------------------

describe('PayloadBuilder.normalizeAll()', () => {
  let builder: PayloadBuilder;
  let localRegistry: ExtractionScriptRegistry;

  // Swap out the singleton registry for an isolated one per test
  beforeEach(() => {
    builder = new PayloadBuilder();
    localRegistry = new ExtractionScriptRegistry();
    // Patch registry used by PayloadBuilder (it imports the singleton)
    // We test via a fresh builder that uses the shared singleton; we register/clean per test
  });

  it('skips platforms with no registered script without crashing', () => {
    // Ensure the singleton has no 'unknown-platform' entry
    const result = builder.normalizeAll({ 'unknown-platform': [makeRaw('unknown-platform')] });
    expect(result.size).toBe(0);
  });

  it('calls the correct script for each platformId', () => {
    const amazonScript = makeScript('amazon-us', 'us');
    const normalizeSpy = vi.spyOn(amazonScript, 'normalizeData');

    // Register into the singleton for this test
    registry.register(amazonScript);

    const raw = [makeRaw('amazon-us')];
    const result = builder.normalizeAll({ 'amazon-us': raw });

    expect(normalizeSpy).toHaveBeenCalledWith(raw);
    expect(result.has('amazon-us')).toBe(true);
  });

  it('handles multiple platforms correctly', () => {
    const ebayScript = makeScript('ebay-us', 'us');
    registry.register(ebayScript);

    const result = builder.normalizeAll({
      'amazon-us': [makeRaw('amazon-us')],
      'ebay-us': [makeRaw('ebay-us')],
    });

    // amazon-us should still be there from previous test
    expect(result.has('ebay-us')).toBe(true);
  });
});
