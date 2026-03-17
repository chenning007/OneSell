import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const rakutenScript: ExtractionScript = {
  platformId: 'rakuten',
  marketId: 'jp',
  version: '1.0.0',
  homeUrl: 'https://www.rakuten.co.jp',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('search.rakuten.co.jp/search')) return null;

    const cards = Array.from(
      document.querySelectorAll(
        '.searchresultitem, [class*="dui-card"], .searchresultitems .content',
      ),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl =
        card.querySelector('.content.title a') ??
        card.querySelector('[class*="title"] a') ??
        card.querySelector('h2 a');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        card.querySelector('.important') ??
        card.querySelector('[class*="price"]');
      // JPY: "1,980円" — strip non-digits
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9]/g, '') ?? '' : '';
      const price = priceText ? parseInt(priceText, 10) : null;

      const reviewEl = card.querySelector('[class*="review"] a, [class*="revNum"]');
      const reviewText = reviewEl ? reviewEl.textContent ?? '' : '';
      const reviewMatch = reviewText.match(/([\d,]+)/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : 0;

      const ratingEl = card.querySelector('[class*="revRating"], [class*="rating"]');
      const ratingText = ratingEl ? ratingEl.textContent?.trim() ?? '' : '';
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

      const shopEl = card.querySelector('[class*="merchant"] a, [class*="shopName"]');
      const shopName = shopEl ? shopEl.textContent?.trim() ?? '' : '';

      const pointsEl = card.querySelector('[class*="point"], [class*="pointRate"]');
      const pointsText = pointsEl ? pointsEl.textContent ?? '' : '';
      const pointsMatch = pointsText.match(/(\d+)\s*倍/);
      const pointsPercentage = pointsMatch ? parseInt(pointsMatch[1], 10) : 0;

      const linkEl = card.querySelector('a[href*="item.rakuten.co.jp"]') ?? card.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, reviewCount, rating, shopName, pointsPercentage, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'rakuten',
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
          currency: 'JPY',
          reviewCount: typeof item.reviewCount === 'number' ? item.reviewCount : 0,
          rating: typeof item.rating === 'number' ? item.rating : 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'rakuten',
      marketId: 'jp',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(rakutenScript);
