import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const douyinShopScript: ExtractionScript = {
  platformId: 'douyin-shop',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://haohuo.jinritemai.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://haohuo.jinritemai.com/views/search/index?keyword=${encodeURIComponent(keyword)}`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('jinritemai.com') && !url.includes('haohuo.douyin.com')) return null;

    const cards = Array.from(
      document.querySelectorAll('.search-result-item, [class*="goodsItem"], [class*="product-card"]'),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl = card.querySelector('[class*="title"], [class*="name"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl = card.querySelector('[class*="price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const salesEl = card.querySelector('[class*="sales"], [class*="sold"], [class*="volume"]');
      const salesText = salesEl ? salesEl.textContent ?? '' : '';
      let gmvRank = 0;
      const wanMatch = salesText.match(/([\d.]+)\s*万/);
      if (wanMatch) {
        gmvRank = Math.round(parseFloat(wanMatch[1]) * 10000);
      } else {
        const numMatch = salesText.match(/([\d,]+)/);
        if (numMatch) gmvRank = parseInt(numMatch[1].replace(/,/g, ''), 10);
      }

      const tagEls = card.querySelectorAll('[class*="tag"], [class*="label"]');
      const tags = Array.from(tagEls).map((t) => t.textContent?.trim() ?? '').filter(Boolean);

      return { title, price, gmvRank, tags };
    });

    return {
      platformId: 'douyin-shop',
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

      for (const item of data.listings) {
        const price = typeof item.price === 'number' ? item.price : 0;
        const title = typeof item.title === 'string' ? item.title : '';
        if (!title || !price) continue;
        allListings.push({
          title,
          price,
          currency: 'CNY',
          reviewCount: typeof item.gmvRank === 'number' ? item.gmvRank : 0,
          rating: 0,
          url: page.url,
        });
      }
    }

    return {
      platformId: 'douyin-shop',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(douyinShopScript);
