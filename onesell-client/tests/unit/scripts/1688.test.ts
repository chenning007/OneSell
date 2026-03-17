import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { alibabaChScript } from '../../../src/main/extraction/scripts/1688/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['1688'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="sm-offer-item">
    <a class="offer-title" title="手机壳批发 硅胶保护套" href="/offer/123.html">
      <span>手机壳批发 硅胶保护套</span>
    </a>
    <em class="offer-price">3.50</em>
    <span class="offer-quantity">≥100件</span>
    <span class="offer-ratingNum">4.8</span>
    <span class="offer-company"><span>义乌市</span></span>
  </div>
  <div class="sm-offer-item">
    <a class="offer-title" title="蓝牙耳机工厂直销" href="/offer/456.html">
      <span>蓝牙耳机工厂直销</span>
    </a>
    <em class="offer-price">15.80</em>
    <span class="offer-quantity">≥50件</span>
    <span class="offer-ratingNum">4.6</span>
    <span class="offer-company"><span>深圳市</span></span>
  </div>
</body></html>`;

const captchaFixture = `<!DOCTYPE html><html><body>
  <div id="nocaptcha">验证</div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('1688.com ExtractionScript', () => {
  it('extracts search listings with wholesale prices and MOQ', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = alibabaChScript.extractFromPage(doc, 'https://s.1688.com/selloffer/offer_search.htm?keywords=test');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('1688');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('手机壳批发 硅胶保护套');
    expect(listings[0].price).toBe(3.5);
    expect(listings[0].moq).toBe(100);
    expect(listings[0].supplierRating).toBe(4.8);
    expect(listings[0].shipsFrom).toBe('义乌市');
  });

  it('extracts supplier location (shipsFrom)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = alibabaChScript.extractFromPage(doc, 'https://s.1688.com/selloffer/offer_search.htm?keywords=test');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].shipsFrom).toBe('深圳市');
  });

  it('returns null on CAPTCHA page', () => {
    const doc = new JSDOM(captchaFixture).window.document;
    const result = alibabaChScript.extractFromPage(doc, 'https://s.1688.com/selloffer/offer_search.htm?keywords=test');
    expect(result).toBeNull();
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = alibabaChScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no items found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = alibabaChScript.extractFromPage(doc, 'https://s.1688.com/selloffer/offer_search.htm?keywords=test');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns 1688 search URL', () => {
    const targets = alibabaChScript.getNavigationTargets('手机壳', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('1688.com');
  });

  it('normalizeData produces CNY listings with supplier rating', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = alibabaChScript.extractFromPage(doc, 'https://s.1688.com/selloffer/offer_search.htm?keywords=test');
    const normalized = alibabaChScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('1688');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
    expect(normalized.listings[0].rating).toBe(4.8);
  });

  it('has correct static properties', () => {
    expect(alibabaChScript.platformId).toBe('1688');
    expect(alibabaChScript.marketId).toBe('cn');
    expect(alibabaChScript.version).toBe('1.0.0');
    expect(alibabaChScript.homeUrl).toBe('https://www.1688.com');
  });
});
