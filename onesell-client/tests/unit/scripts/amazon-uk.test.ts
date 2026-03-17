import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { amazonUkScript } from '../../../src/main/extraction/scripts/amazon-uk/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const ukMarket: MarketContext = {
  marketId: 'uk',
  language: 'en-GB',
  currency: 'GBP',
  platforms: ['amazon-uk'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-component-type="s-search-result" data-asin="B00UK1234">
    <h2><a class="a-link-normal"><span class="a-text-normal">Wireless Mouse Ergonomic</span></a></h2>
    <span class="a-price"><span class="a-offscreen">£29.99</span></span>
    <span class="a-size-base">1,234</span>
    <span class="a-icon-alt">4.5 out of 5 stars</span>
  </div>
  <div data-component-type="s-search-result" data-asin="B00UK5678">
    <h2><a class="a-link-normal"><span class="a-text-normal">Keyboard Mechanical</span></a></h2>
    <span class="a-price"><span class="a-offscreen">£54.99</span></span>
    <span class="a-size-base">567</span>
    <span class="a-icon-alt">4.2 out of 5 stars</span>
  </div>
</body></html>`;

const bestsellersFixture = `<!DOCTYPE html><html><body>
  <ol id="zg-ordered-list">
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#1</span>
      <a href="/dp/B00ABCDE12"><span class="p13n-sc-line-clamp-1">UK Bestseller Product</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">£19.99</span>
    </li>
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#2</span>
      <a href="/dp/B00FGHIJ34"><span class="p13n-sc-line-clamp-1">Second UK Bestseller</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">£9.99</span>
    </li>
  </ol>
</body></html>`;

describe('Amazon UK ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonUkScript.extractFromPage(doc, 'https://www.amazon.co.uk/s?k=mouse');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('amazon-uk');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Wireless Mouse Ergonomic');
    expect(listings[0].asin).toBe('B00UK1234');
  });

  it('parses GBP prices (£ format)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonUkScript.extractFromPage(doc, 'https://www.amazon.co.uk/s?k=mouse');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(29.99);
    expect(listings[1].price).toBe(54.99);
  });

  it('valid bestsellers page returns RawPlatformData with ranked listings', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const result = amazonUkScript.extractFromPage(doc, 'https://www.amazon.co.uk/Best-Sellers/zgbs');

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('bestsellers');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].rank).toBe(1);
    expect(listings[0].title).toBe('UK Bestseller Product');
    expect(listings[0].asin).toBe('B00ABCDE12');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonUkScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('search page with no cards returns null', () => {
    const doc = new JSDOM('<html><body><div>Nothing here</div></body></html>').window.document;
    const result = amazonUkScript.extractFromPage(doc, 'https://www.amazon.co.uk/s?k=nothing');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns amazon.co.uk URLs', () => {
    const targets = amazonUkScript.getNavigationTargets('mouse', ukMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('amazon.co.uk/s?k=mouse');
    expect(targets[1]).toContain('amazon.co.uk/Best-Sellers');
  });

  it('normalizeData produces valid NormalizedPlatformData with GBP', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = amazonUkScript.extractFromPage(doc, 'https://www.amazon.co.uk/s?k=mouse');
    expect(raw).not.toBeNull();

    const normalized = amazonUkScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('amazon-uk');
    expect(normalized.marketId).toBe('uk');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('GBP');
    expect(normalized.listings[0].price).toBe(29.99);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'amazon-uk',
      url: 'https://www.amazon.co.uk/s?k=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = amazonUkScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(amazonUkScript.platformId).toBe('amazon-uk');
    expect(amazonUkScript.marketId).toBe('uk');
    expect(amazonUkScript.version).toBe('1.0.0');
    expect(amazonUkScript.homeUrl).toBe('https://www.amazon.co.uk');
  });
});
