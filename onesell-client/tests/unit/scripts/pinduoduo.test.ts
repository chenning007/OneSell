import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { pinduoduoScript } from '../../../src/main/extraction/scripts/pinduoduo/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['pinduoduo'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-tracking="item1">
    <span class="goods-title">拼多多热销手机壳</span>
    <strong class="goods-priceInt">9</strong><span class="goods-priceDec">90</span>
    <span class="goods-sales">已拼10万+件</span>
  </div>
  <div data-tracking="item2">
    <span class="goods-title">蓝牙耳机无线</span>
    <strong class="goods-priceInt">29</strong><span class="goods-priceDec">90</span>
    <span class="goods-sales">已拼5,678件</span>
  </div>
</body></html>`;

const captchaFixture = `<!DOCTYPE html><html><body>
  <div class="slider-verify-panel">验证</div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('Pinduoduo ExtractionScript', () => {
  it('extracts search listings with prices and sales volume', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = pinduoduoScript.extractFromPage(doc, 'https://mobile.yangkeduo.com/search_result.html?search_key=test');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('pinduoduo');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('拼多多热销手机壳');
    expect(listings[0].price).toBe(9.9);
    expect(listings[0].salesVolume).toBe(100000);
  });

  it('parses comma-separated sales numbers', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = pinduoduoScript.extractFromPage(doc, 'https://mobile.yangkeduo.com/search_result.html?search_key=test');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].salesVolume).toBe(5678);
  });

  it('returns null on CAPTCHA page', () => {
    const doc = new JSDOM(captchaFixture).window.document;
    const result = pinduoduoScript.extractFromPage(doc, 'https://mobile.yangkeduo.com/search_result.html?search_key=test');
    expect(result).toBeNull();
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = pinduoduoScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no items found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = pinduoduoScript.extractFromPage(doc, 'https://mobile.yangkeduo.com/search_result.html?search_key=test');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns PDD search URL', () => {
    const targets = pinduoduoScript.getNavigationTargets('手机壳', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('yangkeduo.com/search');
  });

  it('normalizeData produces CNY listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = pinduoduoScript.extractFromPage(doc, 'https://mobile.yangkeduo.com/search_result.html?search_key=test');
    const normalized = pinduoduoScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('pinduoduo');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
  });

  it('has correct static properties', () => {
    expect(pinduoduoScript.platformId).toBe('pinduoduo');
    expect(pinduoduoScript.marketId).toBe('cn');
    expect(pinduoduoScript.version).toBe('1.0.0');
    expect(pinduoduoScript.homeUrl).toBe('https://www.pinduoduo.com');
  });
});
