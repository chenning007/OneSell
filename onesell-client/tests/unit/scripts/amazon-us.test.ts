import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { amazonUsScript } from '../../../src/main/extraction/scripts/amazon-us/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon-us'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-component-type="s-search-result" data-asin="B001234">
    <h2><a class="a-link-normal"><span class="a-text-normal">Test Product Title</span></a></h2>
    <span class="a-price"><span class="a-offscreen">$29.99</span></span>
    <span class="a-size-base">1,234</span>
    <span class="a-icon-alt">4.5 out of 5 stars</span>
  </div>
  <div data-component-type="s-search-result" data-asin="B005678">
    <h2><a class="a-link-normal"><span class="a-text-normal">Another Product</span></a></h2>
    <span class="a-price"><span class="a-offscreen">$14.99</span></span>
    <span class="a-size-base">567</span>
    <span class="a-icon-alt">3.8 out of 5 stars</span>
  </div>
</body></html>`;

const bestsellersFixture = `<!DOCTYPE html><html><body>
  <ol id="zg-ordered-list">
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#1</span>
      <a href="/dp/B00ABCDE12"><span class="p13n-sc-line-clamp-1">Bestseller Product</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">$19.99</span>
    </li>
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#2</span>
      <a href="/dp/B00FGHIJ34"><span class="p13n-sc-line-clamp-1">Second Bestseller</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">$9.99</span>
    </li>
  </ol>
</body></html>`;

describe('Amazon US ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonUsScript.extractFromPage(doc, 'https://www.amazon.com/s?k=widget');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('amazon-us');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Test Product Title');
    expect(listings[0].asin).toBe('B001234');
    expect(listings[0].price).toBe(29.99);
    expect(listings[0].rating).toBe(4.5);
  });

  it('valid bestsellers page returns RawPlatformData with ranked listings', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const result = amazonUsScript.extractFromPage(doc, 'https://www.amazon.com/Best-Sellers/zgbs');

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('bestsellers');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].rank).toBe(1);
    expect(listings[0].title).toBe('Bestseller Product');
    expect(listings[0].asin).toBe('B00ABCDE12');
  });

  it('unrecognized URL returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonUsScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('normalizeData produces valid NormalizedPlatformData from search page', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = amazonUsScript.extractFromPage(doc, 'https://www.amazon.com/s?k=widget');
    expect(raw).not.toBeNull();
    const normalized = amazonUsScript.normalizeData([raw!]);

    expect(normalized.platformId).toBe('amazon-us');
    expect(normalized.marketId).toBe('us');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(29.99);
  });

  it('getNavigationTargets returns 2 URLs for a keyword', () => {
    const targets = amazonUsScript.getNavigationTargets('widget', usMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('amazon.com/s?k=widget');
    expect(targets[1]).toContain('Best-Sellers');
  });

  it('search page with no cards returns null', () => {
    const doc = new JSDOM('<html><body><div>Nothing here</div></body></html>').window.document;
    const result = amazonUsScript.extractFromPage(doc, 'https://www.amazon.com/s?k=something');
    expect(result).toBeNull();
  });
});
