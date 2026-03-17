import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const shopeeScript: ExtractionScript = {
  platformId: 'shopee',
  marketId: 'sea',
  version: '1.0.0',
  homeUrl: 'https://shopee.sg',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://shopee.sg/search?keyword=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('shopee.') || !url.includes('search')) return null;

    const cards = Array.from(
      document.querySelectorAll(
        '.shopee-search-item-result__item, [data-sqe="item"]',
      ),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl =
        card.querySelector('.Cve6sh') ??
        card.querySelector('.ie3A\\+n') ??
        card.querySelector('[data-sqe="name"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        card.querySelector('.ZEgDH9') ??
        card.querySelector('.vioxXd') ??
        card.querySelector('[class*="price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const salesEl =
        card.querySelector('.r6HknA') ??
        card.querySelector('[class*="sold"]');
      const salesText = salesEl ? salesEl.textContent ?? '' : '';
      // Handle "1.2k sold" or "500 sold" patterns
      let monthlySales = 0;
      const kMatch = salesText.match(/([\d.]+)\s*k/i);
      if (kMatch) {
        monthlySales = Math.round(parseFloat(kMatch[1]) * 1000);
      } else {
        const numMatch = salesText.match(/([\d,]+)/);
        if (numMatch) {
          monthlySales = parseInt(numMatch[1].replace(/,/g, ''), 10);
        }
      }

      const ratingEl = card.querySelector('.shopee-rating-stars__lit');
      const ratingStyle = ratingEl ? (ratingEl as HTMLElement).style.width : '';
      const ratingPercent = ratingStyle.match(/([\d.]+)%/);
      const rating = ratingPercent ? (parseFloat(ratingPercent[1]) / 100) * 5 : 0;

      const sellerRatingEl = card.querySelector('[class*="preferred"], [class*="mall"]');
      const sellerRating = sellerRatingEl ? sellerRatingEl.textContent?.trim() ?? '' : '';

      const locationEl = card.querySelector('[class*="location"], [class*="ship"]');
      const location = locationEl ? locationEl.textContent?.trim() ?? '' : '';

      const linkEl = card.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, monthlySales, rating, sellerRating, location, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'shopee',
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
          reviewCount: typeof item.monthlySales === 'number' ? item.monthlySales : 0,
          rating: typeof item.rating === 'number' ? item.rating : 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'shopee',
      marketId: 'sea',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(shopeeScript);
