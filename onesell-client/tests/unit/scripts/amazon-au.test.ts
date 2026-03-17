import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { amazonAuScript } from '../../../src/main/extraction/scripts/amazon-au/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const auMarket: MarketContext = {
  marketId: 'au',
  language: 'en-AU',
  currency: 'AUD',
  platforms: ['amazon-au'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-component-type="s-search-result" data-asin="B00AU1234">
    <h2><a class="a-link-normal"><span class="a-text-normal">Wireless Earbuds Noise Cancelling</span></a></h2>
    <span class="a-price"><span class="a-offscreen">$49.99</span></span>
    <span class="a-size-base">890</span>
    <span class="a-icon-alt">4.3 out of 5 stars</span>
  </div>
  <div data-component-type="s-search-result" data-asin="B00AU5678">
    <h2><a class="a-link-normal"><span class="a-text-normal">Phone Stand Adjustable</span></a></h2>
    <span class="a-price"><span class="a-offscreen">$19.95</span></span>
    <span class="a-size-base">2340</span>
    <span class="a-icon-alt">4.6 out of 5 stars</span>
  </div>
</body></html>`;

const bestsellersFixture = `<!DOCTYPE html><html><body>
  <ol id="zg-ordered-list">
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#1</span>
      <a href="/dp/B00ABCDE12"><span class="p13n-sc-line-clamp-1">AU Bestseller Item</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">$29.99</span>
    </li>
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#2</span>
      <a href="/dp/B00FGHIJ34"><span class="p13n-sc-line-clamp-1">Second AU Bestseller</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">$14.95</span>
    </li>
  </ol>
</body></html>`;

describe('Amazon AU ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonAuScript.extractFromPage(doc, 'https://www.amazon.com.au/s?k=earbuds');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('amazon-au');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Wireless Earbuds Noise Cancelling');
    expect(listings[0].asin).toBe('B00AU1234');
  });

  it('parses AUD prices', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonAuScript.extractFromPage(doc, 'https://www.amazon.com.au/s?k=earbuds');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(49.99);
    expect(listings[1].price).toBe(19.95);
  });

  it('valid bestsellers page returns RawPlatformData', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const result = amazonAuScript.extractFromPage(doc, 'https://www.amazon.com.au/gp/bestseller');

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('bestsellers');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].rank).toBe(1);
    expect(listings[0].title).toBe('AU Bestseller Item');
    expect(listings[0].price).toBe(29.99);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonAuScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('search page with no cards returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonAuScript.extractFromPage(doc, 'https://www.amazon.com.au/s?k=nothing');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns amazon.com.au URLs', () => {
    const targets = amazonAuScript.getNavigationTargets('earbuds', auMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('amazon.com.au/s?k=earbuds');
    expect(targets[1]).toContain('amazon.com.au/gp/bestseller');
  });

  it('normalizeData produces valid NormalizedPlatformData with AUD', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = amazonAuScript.extractFromPage(doc, 'https://www.amazon.com.au/s?k=earbuds');
    expect(raw).not.toBeNull();

    const normalized = amazonAuScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('amazon-au');
    expect(normalized.marketId).toBe('au');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('AUD');
    expect(normalized.listings[0].price).toBe(49.99);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'amazon-au',
      url: 'https://www.amazon.com.au/s?k=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = amazonAuScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(amazonAuScript.platformId).toBe('amazon-au');
    expect(amazonAuScript.marketId).toBe('au');
    expect(amazonAuScript.version).toBe('1.0.0');
    expect(amazonAuScript.homeUrl).toBe('https://www.amazon.com.au');
  });
});
