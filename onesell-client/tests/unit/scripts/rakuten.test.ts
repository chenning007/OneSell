import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { rakutenScript } from '../../../src/main/extraction/scripts/rakuten/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const jpMarket: MarketContext = {
  marketId: 'jp',
  language: 'ja-JP',
  currency: 'JPY',
  platforms: ['rakuten'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="searchresultitem">
    <h2><a href="https://item.rakuten.co.jp/shop/item1">ワイヤレスイヤホン Bluetooth</a></h2>
    <span class="important">3,980円</span>
    <span class="revNum"><a>(250)</a></span>
    <span class="revRating">4.6</span>
    <span class="merchant"><a>オーディオショップ</a></span>
    <span class="pointRate">5倍</span>
  </div>
  <div class="searchresultitem">
    <h2><a href="https://item.rakuten.co.jp/shop/item2">充電ケーブル USB-C</a></h2>
    <span class="important">980円</span>
    <span class="revNum"><a>(1,200)</a></span>
    <span class="revRating">4.3</span>
    <span class="merchant"><a>ケーブルストア</a></span>
    <span class="pointRate">3倍</span>
  </div>
</body></html>`;

describe('Rakuten ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/earphone/');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('rakuten');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('ワイヤレスイヤホン Bluetooth');
  });

  it('parses JPY prices (integer, no decimals)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/earphone/');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(3980);
    expect(listings[1].price).toBe(980);
  });

  it('extracts review count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/earphone/');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].reviewCount).toBe(250);
    expect(listings[1].reviewCount).toBe(1200);
  });

  it('extracts points percentage (倍)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/earphone/');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].pointsPercentage).toBe(5);
    expect(listings[1].pointsPercentage).toBe(3);
  });

  it('extracts rating', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/earphone/');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].rating).toBe(4.6);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/xyz/');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns rakuten.co.jp search URLs with encoded keyword', () => {
    const targets = rakutenScript.getNavigationTargets('イヤホン', jpMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('search.rakuten.co.jp/search/mall/');
    expect(targets[0]).toContain(encodeURIComponent('イヤホン'));
  });

  it('normalizeData produces valid NormalizedPlatformData with JPY', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = rakutenScript.extractFromPage(doc, 'https://search.rakuten.co.jp/search/mall/earphone/');
    expect(raw).not.toBeNull();

    const normalized = rakutenScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('rakuten');
    expect(normalized.marketId).toBe('jp');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('JPY');
    expect(normalized.listings[0].price).toBe(3980);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'rakuten',
      url: 'https://search.rakuten.co.jp/search/mall/test/',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = rakutenScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(rakutenScript.platformId).toBe('rakuten');
    expect(rakutenScript.marketId).toBe('jp');
    expect(rakutenScript.version).toBe('1.0.0');
    expect(rakutenScript.homeUrl).toBe('https://www.rakuten.co.jp');
  });
});
