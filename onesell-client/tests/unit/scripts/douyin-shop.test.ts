import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { douyinShopScript } from '../../../src/main/extraction/scripts/douyin-shop/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['douyin-shop'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="search-result-item">
    <span class="item-title">抖音爆款手机壳</span>
    <span class="item-price">¥19.90</span>
    <span class="item-sales">已售3.5万</span>
    <span class="item-tag">热销</span>
    <span class="item-tag">直播推荐</span>
  </div>
  <div class="search-result-item">
    <span class="item-title">无线蓝牙耳机</span>
    <span class="item-price">¥59.00</span>
    <span class="item-volume">已售8,900</span>
  </div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('Douyin Shop ExtractionScript', () => {
  it('extracts search listings with prices and GMV rank', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = douyinShopScript.extractFromPage(doc, 'https://haohuo.jinritemai.com/views/search/index?keyword=test');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('douyin-shop');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('抖音爆款手机壳');
    expect(listings[0].price).toBe(19.9);
    expect(listings[0].gmvRank).toBe(35000);
  });

  it('extracts tags from listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = douyinShopScript.extractFromPage(doc, 'https://haohuo.jinritemai.com/views/search/index?keyword=test');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    const tags = listings[0].tags as string[];
    expect(tags).toContain('热销');
    expect(tags).toContain('直播推荐');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = douyinShopScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no items found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = douyinShopScript.extractFromPage(doc, 'https://haohuo.jinritemai.com/views/search/index?keyword=test');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns jinritemai search URL', () => {
    const targets = douyinShopScript.getNavigationTargets('手机壳', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('jinritemai.com');
  });

  it('normalizeData produces CNY listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = douyinShopScript.extractFromPage(doc, 'https://haohuo.jinritemai.com/views/search/index?keyword=test');
    const normalized = douyinShopScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('douyin-shop');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
  });

  it('has correct static properties', () => {
    expect(douyinShopScript.platformId).toBe('douyin-shop');
    expect(douyinShopScript.marketId).toBe('cn');
    expect(douyinShopScript.version).toBe('1.0.0');
    expect(douyinShopScript.homeUrl).toContain('jinritemai.com');
  });
});
