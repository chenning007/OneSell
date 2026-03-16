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

const hashtagWithViewsFixture = `<!DOCTYPE html><html><body>
  <div>
    <div class="challenge-name">#BigSeller</div>
    <span class="views">2.5M views</span>
  </div>
  <div>
    <div class="challenge-name">#QuickPick</div>
    <span class="views">150K views</span>
  </div>
  <div>
    <div class="challenge-name">#GigaTrend</div>
    <span class="views">1.2B views</span>
  </div>
</body></html>`;

const dataE2eProductFixture = `<!DOCTYPE html><html><body>
  <div data-e2e="product-card">
    <p class="title">E2E Product</p>
    <span data-e2e="product-price">$15.50</span>
    <span data-e2e="product-sales">890 sold</span>
  </div>
</body></html>`;

// --- Credential-shaped fields that must NEVER appear in extracted data (P1) ---
const CREDENTIAL_PATTERNS = /cookie|token|password|session_id|auth|secret|api.?key/i;

describe('TikTok Shop US ExtractionScript', () => {
  // --- AC: Extracts trending product hashtags, GMV indicators ---

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

  it('extracts soldCount as GMV indicator for products', () => {
    const doc = new JSDOM(productCardsFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=gadget',
    );

    expect(result).not.toBeNull();
    const products = result!.data.products as Array<Record<string, unknown>>;
    expect(products[0].soldCount).toBe(1234);
    expect(products[1].soldCount).toBe(567);
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

  it('extracts hashtag views with K/M/B unit suffixes', () => {
    const doc = new JSDOM(hashtagWithViewsFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse',
    );

    expect(result).not.toBeNull();
    const hashtags = result!.data.hashtags as Array<Record<string, unknown>>;
    expect(hashtags).toHaveLength(3);
    expect(hashtags[0].tag).toBe('#BigSeller');
    expect(hashtags[0].views).toBe(2_500_000);
    expect(hashtags[1].tag).toBe('#QuickPick');
    expect(hashtags[1].views).toBe(150_000);
    expect(hashtags[2].tag).toBe('#GigaTrend');
    expect(hashtags[2].views).toBe(1_200_000_000);
  });

  it('extracts from data-e2e selectors', () => {
    const doc = new JSDOM(dataE2eProductFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=test',
    );

    expect(result).not.toBeNull();
    const products = result!.data.products as Array<Record<string, unknown>>;
    expect(products[0].title).toBe('E2E Product');
    expect(products[0].price).toBe(15.5);
  });

  // --- AC: Returns null gracefully on DOM change ---

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

  it('product cards with all empty titles returns null', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <div class="product-card"><p class="product-title"></p><span class="price">$10.00</span></div>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=test',
    );
    expect(result).toBeNull();
  });

  // --- normalizeData ---

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

  it('normalizeData merges multiple product pages', () => {
    const raw1 = {
      platformId: 'tiktok-shop-us',
      url: 'https://www.tiktok.com/shop/browse?keyword=test',
      extractedAt: '2026-03-15T00:00:00.000Z',
      data: {
        pageType: 'products' as const,
        products: [{ title: 'Item A', price: 10, soldCount: 50 }],
        hashtags: [],
      },
    };
    const raw2 = {
      platformId: 'tiktok-shop-us',
      url: 'https://www.tiktok.com/shop/browse?keyword=test&page=2',
      extractedAt: '2026-03-15T00:00:01.000Z',
      data: {
        pageType: 'products' as const,
        products: [{ title: 'Item B', price: 20, soldCount: 100 }],
        hashtags: [],
      },
    };
    const normalized = tiktokShopUsScript.normalizeData([raw1, raw2]);
    expect(normalized.listings).toHaveLength(2);
  });

  it('normalizeData with empty raw array returns empty listings', () => {
    const normalized = tiktokShopUsScript.normalizeData([]);
    expect(normalized.listings).toHaveLength(0);
    expect(normalized.platformId).toBe('tiktok-shop-us');
  });

  // --- P6 contract: NormalizedPlatformData shape ---

  it('NormalizedPlatformData has all required interface fields', () => {
    const doc = new JSDOM(productCardsFixture).window.document;
    const raw = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=gadget',
    );
    const normalized = tiktokShopUsScript.normalizeData([raw!]);

    expect(normalized).toHaveProperty('platformId');
    expect(normalized).toHaveProperty('marketId');
    expect(normalized).toHaveProperty('extractedAt');
    expect(normalized).toHaveProperty('scriptVersion');
    expect(normalized).toHaveProperty('listings');
    expect(typeof normalized.extractedAt).toBe('string');

    for (const listing of normalized.listings) {
      expect(listing).toHaveProperty('title');
      expect(listing).toHaveProperty('price');
      expect(listing).toHaveProperty('currency');
      expect(listing).toHaveProperty('reviewCount');
      expect(listing).toHaveProperty('rating');
      expect(listing).toHaveProperty('url');
      expect(typeof listing.price).toBe('number');
      expect(typeof listing.reviewCount).toBe('number');
      expect(typeof listing.rating).toBe('number');
    }
  });

  // --- getNavigationTargets ---

  it('getNavigationTargets returns 1 URL with encoded keyword', () => {
    const targets = tiktokShopUsScript.getNavigationTargets('wireless earbuds', usMarket);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain('tiktok.com/shop/browse');
    expect(targets[0]).toContain('wireless%20earbuds');
  });

  it('getNavigationTargets encodes special characters in keyword', () => {
    const targets = tiktokShopUsScript.getNavigationTargets('beauty & skincare', usMarket);
    expect(targets[0]).toContain('beauty%20%26%20skincare');
  });

  // --- P1: Credentials never leave client ---

  it('P1: extracted product data contains no credential-shaped fields', () => {
    const doc = new JSDOM(productCardsFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=gadget',
    );
    expect(result).not.toBeNull();

    const rawJson = JSON.stringify(result);
    const keys = Object.keys(result!.data);
    for (const key of keys) {
      expect(key).not.toMatch(CREDENTIAL_PATTERNS);
    }
    expect(rawJson).not.toMatch(CREDENTIAL_PATTERNS);
  });

  it('P1: extracted hashtag data contains no credential-shaped fields', () => {
    const doc = new JSDOM(hashtagPageFixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse',
    );
    expect(result).not.toBeNull();

    const rawJson = JSON.stringify(result);
    expect(rawJson).not.toMatch(CREDENTIAL_PATTERNS);
  });

  // --- P4: MarketContext immutability ---

  it('P4: getNavigationTargets does not mutate MarketContext', () => {
    const market: MarketContext = {
      marketId: 'us',
      language: 'en-US',
      currency: 'USD',
      platforms: ['tiktok-shop-us'],
    };
    const frozen = Object.freeze({ ...market });
    const targets = tiktokShopUsScript.getNavigationTargets('widget', frozen as MarketContext);
    expect(targets.length).toBeGreaterThan(0);
  });

  // --- P5: Graceful degradation ---

  it('P5: handles product with missing price gracefully', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <div class="product-card">
        <p class="product-title">No Price Product</p>
      </div>
      <div class="product-card">
        <p class="product-title">Valid Product</p>
        <span class="price">$5.00</span>
      </div>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=test',
    );
    // Should not throw — returns data including items with null price
    expect(result).not.toBeNull();
  });

  it('P5: handles product with missing soldCount gracefully', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <div class="product-card">
        <p class="product-title">No Sales Widget</p>
        <span class="price">$8.00</span>
      </div>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = tiktokShopUsScript.extractFromPage(
      doc,
      'https://www.tiktok.com/shop/browse?keyword=test',
    );
    expect(result).not.toBeNull();
    const products = result!.data.products as Array<Record<string, unknown>>;
    expect(products[0].soldCount).toBe(0);
  });

  // --- P6: Script metadata ---

  it('P6: script has correct platformId, marketId, version, homeUrl', () => {
    expect(tiktokShopUsScript.platformId).toBe('tiktok-shop-us');
    expect(tiktokShopUsScript.marketId).toBe('us');
    expect(tiktokShopUsScript.version).toBe('1.0.0');
    expect(tiktokShopUsScript.homeUrl).toContain('tiktok.com');
  });

  // --- AC: Works with authenticated session ---

  it('AC: homeUrl points to shop browse page for session-based access', () => {
    expect(tiktokShopUsScript.homeUrl).toBe('https://www.tiktok.com/shop/browse');
  });
});
