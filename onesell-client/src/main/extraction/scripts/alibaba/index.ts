import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const alibabaScript: ExtractionScript = {
  platformId: 'alibaba',
  marketId: 'us',
  version: '1.0.0',
  homeUrl: 'https://www.alibaba.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(keyword)}`,
      `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (url.includes('alibaba.com')) {
      const cards = Array.from(
        document.querySelectorAll(
          '.organic-list-offer-outter, [data-spm-click], .offer-list-row',
        ),
      ).slice(0, 50);

      if (cards.length === 0) return null;

      const suppliers = cards.map((card) => {
        const titleEl =
          card.querySelector('.offer-title') ?? card.querySelector('h4');
        const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

        // Parse price range — handles "$1.00 - $5.00" or single price
        const priceEl =
          card.querySelector('.price-range') ?? card.querySelector('.offer-price');
        const priceText = priceEl ? priceEl.textContent ?? '' : '';
        const priceNumbers = priceText.match(/[\d]+(?:\.\d+)?/g);
        const priceMin = priceNumbers ? parseFloat(priceNumbers[0]) : null;
        const priceMax =
          priceNumbers && priceNumbers.length > 1
            ? parseFloat(priceNumbers[priceNumbers.length - 1])
            : priceMin;

        // MOQ — find element with moq class or text containing quantity words
        const moqEl = card.querySelector('.moq');
        const moqText = moqEl
          ? moqEl.textContent ?? ''
          : (() => {
              const allText = card.textContent ?? '';
              const moqMatch = allText.match(/([\d,]+)\s*(Pieces?|Units?|Sets?)/i);
              return moqMatch ? moqMatch[0] : '';
            })();
        const moqNum = moqText.match(/([\d,]+)/);
        const moq = moqNum ? parseInt(moqNum[1].replace(/,/g, ''), 10) : null;

        const ratingEl = card.querySelector('.score-number');
        const supplierRating = ratingEl
          ? parseFloat(ratingEl.textContent?.trim() ?? '0')
          : null;

        const locationEl =
          card.querySelector('.supplier-location') ??
          card.querySelector('.company-location');
        const shipsFrom = locationEl ? locationEl.textContent?.trim() ?? '' : '';

        return { title, priceMin, priceMax, moq, supplierRating, shipsFrom };
      });

      return {
        platformId: 'alibaba',
        url,
        extractedAt,
        data: { pageType: 'alibaba', suppliers },
      };
    }

    if (url.includes('aliexpress.com')) {
      const cards = Array.from(
        document.querySelectorAll(
          '[class*="manhattan--container"], .SearchListItem, [class*="item-title"]',
        ),
      ).slice(0, 50);

      if (cards.length === 0) return null;

      const suppliers = cards.map((card) => {
        const titleEl =
          card.querySelector('[class*="item-title"]') ??
          card.querySelector('h3') ??
          card.querySelector('a');
        const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

        const priceEl =
          card.querySelector('[class*="manhattan--price"]') ??
          card.querySelector('._1-sTm1') ??
          card.querySelector('[class*="price"]');
        const priceText = priceEl ? priceEl.textContent ?? '' : '';
        const priceNumbers = priceText.match(/[\d]+(?:\.\d+)?/g);
        const price = priceNumbers ? parseFloat(priceNumbers[0]) : null;

        const shippingEl = card.querySelector('[class*="shipping"]') ?? card.querySelector('[class*="freight"]');
        const shippingCost = shippingEl ? shippingEl.textContent?.trim() ?? '' : '';

        return { title, price, shippingCost };
      });

      return {
        platformId: 'alibaba',
        url,
        extractedAt,
        data: { pageType: 'aliexpress', suppliers },
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
      readonly url: string;
    }> = [];

    for (const page of raw) {
      const data = page.data as {
        pageType: string;
        suppliers: Array<Record<string, unknown>>;
      };

      for (const item of data.suppliers ?? []) {
        const title = typeof item.title === 'string' ? item.title : '';
        if (!title) continue;

        let price = 0;
        if (data.pageType === 'alibaba') {
          const min = typeof item.priceMin === 'number' ? item.priceMin : 0;
          const max = typeof item.priceMax === 'number' ? item.priceMax : min;
          price = min > 0 && max > 0 ? (min + max) / 2 : min || max;
        } else {
          price = typeof item.price === 'number' ? item.price : 0;
        }

        if (!price) continue;

        allListings.push({
          title,
          price,
          currency: 'USD',
          reviewCount: 0,
          rating:
            typeof item.supplierRating === 'number' ? item.supplierRating : 0,
          url: page.url,
        });
      }
    }

    return {
      platformId: 'alibaba',
      marketId: 'us',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(alibabaScript);
