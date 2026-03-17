import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { kuaishouShopScript } from '../../../src/main/extraction/scripts/kuaishou-shop/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['kuaishou-shop'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="goods-item-card">
    <span class="goods-item-title">快手热销商品</span>
    <span class="goods-item-price">¥25.00</span>
    <span class="goods-item-sales">已售1.2万</span>
    <span class="goods-item-category">美妆</span>
  </div>
  <div class="goods-item-card">
    <span class="goods-item-title">保温杯大容量</span>
    <span class="goods-item-price">¥45.00</span>
    <span class="goods-item-sold">已售3,456</span>
  </div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('Kuaishou Shop ExtractionScript', () => {
  it('extracts search listings with prices and sales rank', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = kuaishouShopScript.extractFromPage(doc, 'https://shop.kuaishou.com/search?keyword=test');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('kuaishou-shop');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('快手热销商品');
    expect(listings[0].price).toBe(25);
    expect(listings[0].salesRank).toBe(12000);
  });

  it('extracts category from listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = kuaishouShopScript.extractFromPage(doc, 'https://shop.kuaishou.com/search?keyword=test');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].category).toBe('美妆');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = kuaishouShopScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no items found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = kuaishouShopScript.extractFromPage(doc, 'https://shop.kuaishou.com/search?keyword=test');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns kuaishou search URL', () => {
    const targets = kuaishouShopScript.getNavigationTargets('保温杯', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('kuaishou.com');
  });

  it('normalizeData produces CNY listings with salesRank', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = kuaishouShopScript.extractFromPage(doc, 'https://shop.kuaishou.com/search?keyword=test');
    const normalized = kuaishouShopScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('kuaishou-shop');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
    expect(normalized.listings[0].salesRank).toBe(12000);
  });

  it('has correct static properties', () => {
    expect(kuaishouShopScript.platformId).toBe('kuaishou-shop');
    expect(kuaishouShopScript.marketId).toBe('cn');
    expect(kuaishouShopScript.version).toBe('1.0.0');
    expect(kuaishouShopScript.homeUrl).toContain('kuaishou.com');
  });
});
