import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const mercariJpScript: ExtractionScript = {
  platformId: 'mercari-jp',
  marketId: 'jp',
  version: '1.0.0',
  homeUrl: 'https://jp.mercari.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('jp.mercari.com/search')) return null;

    const cards = Array.from(
      document.querySelectorAll(
        '[data-testid="item-cell"], .merListItem, [class*="ItemGrid"] li',
      ),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl =
        card.querySelector('.itemName') ??
        card.querySelector('[data-testid="item-name"]') ??
        card.querySelector('[class*="itemName"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        card.querySelector('.itemPrice') ??
        card.querySelector('[data-testid="item-price"]') ??
        card.querySelector('[class*="price"]');
      // JPY: "¥1,980" — strip non-digits
      const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9]/g, '') ?? '' : '';
      const price = priceText ? parseInt(priceText, 10) : null;

      const conditionEl = card.querySelector('[class*="condition"], [class*="itemCondition"]');
      const condition = conditionEl ? conditionEl.textContent?.trim() ?? '' : '';

      // Check if item is sold (sold overlay or label)
      const soldEl =
        card.querySelector('[class*="soldOut"], [class*="sold-out"], [class*="itemStatusSold"]');
      const status = soldEl ? 'sold' : 'available';

      const sellerRatingEl = card.querySelector('[class*="sellerRating"], [class*="rating"]');
      const sellerRatingText = sellerRatingEl ? sellerRatingEl.textContent?.trim() ?? '' : '';
      const ratingMatch = sellerRatingText.match(/(\d+(?:\.\d+)?)/);
      const sellerRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

      const linkEl = card.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, condition, status, sellerRating, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'mercari-jp',
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
          reviewCount: 0,
          rating: typeof item.sellerRating === 'number' ? item.sellerRating : 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'mercari-jp',
      marketId: 'jp',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(mercariJpScript);
