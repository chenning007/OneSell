import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { ebayUkScript, ebayDeScript, ebayAuScript } from '../../../src/main/extraction/scripts/ebay-regional/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const ukMarket: MarketContext = {
  marketId: 'uk',
  language: 'en-GB',
  currency: 'GBP',
  platforms: ['ebay-uk'],
};

const deMarket: MarketContext = {
  marketId: 'de',
  language: 'de-DE',
  currency: 'EUR',
  platforms: ['ebay-de'],
};

const auMarket: MarketContext = {
  marketId: 'au',
  language: 'en-AU',
  currency: 'AUD',
  platforms: ['ebay-au'],
};

function makeEbayFixture(domain: string, priceHtml: string[]): string {
  return `<!DOCTYPE html><html><body>
  <li class="s-item">
    <a href="https://www.${domain}/itm/123456"><h3 class="s-item__title">Vintage Camera Lens</h3></a>
    <span class="s-item__price">${priceHtml[0]}</span>
    <span class="s-item__quantitySold">25 sold</span>
    <span class="SECONDARY_INFO">Pre-owned</span>
  </li>
  <li class="s-item">
    <a href="https://www.${domain}/itm/789012"><h3 class="s-item__title">Film Roll Pack</h3></a>
    <span class="s-item__price">${priceHtml[1]}</span>
    <span class="s-item__quantitySold">100 sold</span>
    <span class="SECONDARY_INFO">Brand new</span>
  </li>
</body></html>`;
}

const ukFixture = makeEbayFixture('ebay.co.uk', ['£29.99', '£5.50']);
const deFixture = makeEbayFixture('ebay.de', ['EUR 29,99', 'EUR 5,50']);
const auFixture = makeEbayFixture('ebay.com.au', ['AU $39.99', 'AU $8.50']);

// ── eBay UK ──

describe('eBay UK ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(ukFixture).window.document;
    const result = ebayUkScript.extractFromPage(doc, 'https://www.ebay.co.uk/sch/i.html?_nkw=camera');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('ebay-uk');
    expect(result!.data.pageType).toBe('active');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Vintage Camera Lens');
  });

  it('parses GBP prices', () => {
    const doc = new JSDOM(ukFixture).window.document;
    const result = ebayUkScript.extractFromPage(doc, 'https://www.ebay.co.uk/sch/i.html?_nkw=camera');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(29.99);
    expect(listings[1].price).toBe(5.5);
  });

  it('extracts sold count', () => {
    const doc = new JSDOM(ukFixture).window.document;
    const result = ebayUkScript.extractFromPage(doc, 'https://www.ebay.co.uk/sch/i.html?_nkw=camera');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].soldCount).toBe(25);
    expect(listings[1].soldCount).toBe(100);
  });

  it('detects completed listings page type', () => {
    const doc = new JSDOM(ukFixture).window.document;
    const result = ebayUkScript.extractFromPage(doc, 'https://www.ebay.co.uk/sch/i.html?_nkw=camera&LH_Complete=1&LH_Sold=1');
    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('completed');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = ebayUkScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no items found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = ebayUkScript.extractFromPage(doc, 'https://www.ebay.co.uk/sch/i.html?_nkw=nothing');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns ebay.co.uk URLs', () => {
    const targets = ebayUkScript.getNavigationTargets('camera lens', ukMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('ebay.co.uk/sch/');
    expect(targets[0]).toContain(encodeURIComponent('camera lens'));
    expect(targets[0]).toContain('LH_Complete=1');
  });

  it('normalizeData produces NormalizedPlatformData with GBP', () => {
    const doc = new JSDOM(ukFixture).window.document;
    const raw = ebayUkScript.extractFromPage(doc, 'https://www.ebay.co.uk/sch/i.html?_nkw=camera');
    expect(raw).not.toBeNull();

    const normalized = ebayUkScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('ebay-uk');
    expect(normalized.marketId).toBe('uk');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('GBP');
    expect(normalized.listings[0].price).toBe(29.99);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'ebay-uk',
      url: 'https://www.ebay.co.uk/sch/i.html?_nkw=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'active', listings: [{ title: '', price: null }] },
    };
    const normalized = ebayUkScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(ebayUkScript.platformId).toBe('ebay-uk');
    expect(ebayUkScript.marketId).toBe('uk');
    expect(ebayUkScript.version).toBe('1.0.0');
    expect(ebayUkScript.homeUrl).toBe('https://www.ebay.co.uk');
  });
});

// ── eBay DE ──

describe('eBay DE ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(deFixture).window.document;
    const result = ebayDeScript.extractFromPage(doc, 'https://www.ebay.de/sch/i.html?_nkw=kamera');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('ebay-de');
    expect(result!.data.pageType).toBe('active');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Vintage Camera Lens');
  });

  it('parses EUR prices (comma-decimal format)', () => {
    const doc = new JSDOM(deFixture).window.document;
    const result = ebayDeScript.extractFromPage(doc, 'https://www.ebay.de/sch/i.html?_nkw=kamera');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(29.99);
    expect(listings[1].price).toBe(5.5);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = ebayDeScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns ebay.de URLs', () => {
    const targets = ebayDeScript.getNavigationTargets('kamera', deMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('ebay.de/sch/');
    expect(targets[0]).toContain(encodeURIComponent('kamera'));
  });

  it('normalizeData produces NormalizedPlatformData with EUR', () => {
    const doc = new JSDOM(deFixture).window.document;
    const raw = ebayDeScript.extractFromPage(doc, 'https://www.ebay.de/sch/i.html?_nkw=kamera');
    expect(raw).not.toBeNull();

    const normalized = ebayDeScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('ebay-de');
    expect(normalized.marketId).toBe('de');
    expect(normalized.listings[0].currency).toBe('EUR');
  });

  it('has correct static properties', () => {
    expect(ebayDeScript.platformId).toBe('ebay-de');
    expect(ebayDeScript.marketId).toBe('de');
    expect(ebayDeScript.version).toBe('1.0.0');
    expect(ebayDeScript.homeUrl).toBe('https://www.ebay.de');
  });
});

// ── eBay AU ──

describe('eBay AU ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(auFixture).window.document;
    const result = ebayAuScript.extractFromPage(doc, 'https://www.ebay.com.au/sch/i.html?_nkw=camera');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('ebay-au');
    expect(result!.data.pageType).toBe('active');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Vintage Camera Lens');
  });

  it('parses AUD prices', () => {
    const doc = new JSDOM(auFixture).window.document;
    const result = ebayAuScript.extractFromPage(doc, 'https://www.ebay.com.au/sch/i.html?_nkw=camera');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(39.99);
    expect(listings[1].price).toBe(8.5);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = ebayAuScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns ebay.com.au URLs', () => {
    const targets = ebayAuScript.getNavigationTargets('camera', auMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('ebay.com.au/sch/');
    expect(targets[0]).toContain(encodeURIComponent('camera'));
  });

  it('normalizeData produces NormalizedPlatformData with AUD', () => {
    const doc = new JSDOM(auFixture).window.document;
    const raw = ebayAuScript.extractFromPage(doc, 'https://www.ebay.com.au/sch/i.html?_nkw=camera');
    expect(raw).not.toBeNull();

    const normalized = ebayAuScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('ebay-au');
    expect(normalized.marketId).toBe('au');
    expect(normalized.listings[0].currency).toBe('AUD');
  });

  it('has correct static properties', () => {
    expect(ebayAuScript.platformId).toBe('ebay-au');
    expect(ebayAuScript.marketId).toBe('au');
    expect(ebayAuScript.version).toBe('1.0.0');
    expect(ebayAuScript.homeUrl).toBe('https://www.ebay.com.au');
  });
});
