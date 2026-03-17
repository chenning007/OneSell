import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const amazonJpScript: ExtractionScript = {
  platformId: 'amazon-jp',
  marketId: 'jp',
  version: '1.0.0',
  homeUrl: 'https://www.amazon.co.jp',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}`,
      'https://www.amazon.co.jp/gp/bestseller',
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (url.includes('amazon.co.jp/s?') || url.includes('amazon.co.jp/s/')) {
      const cards = Array.from(
        document.querySelectorAll('[data-component-type="s-search-result"]'),
      ).slice(0, 50);

      if (cards.length === 0) return null;

      const listings = cards.map((card) => {
        const titleEl = card.querySelector('h2 .a-text-normal');
        const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

        const asin = (card as HTMLElement).dataset?.asin ?? card.getAttribute('data-asin') ?? '';

        const priceEl = card.querySelector('.a-price .a-offscreen');
        // JPY prices use ¥ symbol and comma separators, no decimal
        const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9]/g, '') ?? '' : '';
        const price = priceText ? parseInt(priceText, 10) : null;

        const reviewEl = card.querySelector('.a-size-base');
        const reviewText = reviewEl ? reviewEl.textContent?.replace(/,/g, '').trim() ?? '' : '';
        const reviewCount = reviewText && /^\d+$/.test(reviewText) ? parseInt(reviewText, 10) : 0;

        const ratingEl = card.querySelector('.a-icon-alt');
        const ratingText = ratingEl ? ratingEl.textContent ?? '' : '';
        // Japanese: "5つ星のうち4.5"
        const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

        const sponsored =
          !!card.querySelector('.s-sponsored-label-text') ||
          card.getAttribute('data-component-type') === 'sp-sponsored-result';

        return { title, asin, price, reviewCount, rating, sponsored, bsr: null };
      });

      return {
        platformId: 'amazon-jp',
        url,
        extractedAt,
        data: { pageType: 'search', listings },
      };
    }

    if (url.includes('amazon.co.jp/gp/bestseller') || url.includes('zgbs')) {
      const items = Array.from(
        document.querySelectorAll(
          '#zg-ordered-list .zg-item-immersion, .p13n-sc-uncoverable-faceout',
        ),
      ).slice(0, 50);

      if (items.length === 0) return null;

      const listings = items.map((item, index) => {
        const rankEl = item.querySelector('.zg-bdg-text');
        const rank = rankEl ? parseInt(rankEl.textContent?.replace(/\D/g, '') ?? '', 10) : index + 1;

        const titleEl = item.querySelector('.p13n-sc-line-clamp-1') ?? item.querySelector('a span');
        const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

        const linkEl = item.querySelector('a');
        const href = linkEl ? linkEl.getAttribute('href') ?? '' : '';
        const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
        const asin = asinMatch ? asinMatch[1] : '';

        const priceEl = item.querySelector('._cDEzb_p13n-sc-price_3mJ9Z') ?? item.querySelector('.a-price .a-offscreen');
        const priceText = priceEl ? priceEl.textContent?.replace(/[^0-9]/g, '') ?? '' : '';
        const price = priceText ? parseInt(priceText, 10) : null;

        return { rank, title, asin, price };
      });

      return {
        platformId: 'amazon-jp',
        url,
        extractedAt,
        data: { pageType: 'bestsellers', listings },
      };
    }

    return null;
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

      if (data.pageType === 'search') {
        for (const item of data.listings) {
          const price = typeof item.price === 'number' ? item.price : 0;
          const title = typeof item.title === 'string' ? item.title : '';
          if (!title || !price) continue;
          allListings.push({
            title,
            price,
            currency: 'JPY',
            reviewCount: typeof item.reviewCount === 'number' ? item.reviewCount : 0,
            rating: typeof item.rating === 'number' ? item.rating : 0,
            url: page.url,
          });
        }
      } else if (data.pageType === 'bestsellers') {
        for (const item of data.listings) {
          const price = typeof item.price === 'number' ? item.price : 0;
          const title = typeof item.title === 'string' ? item.title : '';
          if (!title || !price) continue;
          allListings.push({
            title,
            price,
            currency: 'JPY',
            reviewCount: 0,
            rating: 0,
            salesRank: typeof item.rank === 'number' ? item.rank : undefined,
            url: page.url,
          });
        }
      }
    }

    return {
      platformId: 'amazon-jp',
      marketId: 'jp',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(amazonJpScript);
