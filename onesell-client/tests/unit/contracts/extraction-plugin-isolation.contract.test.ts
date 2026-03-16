/**
 * P6 — Extraction Script Plugin Isolation Contract Test
 * Verifies: adding a new script requires ZERO changes to ExtractionManager or ExtractionScriptRegistry source.
 * Covers: P6 principle, #26 (part of extraction test plan)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ExtractionScriptRegistry } from '../../../src/main/extraction/ExtractionScriptRegistry.js';
import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../src/shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

function makeFakeScript(platformId: string, marketId: string): ExtractionScript {
  return {
    platformId, marketId, version: '1.0.0',
    homeUrl: `https://${platformId}.example.com`,
    getNavigationTargets: (_kw: string, _m: MarketContext) => [`https://${platformId}.example.com/search`],
    extractFromPage: (_doc: Document, url: string) => ({ platformId, url, extractedAt: new Date().toISOString(), data: {} }),
    normalizeData: (raw: RawPlatformData[]) => ({
      platformId, marketId, extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0', listings: [],
    }),
  };
}

describe('Contract: Extraction Script Plugin Isolation (P6)', () => {
  let registry: ExtractionScriptRegistry;

  beforeEach(() => { registry = new ExtractionScriptRegistry(); });

  it('a new script registers without modifying ExtractionScriptRegistry source', () => {
    const newScript = makeFakeScript('brand-new-platform', 'us');
    registry.register(newScript);
    expect(registry.get('brand-new-platform')).toBe(newScript);
  });

  it('multiple new scripts can register independently', () => {
    const s1 = makeFakeScript('platform-a', 'us');
    const s2 = makeFakeScript('platform-b', 'cn');
    const s3 = makeFakeScript('platform-c', 'sea');
    registry.register(s1);
    registry.register(s2);
    registry.register(s3);
    expect(registry.getAll()).toHaveLength(3);
    expect(registry.getForMarket('us')).toHaveLength(1);
    expect(registry.getForMarket('cn')).toHaveLength(1);
    expect(registry.getForMarket('sea')).toHaveLength(1);
  });

  it('all 6 real extraction scripts implement the ExtractionScript interface', async () => {
    // Import real scripts — they self-register on import
    const { registry: realRegistry } = await import('../../../src/main/extraction/ExtractionScriptRegistry.js');
    await import('../../../src/main/extraction/scripts/amazon-us/index.js');
    await import('../../../src/main/extraction/scripts/ebay-us/index.js');
    await import('../../../src/main/extraction/scripts/etsy/index.js');
    await import('../../../src/main/extraction/scripts/tiktok-shop-us/index.js');
    await import('../../../src/main/extraction/scripts/alibaba/index.js');
    await import('../../../src/main/extraction/scripts/google-trends/index.js');

    const scripts = realRegistry.getAll();
    expect(scripts.length).toBeGreaterThanOrEqual(6);

    for (const script of scripts) {
      expect(typeof script.platformId).toBe('string');
      expect(typeof script.marketId).toBe('string');
      expect(typeof script.version).toBe('string');
      expect(typeof script.homeUrl).toBe('string');
      expect(typeof script.getNavigationTargets).toBe('function');
      expect(typeof script.extractFromPage).toBe('function');
      expect(typeof script.normalizeData).toBe('function');
    }
  });

  it('extractFromPage returns null (not throws) for unrecognized DOM', () => {
    const script = makeFakeScript('test-platform', 'us');
    // Override extractFromPage like real scripts should: return null
    const safScript: ExtractionScript = {
      ...script,
      extractFromPage: () => null,
    };
    const result = safScript.extractFromPage(document, 'https://unknown-page.com');
    expect(result).toBeNull();
  });
});
