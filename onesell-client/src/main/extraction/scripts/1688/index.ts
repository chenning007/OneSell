import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const alibabaChScript: ExtractionScript = {
  platformId: '1688',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://www.1688.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(keyword)}`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    // CAPTCHA detection — 1688 shares Alibaba anti-bot (same as Taobao)
    if (document.querySelector('#nocaptcha, .J_MIDDLE_WRAP_H')) return null;

    if (!url.includes('1688.com')) return null;

    const cards = Array.from(
      document.querySelectorAll('.offer-list-row, [class*="offercard"], .sm-offer-item'),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl = card.querySelector('.offer-title a, [class*="title"] a, a[title]');
      const title = titleEl
        ? (titleEl.getAttribute('title') ?? titleEl.textContent?.trim() ?? '')
        : '';

      const priceEl = card.querySelector('em.offer-price, .offer-price em, [class*="price"] em, .price');
      const priceText = priceEl ? priceEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
      const price = priceText ? parseFloat(priceText) : null;

      const moqEl = card.querySelector('.offer-quantity, [class*="moq"], .moq');
      const moqText = moqEl ? moqEl.textContent ?? '' : '';
      const moqMatch = moqText.match(/([\d,]+)/);
      const moq = moqMatch ? parseInt(moqMatch[1].replace(/,/g, ''), 10) : 1;

      const ratingEl = card.querySelector('[class*="rating"], .offer-ratingNum');
      const ratingText = ratingEl ? ratingEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
      const supplierRating = ratingText ? parseFloat(ratingText) : 0;

      const locationEl = card.querySelector('[class*="location"], .offer-company span');
      const shipsFrom = locationEl ? locationEl.textContent?.trim() ?? '' : '';

      return { title, price, moq, supplierRating, shipsFrom };
    });

    return {
      platformId: '1688',
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
          reviewCount: 0,
          rating: typeof item.supplierRating === 'number' ? item.supplierRating : 0,
          url: page.url,
        });
      }
    }

    return {
      platformId: '1688',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(alibabaChScript);
