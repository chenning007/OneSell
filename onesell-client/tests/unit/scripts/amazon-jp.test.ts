import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { amazonJpScript } from '../../../src/main/extraction/scripts/amazon-jp/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const jpMarket: MarketContext = {
  marketId: 'jp',
  language: 'ja-JP',
  currency: 'JPY',
  platforms: ['amazon-jp'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-component-type="s-search-result" data-asin="B00JP1234">
    <h2><a class="a-link-normal"><span class="a-text-normal">ワイヤレスマウス</span></a></h2>
    <span class="a-price"><span class="a-offscreen">¥2,980</span></span>
    <span class="a-size-base">1234</span>
    <span class="a-icon-alt">4.5</span>
  </div>
  <div data-component-type="s-search-result" data-asin="B00JP5678">
    <h2><a class="a-link-normal"><span class="a-text-normal">メカニカルキーボード</span></a></h2>
    <span class="a-price"><span class="a-offscreen">¥8,500</span></span>
    <span class="a-size-base">567</span>
    <span class="a-icon-alt">4.2</span>
  </div>
</body></html>`;

const bestsellersFixture = `<!DOCTYPE html><html><body>
  <ol id="zg-ordered-list">
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#1</span>
      <a href="/dp/B00ABCDE12"><span class="p13n-sc-line-clamp-1">日本のベストセラー</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">¥1,980</span>
    </li>
    <li class="zg-item-immersion">
      <span class="zg-bdg-text">#2</span>
      <a href="/dp/B00FGHIJ34"><span class="p13n-sc-line-clamp-1">二番目のベストセラー</span></a>
      <span class="_cDEzb_p13n-sc-price_3mJ9Z">¥980</span>
    </li>
  </ol>
</body></html>`;

describe('Amazon JP ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonJpScript.extractFromPage(doc, 'https://www.amazon.co.jp/s?k=mouse');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('amazon-jp');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('ワイヤレスマウス');
    expect(listings[0].asin).toBe('B00JP1234');
  });

  it('parses JPY prices (no-decimal integer format)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = amazonJpScript.extractFromPage(doc, 'https://www.amazon.co.jp/s?k=mouse');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(2980);
    expect(listings[1].price).toBe(8500);
  });

  it('valid bestsellers page returns RawPlatformData', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const result = amazonJpScript.extractFromPage(doc, 'https://www.amazon.co.jp/gp/bestseller');

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('bestsellers');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].rank).toBe(1);
    expect(listings[0].title).toBe('日本のベストセラー');
    expect(listings[0].price).toBe(1980);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonJpScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('search page with no cards returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = amazonJpScript.extractFromPage(doc, 'https://www.amazon.co.jp/s?k=nothing');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns amazon.co.jp URLs', () => {
    const targets = amazonJpScript.getNavigationTargets('マウス', jpMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('amazon.co.jp/s?k=');
    expect(targets[0]).toContain(encodeURIComponent('マウス'));
    expect(targets[1]).toContain('amazon.co.jp/gp/bestseller');
  });

  it('normalizeData produces valid NormalizedPlatformData with JPY', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = amazonJpScript.extractFromPage(doc, 'https://www.amazon.co.jp/s?k=mouse');
    expect(raw).not.toBeNull();

    const normalized = amazonJpScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('amazon-jp');
    expect(normalized.marketId).toBe('jp');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('JPY');
    expect(normalized.listings[0].price).toBe(2980);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'amazon-jp',
      url: 'https://www.amazon.co.jp/s?k=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = amazonJpScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(amazonJpScript.platformId).toBe('amazon-jp');
    expect(amazonJpScript.marketId).toBe('jp');
    expect(amazonJpScript.version).toBe('1.0.0');
    expect(amazonJpScript.homeUrl).toBe('https://www.amazon.co.jp');
  });
});
