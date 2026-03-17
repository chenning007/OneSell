import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const lazadaScript: ExtractionScript = {
  platformId: 'lazada',
  marketId: 'sea',
  version: '1.0.0',
  homeUrl: 'https://www.lazada.sg',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.lazada.sg/catalog/?q=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('lazada.') || !url.includes('catalog')) return null;

    const cards = Array.from(
      document.querySelectorAll(
        '[data-tracking="product-card"], .Bm3ON, [class*="product-card"]',
      ),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl =
        card.querySelector('.RfADt') ??
        card.querySelector('[class*="product-title"]') ??
        card.querySelector('a[title]');
      const title = titleEl
        ? (titleEl.getAttribute('title') ?? titleEl.textContent?.trim() ?? '')
        : '';

      const priceEl =
        card.querySelector('.ooOxS') ??
        card.querySelector('[class*="price"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const discountEl = card.querySelector('[class*="discount"], .WNoq3');
      const discount = discountEl ? discountEl.textContent?.trim() ?? '' : '';

      const ratingEl = card.querySelector('[class*="rating"], .qzqFw');
      const ratingText = ratingEl ? ratingEl.textContent?.trim() ?? '' : '';
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

      const reviewEl = card.querySelector('[class*="review"], ._1zEQKa');
      const reviewText = reviewEl ? reviewEl.textContent ?? '' : '';
      const reviewMatch = reviewText.match(/\(?([\d,]+)\)?/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : 0;

      const locationEl = card.querySelector('[class*="location"], [class*="fulfillment"]');
      const location = locationEl ? locationEl.textContent?.trim() ?? '' : '';

      const linkEl = card.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, discount, rating, reviewCount, location, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'lazada',
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
      platformId: 'lazada',
      marketId: 'sea',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(lazadaScript);
