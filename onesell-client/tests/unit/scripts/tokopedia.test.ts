import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { tokopediaScript } from '../../../src/main/extraction/scripts/tokopedia/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const seaMarket: MarketContext = {
  marketId: 'sea',
  language: 'id',
  currency: 'IDR',
  platforms: ['tokopedia'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="prd_container-card">
    <a href="https://www.tokopedia.com/shop/product-1">
      <span class="prd_link-product-name">Sepatu Sneakers Pria</span>
    </a>
    <span class="prd_link-product-price">Rp150.000</span>
    <span class="prd_rating">250</span>
    <span class="prd_rating-average">4.8</span>
    <span class="prd_link-shop-name">TokoSepatu</span>
    <span class="prd_link-shop-loc">Jakarta Selatan</span>
  </div>
  <div class="prd_container-card">
    <a href="https://www.tokopedia.com/shop/product-2">
      <span class="prd_link-product-name">Tas Ransel Laptop</span>
    </a>
    <span class="prd_link-product-price">Rp89.000</span>
    <span class="prd_rating">1,200</span>
    <span class="prd_rating-average">4.5</span>
    <span class="prd_link-shop-name">BagStore</span>
    <span class="prd_link-shop-loc">Bandung</span>
  </div>
</body></html>`;

describe('Tokopedia ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tokopediaScript.extractFromPage(doc, 'https://www.tokopedia.com/search?q=sepatu');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('tokopedia');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Sepatu Sneakers Pria');
  });

  it('parses IDR prices correctly (large integers, no decimals)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tokopediaScript.extractFromPage(doc, 'https://www.tokopedia.com/search?q=sepatu');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(150000);
    expect(listings[1].price).toBe(89000);
  });

  it('extracts shop location', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tokopediaScript.extractFromPage(doc, 'https://www.tokopedia.com/search?q=sepatu');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].location).toBe('Jakarta Selatan');
    expect(listings[1].location).toBe('Bandung');
  });

  it('extracts rating', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = tokopediaScript.extractFromPage(doc, 'https://www.tokopedia.com/search?q=sepatu');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].rating).toBe(4.8);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = tokopediaScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = tokopediaScript.extractFromPage(doc, 'https://www.tokopedia.com/search?q=xyz');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns Tokopedia search URL with encoded keyword', () => {
    const targets = tokopediaScript.getNavigationTargets('sepatu pria', seaMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('tokopedia.com/search');
    expect(targets[0]).toContain(encodeURIComponent('sepatu pria'));
  });

  it('normalizeData produces valid NormalizedPlatformData with IDR', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = tokopediaScript.extractFromPage(doc, 'https://www.tokopedia.com/search?q=sepatu');
    expect(raw).not.toBeNull();

    const normalized = tokopediaScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('tokopedia');
    expect(normalized.marketId).toBe('sea');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('IDR');
    expect(normalized.listings[0].price).toBe(150000);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'tokopedia',
      url: 'https://www.tokopedia.com/search?q=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = tokopediaScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(tokopediaScript.platformId).toBe('tokopedia');
    expect(tokopediaScript.marketId).toBe('sea');
    expect(tokopediaScript.version).toBe('1.0.0');
    expect(tokopediaScript.homeUrl).toBe('https://www.tokopedia.com');
  });
});
