import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const etsyScript: ExtractionScript = {
  platformId: 'etsy',
  marketId: 'us',
  version: '1.0.0',
  homeUrl: 'https://www.etsy.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.etsy.com/search?q=${encodeURIComponent(keyword)}&order=most_relevant`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('etsy.com/search')) return null;

    const items = Array.from(
      document.querySelectorAll(
        '[data-listing-id], .listing-link, [class*="ListingCard"], .v2-listing-card',
      ),
    ).slice(0, 48);

    if (items.length === 0) return null;

    const listings = items.map((item) => {
      const titleEl =
        item.querySelector('h3') ??
        item.querySelector('[class*="listing-title"]') ??
        item.querySelector('p');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        item.querySelector('[class*="currency-value"]') ??
        item.querySelector('.currency-value') ??
        item.querySelector('[class*="price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const reviewEl =
        item.querySelector('.shop2-rating-count') ??
        item.querySelector('[class*="review-count"]') ??
        item.querySelector('[class*="reviewCount"]');
      const reviewText = reviewEl ? reviewEl.textContent ?? '' : '';
      const reviewMatch = reviewText.match(/([\d,]+)/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : 0;

      const ratingEl =
        item.querySelector('[class*="rating"]') ??
        item.querySelector('[aria-label*="out of 5"]');
      const ratingText = ratingEl ? ratingEl.getAttribute('aria-label') ?? ratingEl.textContent ?? '' : '';
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)\s*out of\s*5/i);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

      const linkEl = item.closest('a') ?? item.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, reviewCount, rating, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'etsy',
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
          reviewCount: typeof item.reviewCount === 'number' ? item.reviewCount : 0,
          rating: typeof item.rating === 'number' ? item.rating : 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'etsy',
      marketId: 'us',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(etsyScript);
