import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { tiktokShopSeaScript } from '../../../src/main/extraction/scripts/tiktok-shop-sea/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const seaMarket: MarketContext = {
  marketId: 'sea',
  language: 'en',
  currency: 'USD',
  platforms: ['tiktok-shop-sea'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="search-result-card">
    <a href="/product/tt-001">
      <span class="product-title">LED Ring Light Tripod</span>
    </a>
    <span class="product-price">$18.90</span>
    <span class="sold-count">2.5k sold</span>
    <span class="rating-stars">4.6</span>
    <span class="shop-name">LightStudio</span>
  </div>
  <div class="search-result-card">
    <a href="/product/tt-002">
      <span class="product-title">Makeup Brush Set</span>
    </a>
    <span class="product-price">$9.99</span>
    <span class="sold-count">800 sold</span>
    <span class="rating-stars">4.3</span>
    <span class="shop-name">BeautyHub</span>
  </div>
</body></html>`;

describe('TikTok Shop SEA ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tiktokShopSeaScript.extractFromPage(doc, 'https://shop.tiktok.com/search?q=light');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('tiktok-shop-sea');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('LED Ring Light Tripod');
    expect(listings[0].price).toBe(18.9);
  });

  it('parses k-format sales count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tiktokShopSeaScript.extractFromPage(doc, 'https://shop.tiktok.com/search?q=light');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].salesCount).toBe(2500);
  });

  it('parses numeric sales count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tiktokShopSeaScript.extractFromPage(doc, 'https://shop.tiktok.com/search?q=light');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].salesCount).toBe(800);
  });

  it('extracts shop name', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tiktokShopSeaScript.extractFromPage(doc, 'https://shop.tiktok.com/search?q=light');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].shopName).toBe('LightStudio');
    expect(listings[1].shopName).toBe('BeautyHub');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = tiktokShopSeaScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = tiktokShopSeaScript.extractFromPage(doc, 'https://shop.tiktok.com/search?q=xyz');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns TikTok search URL with encoded keyword', () => {
    const targets = tiktokShopSeaScript.getNavigationTargets('ring light', seaMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('shop.tiktok.com/search');
    expect(targets[0]).toContain(encodeURIComponent('ring light'));
  });

  it('normalizeData produces valid NormalizedPlatformData with USD', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = tiktokShopSeaScript.extractFromPage(doc, 'https://shop.tiktok.com/search?q=light');
    expect(raw).not.toBeNull();

    const normalized = tiktokShopSeaScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('tiktok-shop-sea');
    expect(normalized.marketId).toBe('sea');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(18.9);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'tiktok-shop-sea',
      url: 'https://shop.tiktok.com/search?q=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = tiktokShopSeaScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(tiktokShopSeaScript.platformId).toBe('tiktok-shop-sea');
    expect(tiktokShopSeaScript.marketId).toBe('sea');
    expect(tiktokShopSeaScript.version).toBe('1.0.0');
    expect(tiktokShopSeaScript.homeUrl).toBe('https://seller.tiktok.com');
  });
});
