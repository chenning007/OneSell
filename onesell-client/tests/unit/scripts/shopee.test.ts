import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { shopeeScript } from '../../../src/main/extraction/scripts/shopee/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const seaMarket: MarketContext = {
  marketId: 'sea',
  language: 'en',
  currency: 'USD',
  platforms: ['shopee'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="shopee-search-item-result__item">
    <a href="/product/123">
      <div class="Cve6sh">Wireless Bluetooth Earbuds</div>
    </a>
    <div class="ZEgDH9">$12.50</div>
    <div class="r6HknA">1.2k sold</div>
    <span class="shopee-rating-stars__lit" style="width: 90%;"></span>
    <div class="preferred-seller">Preferred</div>
    <div class="ship-from">Ships from Singapore</div>
  </div>
  <div class="shopee-search-item-result__item">
    <a href="/product/456">
      <div class="Cve6sh">Phone Case Silicone</div>
    </a>
    <div class="ZEgDH9">$3.99</div>
    <div class="r6HknA">500 sold</div>
    <span class="shopee-rating-stars__lit" style="width: 80%;"></span>
    <div class="mall-badge">Mall</div>
    <div class="location-info">Ships from Malaysia</div>
  </div>
</body></html>`;

describe('Shopee ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=earbuds');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('shopee');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Wireless Bluetooth Earbuds');
    expect(listings[0].price).toBe(12.5);
  });

  it('parses k-format sales count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=earbuds');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].monthlySales).toBe(1200);
  });

  it('parses numeric sales count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=earbuds');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].monthlySales).toBe(500);
  });

  it('extracts seller rating badge', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=earbuds');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].sellerRating).toBe('Preferred');
    expect(listings[1].sellerRating).toBe('Mall');
  });

  it('extracts ships-from location', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=earbuds');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].location).toBe('Ships from Singapore');
    expect(listings[1].location).toBe('Ships from Malaysia');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=xyz');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns Shopee search URL with encoded keyword', () => {
    const targets = shopeeScript.getNavigationTargets('phone case', seaMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('shopee.sg/search');
    expect(targets[0]).toContain(encodeURIComponent('phone case'));
  });

  it('normalizeData produces valid NormalizedPlatformData with USD', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = shopeeScript.extractFromPage(doc, 'https://shopee.sg/search?keyword=earbuds');
    expect(raw).not.toBeNull();

    const normalized = shopeeScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('shopee');
    expect(normalized.marketId).toBe('sea');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(12.5);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'shopee',
      url: 'https://shopee.sg/search?keyword=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null, monthlySales: 0 }] },
    };
    const normalized = shopeeScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(shopeeScript.platformId).toBe('shopee');
    expect(shopeeScript.marketId).toBe('sea');
    expect(shopeeScript.version).toBe('1.0.0');
    expect(shopeeScript.homeUrl).toBe('https://shopee.sg');
  });
});
