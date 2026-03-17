import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const tiktokShopSeaScript: ExtractionScript = {
  platformId: 'tiktok-shop-sea',
  marketId: 'sea',
  version: '1.0.0',
  homeUrl: 'https://seller.tiktok.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://shop.tiktok.com/search?q=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('tiktok.com')) return null;

    const cards = Array.from(
      document.querySelectorAll(
        '.search-result-card, [class*="product-card"], [data-e2e="product-card"]',
      ),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl =
        card.querySelector('.product-title') ??
        card.querySelector('[class*="product-title"]') ??
        card.querySelector('[class*="title"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        card.querySelector('.product-price') ??
        card.querySelector('[class*="product-price"]') ??
        card.querySelector('[class*="price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const salesEl =
        card.querySelector('[class*="sold"]') ??
        card.querySelector('[data-e2e="product-sales"]');
      const salesText = salesEl ? salesEl.textContent ?? '' : '';
      // Handle "1.2k sold" or "500 sold" patterns
      let salesCount = 0;
      const kMatch = salesText.match(/([\d.]+)\s*k/i);
      if (kMatch) {
        salesCount = Math.round(parseFloat(kMatch[1]) * 1000);
      } else {
        const numMatch = salesText.match(/([\d,]+)/);
        if (numMatch) {
          salesCount = parseInt(numMatch[1].replace(/,/g, ''), 10);
        }
      }

      const ratingEl = card.querySelector('[class*="rating"], [class*="star"]');
      const ratingText = ratingEl ? ratingEl.textContent?.trim() ?? '' : '';
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

      const shopEl = card.querySelector('[class*="shop-name"], [class*="seller"]');
      const shopName = shopEl ? shopEl.textContent?.trim() ?? '' : '';

      const linkEl = card.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, salesCount, rating, shopName, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'tiktok-shop-sea',
      url,
      extractedAt,
      data: { pageType: 'search', listings },
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
        listings: Array<Record<string, unknown>>;
      };

      for (const item of data.listings ?? []) {
        const title = typeof item.title === 'string' ? item.title : '';
        const price = typeof item.price === 'number' ? item.price : 0;
        if (!title || !price) continue;

        allListings.push({
          title,
          price,
          currency: 'USD',
          reviewCount: typeof item.salesCount === 'number' ? item.salesCount : 0,
          rating: typeof item.rating === 'number' ? item.rating : 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'tiktok-shop-sea',
      marketId: 'sea',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(tiktokShopSeaScript);
