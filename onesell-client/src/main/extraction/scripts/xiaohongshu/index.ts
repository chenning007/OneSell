import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const xiaohongshuScript: ExtractionScript = {
  platformId: 'xiaohongshu',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://www.xiaohongshu.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&type=51`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('xiaohongshu.com')) return null;

    const cards = Array.from(
      document.querySelectorAll('.note-item, [class*="feeds-page"] section, [class*="note-card"]'),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl = card.querySelector('[class*="title"], .note-title, a span');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const likeEl = card.querySelector('[class*="like-count"], [class*="like"], .like-wrapper span');
      const likeText = likeEl ? likeEl.textContent ?? '' : '';
      let likeCount = 0;
      const wanMatch = likeText.match(/([\d.]+)\s*万/);
      if (wanMatch) {
        likeCount = Math.round(parseFloat(wanMatch[1]) * 10000);
      } else {
        const numMatch = likeText.match(/([\d,]+)/);
        if (numMatch) likeCount = parseInt(numMatch[1].replace(/,/g, ''), 10);
      }

      const authorEl = card.querySelector('[class*="author"], [class*="nickname"]');
      const author = authorEl ? authorEl.textContent?.trim() ?? '' : '';

      const tagEls = card.querySelectorAll('[class*="tag"], [class*="hashtag"]');
      const tags = Array.from(tagEls).map((t) => t.textContent?.trim() ?? '').filter(Boolean);

      return { title, likeCount, author, tags };
    });

    return {
      platformId: 'xiaohongshu',
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
        const title = typeof item.title === 'string' ? item.title : '';
        if (!title) continue;
        allListings.push({
          title,
          price: 0, // Xiaohongshu is a trend/discovery source, not a price source
          currency: 'CNY',
          reviewCount: typeof item.likeCount === 'number' ? item.likeCount : 0,
          rating: 0,
          url: page.url,
        });
      }
    }

    return {
      platformId: 'xiaohongshu',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(xiaohongshuScript);
