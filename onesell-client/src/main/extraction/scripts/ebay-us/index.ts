import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const ebayUsScript: ExtractionScript = {
  platformId: 'ebay-us',
  marketId: 'us',
  version: '1.0.0',
  homeUrl: 'https://www.ebay.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Complete=1&LH_Sold=1`,
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('ebay.com/sch/')) return null;

    const items = Array.from(
      document.querySelectorAll('.s-item, [class*="s-item"]'),
    ).slice(0, 50);

    if (items.length === 0) return null;

    const isCompleted = url.includes('LH_Complete=1') || url.includes('LH_Sold=1');

    const listings = items.map((item) => {
      const titleEl = item.querySelector('.s-item__title') ?? item.querySelector('h3');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl =
        item.querySelector('.s-item__price') ??
        item.querySelector('[class*="s-item__price"]');
      const priceText = priceEl ? priceEl.textContent ?? '' : '';
      // Handle price ranges like "$5.00 to $15.00" — take the lower bound
      const priceNumbers = priceText.match(/[\d]+(?:,[\d]{3})*(?:\.\d+)?/g);
      const price = priceNumbers
        ? parseFloat(priceNumbers[0].replace(/,/g, ''))
        : null;

      const soldEl =
        item.querySelector('.s-item__quantitySold') ??
        item.querySelector('[class*="BOLD"]') ??
        item.querySelector('.s-item__hotness');
      const soldText = soldEl ? soldEl.textContent ?? '' : '';
      const soldMatch = soldText.match(/([\d,]+)\s*sold/i);
      const soldCount = soldMatch ? parseInt(soldMatch[1].replace(/,/g, ''), 10) : 0;

      const linkEl = item.querySelector('a');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      const conditionEl = item.querySelector('.SECONDARY_INFO');
      const condition = conditionEl ? conditionEl.textContent?.trim() ?? '' : '';

      return { title, price, soldCount, itemUrl, condition, isCompleted };
    }).filter((item) => item.title !== '');

    if (listings.length === 0) return null;

    return {
      platformId: 'ebay-us',
      url,
      extractedAt,
      data: { pageType: isCompleted ? 'completed' : 'active', listings },
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
          reviewCount: 0,
          rating: 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'ebay-us',
      marketId: 'us',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(ebayUsScript);
