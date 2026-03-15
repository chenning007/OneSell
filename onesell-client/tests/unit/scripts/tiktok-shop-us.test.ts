import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { tiktokShopUsScript } from '../../../src/main/extraction/scripts/tiktok-shop-us/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['tiktok-shop-us'],
};

const productCardsFixture = `<!DOCTYPE html><html><body>
  <div class="product-card">
    <p class="product-title">Viral Gadget Pro</p>
    <span class="price">$29.99</span>
    <span class="sold">1,234 sold</span>
  </div>
  <div class="product-card">
    <p class="product-title">Trending Beauty Kit</p>
    <span class="price">$19.99</span>
    <span class="sold">567 sold</span>
  </div>
</body></html>`;

const hashtagPageFixture = `<!DOCTYPE html><html><body>
  <div class="challenge-name">#ViralProducts</div>
  <div class="challenge-name">#TrendingNow</div>
  <div class="challenge-name">#MustHave</div>
</body></html>`;

describe('TikTok Shop US ExtractionScript', () => {
  it('valid product cards page returns RawPlatformData', () => {
    const doc = new JSDOM(productCardsFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=gadget',
    );

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('tiktok-shop-us');
    expect(result!.data.pageType).toBe('products');
    const products = result!.data.products as Array<Record<string, unknown>>;
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].title).toBe('Viral Gadget Pro');
    expect(products[0].price).toBe(29.99);
  });

  it('hashtag page returns RawPlatformData with hashtags', () => {
    const doc = new JSDOM(hashtagPageFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse',
    );

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('hashtags');
    const hashtags = result!.data.hashtags as Array<Record<string, unknown>>;
    expect(hashtags.length).toBeGreaterThan(0);
    expect(hashtags[0].tag).toBe('#ViralProducts');
  });

  it('unrecognized URL returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = tiktokShopUsScript.extractFromPage(doc, 'https://www.youtube.com');
    expect(result).toBeNull();
  });

  it('tiktok.com URL with no matching elements returns null', () => {
    const doc = new JSDOM('<html><body><div>Empty page</div></body></html>').window.document;
    const result = tiktokShopUsScript.extractFromPage(doc, 'https://www.tiktok.com/shop/browse?keyword=nothing');
    expect(result).toBeNull();
  });

  it('normalizeData produces valid NormalizedPlatformData from product page', () => {
    const doc = new JSDOM(productCardsFixture).window.document;
    const raw = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=gadget',
    );
    expect(raw).not.toBeNull();
    const normalized = tiktokShopUsScript.normalizeData([raw!]);

    expect(normalized.platformId).toBe('tiktok-shop-us');
    expect(normalized.marketId).toBe('us');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(29.99);
  });

  it('normalizeData for hashtags page returns empty listings (no products)', () => {
    const doc = new JSDOM(hashtagPageFixture).window.document;
    const raw = tiktokShopUsScript.extractFromPage(doc, 'https://www.tiktok.com/shop/browse');
    expect(raw).not.toBeNull();
    const normalized = tiktokShopUsScript.normalizeData([raw!]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('normalizeData skips products with no title or price', () => {
    const raw = [{
      platformId: 'tiktok-shop-us',
      url: 'https://www.tiktok.com/shop/browse?keyword=test',
      extractedAt: new Date().toISOString(),
      data: {
        pageType: 'products',
        products: [
          { title: '', price: 10, soldCount: 100 },
          { title: 'Hot Item', price: 0, soldCount: 50 },
          { title: 'Trending Item', price: 25.00, soldCount: 999 },
        ],
        hashtags: [],
      },
    }];
    const normalized = tiktokShopUsScript.normalizeData(raw);
    expect(normalized.listings).toHaveLength(1);
    expect(normalized.listings[0].title).toBe('Trending Item');
  });

  it('getNavigationTargets returns 1 URL with encoded keyword', () => {
    const targets = tiktokShopUsScript.getNavigationTargets('wireless earbuds', usMarket);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain('tiktok.com/shop/browse');
    expect(targets[0]).toContain('wireless%20earbuds');
  });
});
