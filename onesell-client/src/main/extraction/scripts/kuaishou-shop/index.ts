import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const kuaishouShopScript: ExtractionScript = {
  platformId: 'kuaishou-shop',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://shop.kuaishou.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://shop.kuaishou.com/search?keyword=${encodeURIComponent(keyword)}`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('kuaishou.com')) return null;

    const cards = Array.from(
      document.querySelectorAll('[class*="goods-item-card"], [class*="product-card"], .search-item'),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl = card.querySelector('[class*="title"], [class*="name"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl = card.querySelector('[class*="price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const salesEl = card.querySelector('[class*="sales"], [class*="sold"]');
      const salesText = salesEl ? salesEl.textContent ?? '' : '';
      let salesRank = 0;
      const wanMatch = salesText.match(/([\d.]+)\s*万/);
      if (wanMatch) {
        salesRank = Math.round(parseFloat(wanMatch[1]) * 10000);
      } else {
        const numMatch = salesText.match(/([\d,]+)/);
        if (numMatch) salesRank = parseInt(numMatch[1].replace(/,/g, ''), 10);
      }

      const categoryEl = card.querySelector('[class*="category"], [class*="tag"]');
      const category = categoryEl ? categoryEl.textContent?.trim() ?? '' : '';

      return { title, price, salesRank, category };
    });

    return {
      platformId: 'kuaishou-shop',
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
      readonly salesRank?: number;
      readonly url: string;
    }> = [];

    for (const page of raw) {
      const data = page.data as {
        pageType: string;
        listings: Array<Record<string, unknown>>;
      };

      for (const item of data.listings) {
        const price = typeof item.price === 'number' ? item.price : 0;
        const title = typeof item.title === 'string' ? item.title : '';
        if (!title || !price) continue;
        allListings.push({
          title,
          price,
          currency: 'CNY',
          reviewCount: 0,
          rating: 0,
          salesRank: typeof item.salesRank === 'number' ? item.salesRank : undefined,
          url: page.url,
        });
      }
    }

    return {
      platformId: 'kuaishou-shop',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(kuaishouShopScript);
