import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { mercariJpScript } from '../../../src/main/extraction/scripts/mercari-jp/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const jpMarket: MarketContext = {
  marketId: 'jp',
  language: 'ja-JP',
  currency: 'JPY',
  platforms: ['mercari-jp'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-testid="item-cell">
    <a href="/item/m12345">
      <span class="itemName">ヴィンテージ腕時計</span>
    </a>
    <span class="itemPrice">¥15,000</span>
    <span class="itemCondition">目立った傷や汚れなし</span>
    <span class="sellerRating">4.8</span>
  </div>
  <div data-testid="item-cell">
    <a href="/item/m67890">
      <span class="itemName">ブランドバッグ</span>
    </a>
    <span class="itemPrice">¥8,500</span>
    <span class="itemCondition">やや傷や汚れあり</span>
    <span class="soldOut">SOLD</span>
    <span class="sellerRating">4.5</span>
  </div>
</body></html>`;

describe('Mercari JP ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=watch');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('mercari-jp');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('ヴィンテージ腕時計');
  });

  it('parses JPY prices (integer, no decimals)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=watch');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(15000);
    expect(listings[1].price).toBe(8500);
  });

  it('extracts item condition', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=watch');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].condition).toBe('目立った傷や汚れなし');
    expect(listings[1].condition).toBe('やや傷や汚れあり');
  });

  it('detects sold/available status', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=watch');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].status).toBe('available');
    expect(listings[1].status).toBe('sold');
  });

  it('extracts seller rating', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=watch');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].sellerRating).toBe(4.8);
    expect(listings[1].sellerRating).toBe(4.5);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=xyz');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns mercari search URL with encoded keyword', () => {
    const targets = mercariJpScript.getNavigationTargets('腕時計', jpMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('jp.mercari.com/search');
    expect(targets[0]).toContain(encodeURIComponent('腕時計'));
  });

  it('normalizeData produces valid NormalizedPlatformData with JPY', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = mercariJpScript.extractFromPage(doc, 'https://jp.mercari.com/search?keyword=watch');
    expect(raw).not.toBeNull();

    const normalized = mercariJpScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('mercari-jp');
    expect(normalized.marketId).toBe('jp');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('JPY');
    expect(normalized.listings[0].price).toBe(15000);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'mercari-jp',
      url: 'https://jp.mercari.com/search?keyword=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = mercariJpScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(mercariJpScript.platformId).toBe('mercari-jp');
    expect(mercariJpScript.marketId).toBe('jp');
    expect(mercariJpScript.version).toBe('1.0.0');
    expect(mercariJpScript.homeUrl).toBe('https://jp.mercari.com');
  });
});
