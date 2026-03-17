import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { taobaoScript } from '../../../src/main/extraction/scripts/taobao/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['taobao'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div class="Card--doubleCardWrapper">
    <a class="Title--title" href="https://item.taobao.com/item.htm?id=111">测试商品标题</a>
    <span class="Price--priceInt">29</span><span class="Price--priceDec">.90</span>
    <span class="Deal--dealCnt">1000+人付款</span>
    <span class="Shop--shopName">测试店铺</span>
  </div>
  <div class="Card--doubleCardWrapper">
    <a class="Title--title" href="https://item.taobao.com/item.htm?id=222">另一个商品</a>
    <span class="Price--priceInt">158</span>
    <span class="Deal--dealCnt">5.2万+人收货</span>
    <span class="Shop--shopName">品牌旗舰店</span>
  </div>
</body></html>`;

const captchaFixture = `<!DOCTYPE html><html><body>
  <div id="nocaptcha">滑块验证</div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('Taobao ExtractionScript', () => {
  it('extracts search listings with prices and sales', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = taobaoScript.extractFromPage(doc, 'https://s.taobao.com/search?q=test');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('taobao');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('测试商品标题');
    expect(listings[0].price).toBe(29.9);
    expect(listings[0].monthlySales).toBe(1000);
  });

  it('parses 万 (10k) sales format', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = taobaoScript.extractFromPage(doc, 'https://s.taobao.com/search?q=test');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].monthlySales).toBe(52000);
  });

  it('returns null on CAPTCHA page', () => {
    const doc = new JSDOM(captchaFixture).window.document;
    const result = taobaoScript.extractFromPage(doc, 'https://s.taobao.com/search?q=test');
    expect(result).toBeNull();
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = taobaoScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = taobaoScript.extractFromPage(doc, 'https://s.taobao.com/search?q=test');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns Taobao search URL', () => {
    const targets = taobaoScript.getNavigationTargets('手机壳', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('s.taobao.com/search');
    expect(targets[0]).toContain(encodeURIComponent('手机壳'));
  });

  it('normalizeData produces valid NormalizedPlatformData with CNY', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = taobaoScript.extractFromPage(doc, 'https://s.taobao.com/search?q=test');
    expect(raw).not.toBeNull();

    const normalized = taobaoScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('taobao');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
    expect(normalized.listings[0].price).toBe(29.9);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'taobao',
      url: 'https://s.taobao.com/search?q=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null, monthlySales: 0 }] },
    };
    const normalized = taobaoScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(taobaoScript.platformId).toBe('taobao');
    expect(taobaoScript.marketId).toBe('cn');
    expect(taobaoScript.version).toBe('1.0.0');
    expect(taobaoScript.homeUrl).toBe('https://www.taobao.com');
  });
});
