import { describe, it, expect, beforeEach } from 'vitest';
import { ExtractionScriptRegistry } from '../../src/main/extraction/ExtractionScriptRegistry.js';
import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../src/shared/types/ExtractionScript.js';
import type { MarketContext } from '../../src/shared/types/MarketContext.js';

// ---------------------------------------------------------------------------
// Minimal ExtractionScript stubs (no BrowserView dependency)
// ---------------------------------------------------------------------------

function makeScript(platformId: string, marketId: string): ExtractionScript {
  return {
    platformId,
    marketId,
    version: '1.0.0',
    homeUrl: `https://example.com/${platformId}`,
    getNavigationTargets(_keyword: string, _market: MarketContext): string[] {
      return [`https://example.com/${platformId}`];
    },
    extractFromPage(_document: Document, url: string): RawPlatformData | null {
      return {
        platformId,
        url,
        extractedAt: new Date().toISOString(),
        data: {},
      };
    },
    normalizeData(raw: RawPlatformData[]): NormalizedPlatformData {
      return {
        platformId,
        marketId,
        extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
        scriptVersion: '1.0.0',
        listings: [],
      };
    },
  };
}

const amazonUs = makeScript('amazon-us', 'us');
const ebayUs = makeScript('ebay-us', 'us');
const taobao = makeScript('taobao', 'cn');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExtractionScriptRegistry', () => {
  let registry: ExtractionScriptRegistry;

  beforeEach(() => {
    registry = new ExtractionScriptRegistry();
  });

  it('registers and retrieves a script by platformId', () => {
    registry.register(amazonUs);
    expect(registry.get('amazon-us')).toBe(amazonUs);
  });

  it('returns undefined for an unknown platformId', () => {
    expect(registry.get('nonexistent-platform')).toBeUndefined();
  });

  it('getAll returns all registered scripts', () => {
    registry.register(amazonUs);
    registry.register(ebayUs);
    registry.register(taobao);
    const all = registry.getAll();
    expect(all).toHaveLength(3);
    expect(all).toContain(amazonUs);
    expect(all).toContain(ebayUs);
    expect(all).toContain(taobao);
  });

  it('getForMarket returns only scripts for the specified marketId', () => {
    registry.register(amazonUs);
    registry.register(ebayUs);
    registry.register(taobao);

    const usScripts = registry.getForMarket('us');
    expect(usScripts).toHaveLength(2);
    expect(usScripts).toContain(amazonUs);
    expect(usScripts).toContain(ebayUs);

    const cnScripts = registry.getForMarket('cn');
    expect(cnScripts).toHaveLength(1);
    expect(cnScripts).toContain(taobao);
  });

  it('getForMarket returns empty array for unknown market', () => {
    registry.register(amazonUs);
    expect(registry.getForMarket('jp')).toEqual([]);
  });

  it('overwriting a platformId replaces the previous script', () => {
    const v1 = makeScript('amazon-us', 'us');
    const v2 = makeScript('amazon-us', 'us');
    registry.register(v1);
    registry.register(v2);
    expect(registry.get('amazon-us')).toBe(v2);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('getAll returns empty array when no scripts registered', () => {
    expect(registry.getAll()).toEqual([]);
  });
});
