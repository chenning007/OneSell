import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const pinduoduoScript: ExtractionScript = {
  platformId: 'pinduoduo',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://www.pinduoduo.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(keyword)}`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    // CAPTCHA detection (ADR-china-anti-automation)
    if (document.querySelector('.slider-verify-panel, .captcha-wrap')) return null;

    if (!url.includes('yangkeduo.com/search') && !url.includes('pinduoduo.com/search')) return null;

    // PDD uses heavily obfuscated classes — use structural selectors
    const cards = Array.from(
      document.querySelectorAll('[data-tracking], .search-result-item, .goods-list-item'),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl = card.querySelector('[class*="title"], [class*="name"], a span');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceIntEl = card.querySelector('[class*="priceInt"], [class*="price"] strong');
      const priceDecEl = card.querySelector('[class*="priceDec"]');
      let priceText = priceIntEl ? priceIntEl.textContent?.replace(/[^\d]/g, '') ?? '' : '';
      if (priceDecEl) {
        priceText += '.' + (priceDecEl.textContent?.replace(/[^\d]/g, '') ?? '');
      }
      const price = priceText ? parseFloat(priceText) : null;

      const salesEl = card.querySelector('[class*="sales"], [class*="sold"]');
      const salesText = salesEl ? salesEl.textContent ?? '' : '';
      let salesVolume = 0;
      const wanMatch = salesText.match(/([\d.]+)\s*万/);
      if (wanMatch) {
        salesVolume = Math.round(parseFloat(wanMatch[1]) * 10000);
      } else {
        const numMatch = salesText.match(/([\d,]+)/);
        if (numMatch) salesVolume = parseInt(numMatch[1].replace(/,/g, ''), 10);
      }

      return { title, price, salesVolume };
    });

    return {
      platformId: 'pinduoduo',
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
          reviewCount: typeof item.salesVolume === 'number' ? item.salesVolume : 0,
          rating: 0,
          url: page.url,
        });
      }
    }

    return {
      platformId: 'pinduoduo',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(pinduoduoScript);
