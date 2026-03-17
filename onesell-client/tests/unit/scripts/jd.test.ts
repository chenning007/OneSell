import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { jdScript } from '../../../src/main/extraction/scripts/jd/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['jd'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <li class="gl-item" data-sku="100001">
    <div class="p-name"><a><em>京东自营手机壳</em></a></div>
    <div class="p-price"><strong><i>39.90</i></strong></div>
    <div class="p-commit"><strong><a>2.5万+</a></strong></div>
    <div class="p-shop"><a>京东自营</a></div>
    <div class="p-icons"><span class="goods-icons"><i>自营</i></span></div>
  </li>
  <li class="gl-item" data-sku="100002">
    <div class="p-name"><a><em>蓝牙耳机</em></a></div>
    <div class="p-price"><strong><i>199.00</i></strong></div>
    <div class="p-commit"><strong><a>8,567</a></strong></div>
    <div class="p-shop"><a>品牌旗舰店</a></div>
  </li>
</body></html>`;

const bestsellersFixture = `<!DOCTYPE html><html><body>
  <ul id="sales-list">
    <li><a>畅销商品A</a><span class="price">¥59.00</span></li>
    <li><a>畅销商品B</a><span class="price">¥129.00</span></li>
  </ul>
</body></html>`;

const captchaFixture = `<!DOCTYPE html><html><body>
  <div class="verify-wrap">请完成验证</div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('JD.com ExtractionScript', () => {
  it('extracts search listings with review counts', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = jdScript.extractFromPage(doc, 'https://search.jd.com/Search?keyword=test');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('jd');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('京东自营手机壳');
    expect(listings[0].price).toBe(39.9);
    expect(listings[0].reviewCount).toBe(25000);
  });

  it('parses comma-separated review counts', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = jdScript.extractFromPage(doc, 'https://search.jd.com/Search?keyword=test');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].reviewCount).toBe(8567);
  });

  it('extracts bestsellers page with rankings', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const result = jdScript.extractFromPage(doc, 'https://rank.jd.com/saletop/sale_tot.html');

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('bestsellers');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].rank).toBe(1);
    expect(listings[0].title).toBe('畅销商品A');
    expect(listings[0].price).toBe(59);
  });

  it('returns null on CAPTCHA / verify page', () => {
    const doc = new JSDOM(captchaFixture).window.document;
    const result = jdScript.extractFromPage(doc, 'https://search.jd.com/Search?keyword=test');
    expect(result).toBeNull();
  });

  it('returns null on risk-control redirect URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = jdScript.extractFromPage(doc, 'https://safe.jd.com/verify');
    expect(result).toBeNull();
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = jdScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns search + bestsellers URLs', () => {
    const targets = jdScript.getNavigationTargets('手机', cnMarket);
    expect(targets.length).toBe(2);
    expect(targets[0]).toContain('search.jd.com');
    expect(targets[1]).toContain('rank.jd.com');
  });

  it('normalizeData produces CNY listings from search page', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = jdScript.extractFromPage(doc, 'https://search.jd.com/Search?keyword=test');
    const normalized = jdScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('jd');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
  });

  it('normalizeData includes salesRank from bestsellers', () => {
    const doc = new JSDOM(bestsellersFixture).window.document;
    const raw = jdScript.extractFromPage(doc, 'https://rank.jd.com/saletop/sale_tot.html');
    const normalized = jdScript.normalizeData([raw!]);
    expect(normalized.listings[0].salesRank).toBe(1);
  });

  it('has correct static properties', () => {
    expect(jdScript.platformId).toBe('jd');
    expect(jdScript.marketId).toBe('cn');
    expect(jdScript.version).toBe('1.0.0');
    expect(jdScript.homeUrl).toBe('https://www.jd.com');
  });
});
