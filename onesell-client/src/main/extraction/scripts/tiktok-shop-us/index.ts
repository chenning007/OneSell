import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const tiktokShopUsScript: ExtractionScript = {
  platformId: 'tiktok-shop-us',
  marketId: 'us',
  version: '1.0.0',
  homeUrl: 'https://www.tiktok.com/shop/browse',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.tiktok.com/shop/browse?keyword=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('tiktok.com')) return null;

    // TikTok Shop product cards
    const items = Array.from(
      document.querySelectorAll(
        '[class*="product-card"], [class*="ProductCard"], [data-e2e="product-card"]',
      ),
    ).slice(0, 50);

    // If no product cards, try to extract trending hashtags from the page
    if (items.length === 0) {
      const hashtagEls = Array.from(
        document.querySelectorAll(
          '[class*="hashtag"], [class*="challenge-name"], [data-e2e="challenge-item"]',
        ),
      ).slice(0, 20);

      if (hashtagEls.length === 0) return null;

      const hashtags = hashtagEls.map((el) => {
        const tag = el.textContent?.trim() ?? '';
        const viewsEl = el.parentElement?.querySelector('[class*="view"]');
        const viewsText = viewsEl ? viewsEl.textContent ?? '' : '';
        const viewsMatch = viewsText.match(/([\d.]+)\s*([KMB]?)/i);
        let views = 0;
        if (viewsMatch) {
          const num = parseFloat(viewsMatch[1]);
          const unit = (viewsMatch[2] ?? '').toUpperCase();
          if (unit === 'K') views = num * 1000;
          else if (unit === 'M') views = num * 1_000_000;
          else if (unit === 'B') views = num * 1_000_000_000;
          else views = num;
        }
        return { tag, views };
      }).filter((h) => h.tag !== '');

      return {
        platformId: 'tiktok-shop-us',
        url,
        extractedAt,
        data: { pageType: 'hashtags', hashtags, products: [] },
      };
    }

    const products = items.map((item) => {
      const titleEl =
        item.querySelector('[class*="product-title"]') ??
        item.querySelector('[class*="title"]') ??
        item.querySelector('p');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        item.querySelector('[class*="price"]') ??
        item.querySelector('[data-e2e="product-price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const soldEl =
        item.querySelector('[class*="sold"]') ??
        item.querySelector('[data-e2e="product-sales"]');
      const soldText = soldEl ? soldEl.textContent ?? '' : '';
      const soldMatch = soldText.match(/([\d,]+)/);
      const soldCount = soldMatch ? parseInt(soldMatch[1].replace(/,/g, ''), 10) : 0;

      return { title, price, soldCount };
    }).filter((p) => p.title !== '');

    if (products.length === 0) return null;

    return {
      platformId: 'tiktok-shop-us',
      url,
      extractedAt,
      data: { pageType: 'products', products, hashtags: [] },
    };
  },

  normalizeData(raw: RawPlatformData[]): NormalizedPlatformData {
    const allListings: Array<{
      readonly title: string;
      readonly price: number;
      readonly currency: string;
      readonly reviewCount: number;
      readonly rating: number;
      readonly url: string;
    }> = [];

    for (const page of raw) {
      const data = page.data as {
        pageType: string;
        products?: Array<Record<string, unknown>>;
        hashtags?: Array<Record<string, unknown>>;
      };

      if (data.pageType === 'products') {
        for (const item of data.products ?? []) {
          const title = typeof item.title === 'string' ? item.title : '';
          const price = typeof item.price === 'number' ? item.price : 0;
          if (!title || !price) continue;

          allListings.push({
            title,
            price,
            currency: 'USD',
            reviewCount: 0,
            rating: 0,
            url: page.url,
          });
        }
      }
    }

    return {
      platformId: 'tiktok-shop-us',
      marketId: 'us',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(tiktokShopUsScript);
