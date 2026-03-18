/**
 * Tests for v2.0-P2 Wave 1 features:
 * - E-23 (#281): ExtractionScript v2 interface — getAutoDiscoveryUrls
 * - E-29 (#287): Time estimate display in TaskPipelineRow
 * - E-31 (#289): Tab panel collapse/expand in PlatformTabPanel
 * - W-17 (#291): ProfileMenu component
 * - F-17 (#293): Auto-updater module
 * - R-13 (#295): Save to My List in ResultsDashboardV2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../src/shared/types/ExtractionScript.js';
import type { MarketContext } from '../../src/shared/types/MarketContext.js';

// ── E-23: ExtractionScript getAutoDiscoveryUrls ─────────────────────

describe('E-23: ExtractionScript getAutoDiscoveryUrls', () => {
  const market: MarketContext = { marketId: 'us', language: 'en', currency: 'USD' };

  it('AC-1: getAutoDiscoveryUrls is optional on the interface', () => {
    // A script WITHOUT getAutoDiscoveryUrls compiles and works
    const scriptWithout: ExtractionScript = {
      platformId: 'test-platform',
      marketId: 'us',
      version: '1.0.0',
      homeUrl: 'https://example.com',
      getNavigationTargets: () => ['https://example.com/search'],
      extractFromPage: () => null,
      normalizeData: (raw) => ({
        platformId: 'test-platform',
        marketId: 'us',
        extractedAt: new Date().toISOString(),
        scriptVersion: '1.0.0',
        listings: [],
      }),
    };
    expect(scriptWithout.getAutoDiscoveryUrls).toBeUndefined();
    expect(scriptWithout.platformId).toBe('test-platform');
  });

  it('AC-2: getAutoDiscoveryUrls returns url+label array', () => {
    const scriptWith: ExtractionScript = {
      platformId: 'amazon-us',
      marketId: 'us',
      version: '2.0.0',
      homeUrl: 'https://amazon.com',
      getNavigationTargets: () => [],
      extractFromPage: () => null,
      normalizeData: (raw) => ({
        platformId: 'amazon-us',
        marketId: 'us',
        extractedAt: new Date().toISOString(),
        scriptVersion: '2.0.0',
        listings: [],
      }),
      getAutoDiscoveryUrls: () => [
        { url: 'https://amazon.com/Best-Sellers/zgbs', label: 'Best Sellers' },
        { url: 'https://amazon.com/gp/movers-and-shakers', label: 'Movers & Shakers' },
      ],
    };

    const urls = scriptWith.getAutoDiscoveryUrls!();
    expect(urls).toHaveLength(2);
    expect(urls[0]).toEqual({ url: 'https://amazon.com/Best-Sellers/zgbs', label: 'Best Sellers' });
    expect(urls[1]).toEqual({ url: 'https://amazon.com/gp/movers-and-shakers', label: 'Movers & Shakers' });
  });

  it('AC-3: existing scripts without getAutoDiscoveryUrls are unaffected', () => {
    // Scripts that only implement v1 methods still satisfy the interface
    const v1Script: ExtractionScript = {
      platformId: 'legacy',
      marketId: 'us',
      version: '1.0.0',
      homeUrl: 'https://legacy.com',
      getNavigationTargets: (_kw, _m) => ['https://legacy.com/s?q=test'],
      extractFromPage: (_doc, _url) => null,
      normalizeData: () => ({
        platformId: 'legacy',
        marketId: 'us',
        extractedAt: new Date().toISOString(),
        scriptVersion: '1.0.0',
        listings: [],
      }),
    };

    // Can call v1 methods normally
    expect(v1Script.getNavigationTargets('test', market)).toEqual(['https://legacy.com/s?q=test']);
    expect(v1Script.extractFromPage(null as unknown as Document, '')).toBeNull();
    // Optional method is undefined
    expect(v1Script.getAutoDiscoveryUrls).toBeUndefined();
  });
});
