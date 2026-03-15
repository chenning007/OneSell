import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { etsyScript } from '../../../src/main/extraction/scripts/etsy/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['etsy'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-listing-id="111222">
    <h3>Handmade Wooden Widget</h3>
    <span class="currency-value">18.99</span>
    <span class="shop2-rating-count">245</span>
    <span class="v2-listing-rating" aria-label="4.8 out of 5 stars">4.8</span>
    <a href="https://www.etsy.com/listing/111222/handmade-wooden-widget"></a>
  </div>
  <div data-listing-id="333444">
    <h3>Personalized Widget Gift</h3>
    <span class="currency-value">32.50</span>
    <span class="shop2-rating-count">87</span>
    <a href="https://www.etsy.com/listing/333444/personalized-widget-gift"></a>
  </div>
</body></html>`;

describe('Etsy ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('etsy');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].title).toBe('Handmade Wooden Widget');
    expect(listings[0].price).toBe(18.99);
    expect(listings[0].reviewCount).toBe(245);
  });

  it('unrecognized URL returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.amazon.com');
    expect(result).toBeNull();
  });

  it('search URL with empty page returns null', () => {
    const doc = new JSDOM('<html><body><div>No results found</div></body></html>').window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=xyznothing');
    expect(result).toBeNull();
  });

  it('normalizeData produces valid NormalizedPlatformData', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');
    expect(raw).not.toBeNull();
    const normalized = etsyScript.normalizeData([raw!]);

    expect(normalized.platformId).toBe('etsy');
    expect(normalized.marketId).toBe('us');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(18.99);
    expect(normalized.listings[0].reviewCount).toBe(245);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = [{
      platformId: 'etsy',
      url: 'https://www.etsy.com/search?q=test',
      extractedAt: new Date().toISOString(),
      data: {
        pageType: 'search',
        listings: [
          { title: '', price: 10, reviewCount: 5, rating: 4.5, itemUrl: '' },
          { title: 'Nice Item', price: 0, reviewCount: 3, rating: 4.0, itemUrl: '' },
          { title: 'Great Item', price: 22.50, reviewCount: 100, rating: 4.9, itemUrl: 'https://etsy.com/listing/1' },
        ],
      },
    }];
    const normalized = etsyScript.normalizeData(raw);
    expect(normalized.listings).toHaveLength(1);
    expect(normalized.listings[0].title).toBe('Great Item');
    expect(normalized.listings[0].rating).toBe(4.9);
  });

  it('getNavigationTargets returns 1 URL with keyword encoded', () => {
    const targets = etsyScript.getNavigationTargets('handmade widget', usMarket);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain('etsy.com/search');
    expect(targets[0]).toContain('handmade%20widget');
  });
});
