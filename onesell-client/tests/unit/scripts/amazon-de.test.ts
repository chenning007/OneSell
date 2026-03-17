import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { amazonDeScript } from '../../../src/main/extraction/scripts/amazon-de/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const deMarket: MarketContext = {
  marketId: 'de',
  language: 'de-DE',
  currency: 'EUR',
  platforms: ['amazon-de'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-component-type="s-search-result" data-asin="B00DE1234">
    <h2><a class="a-link-normal"><span class="a-text-normal">Kabellose Maus Ergonomisch</span></a></h2>
    <span class="a-price"><span class="a-offscreen">29,99 €</span></span>
    <span class="a-size-base">1.234</span>
    <span class="a-icon-alt">4,5 von 5 Sternen</span>
  </div>
  <div data-component-type="s-search-result" data-asin="B00DE5678">
    <h2><a class="a-link-normal"><span class="a-text-normal">Mechanische Tastatur</span></a></h2>
    <span class="a-price"><span class="a-offscreen">54,99 €</span></span>
    <span class="a-size-base">567</span>
    <span class="a-icon-alt">4,2 von 5 Sternen</span>
  </div>
</body></html>`;

const bestsellersFixture = `<!DOCTYPE html><html><body>
  <ol id="zg-ordered-list">
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#1</span>
      <a href="/dp/B00ABCDE12"><span class="p13n-sc-line-clamp-1">Deutsches Bestseller Produkt</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">19,99 €</span>
    </li>
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#2</span>
      <a href="/dp/B00FGHIJ34"><span class="p13n-sc-line-clamp-1">Zweites Bestseller</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">9,99 €</span>
    </li>
  </ol>
</body></html>`;

describe('Amazon DE ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonDeScript.extractFromPage(doc, 'https://www.amazon.de/s?k=maus');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('amazon-de');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Kabellose Maus Ergonomisch');
    expect(listings[0].asin).toBe('B00DE1234');
  });

  it('parses EUR prices (comma-decimal format)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonDeScript.extractFromPage(doc, 'https://www.amazon.de/s?k=maus');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(29.99);
    expect(listings[1].price).toBe(54.99);
  });

  it('parses German rating format (comma decimal)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonDeScript.extractFromPage(doc, 'https://www.amazon.de/s?k=maus');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].rating).toBe(4.5);
    expect(listings[1].rating).toBe(4.2);
  });

  it('valid bestsellers page returns RawPlatformData', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const result = amazonDeScript.extractFromPage(doc, 'https://www.amazon.de/gp/bestseller');

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('bestsellers');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].rank).toBe(1);
    expect(listings[0].title).toBe('Deutsches Bestseller Produkt');
    expect(listings[0].price).toBe(19.99);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonDeScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('search page with no cards returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonDeScript.extractFromPage(doc, 'https://www.amazon.de/s?k=nothing');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns amazon.de URLs', () => {
    const targets = amazonDeScript.getNavigationTargets('maus', deMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('amazon.de/s?k=maus');
    expect(targets[1]).toContain('amazon.de/gp/bestseller');
  });

  it('normalizeData produces valid NormalizedPlatformData with EUR', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = amazonDeScript.extractFromPage(doc, 'https://www.amazon.de/s?k=maus');
    expect(raw).not.toBeNull();

    const normalized = amazonDeScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('amazon-de');
    expect(normalized.marketId).toBe('de');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('EUR');
    expect(normalized.listings[0].price).toBe(29.99);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'amazon-de',
      url: 'https://www.amazon.de/s?k=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = amazonDeScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(amazonDeScript.platformId).toBe('amazon-de');
    expect(amazonDeScript.marketId).toBe('de');
    expect(amazonDeScript.version).toBe('1.0.0');
    expect(amazonDeScript.homeUrl).toBe('https://www.amazon.de');
  });
});
