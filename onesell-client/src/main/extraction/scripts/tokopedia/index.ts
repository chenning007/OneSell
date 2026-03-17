import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const tokopediaScript: ExtractionScript = {
  platformId: 'tokopedia',
  marketId: 'sea',
  version: '1.0.0',
  homeUrl: 'https://www.tokopedia.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.tokopedia.com/search?q=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('tokopedia.com/search')) return null;

    const cards = Array.from(
      document.querySelectorAll(
        '.prd_container-card, [data-testid="divProductWrapper"]',
      ),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl =
        card.querySelector('.prd_link-product-name') ??
        card.querySelector('[data-testid="spnSRPProdName"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        card.querySelector('.prd_link-product-price') ??
        card.querySelector('[data-testid="spnSRPProdPrice"]');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^\d]/g, '') ?? '' : '';
      // IDR prices have no decimal point (e.g. Rp150.000 → 150000)
      const price = priceText ? parseInt(priceText, 10) : null;

      const reviewEl =
        card.querySelector('[class*="prd_rating"]') ??
        card.querySelector('[data-testid="spnSRPProdReview"]');
      const reviewText = reviewEl ? reviewEl.textContent ?? '' : '';
      const reviewMatch = reviewText.match(/([\d,]+)/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : 0;

      const ratingEl =
        card.querySelector('.prd_rating-average') ??
        card.querySelector('[data-testid="imgSRPProdRating"]');
      const ratingText = ratingEl ? ratingEl.textContent?.trim() ?? '' : '';
      const ratingNum = ratingText.match(/(\d+(?:\.\d+)?)/);
      const rating = ratingNum ? parseFloat(ratingNum[1]) : 0;

      const shopEl = card.querySelector('.prd_link-shop-name, [data-testid="spnSRPProdShop"]');
      const shopName = shopEl ? shopEl.textContent?.trim() ?? '' : '';

      const locationEl = card.querySelector('.prd_link-shop-loc, [data-testid="spnSRPProdShopLoc"]');
      const location = locationEl ? locationEl.textContent?.trim() ?? '' : '';

      const linkEl = card.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, reviewCount, rating, shopName, location, itemUrl };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'tokopedia',
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
        const rawPrice = typeof item.price === 'number' ? item.price : 0;
        if (!title || !rawPrice) continue;

        allListings.push({
          title,
          price: rawPrice,
          currency: 'IDR',
          reviewCount: typeof item.reviewCount === 'number' ? item.reviewCount : 0,
          rating: typeof item.rating === 'number' ? item.rating : 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'tokopedia',
      marketId: 'sea',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(tokopediaScript);
