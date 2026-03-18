import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const jdScript: ExtractionScript = {
  platformId: 'jd',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://www.jd.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://search.jd.com/Search?keyword=${encodeURIComponent(keyword)}`,
      `https://rank.jd.com/saletop/sale_tot.html`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    // CAPTCHA / risk-control detection
    if (document.querySelector('.verify-wrap, #JDJRV-wrap')) return null;
    if (url.includes('safe.jd.com') || url.includes('verify.jd.com')) return null;

    if (url.includes('search.jd.com')) {
      const cards = Array.from(
        document.querySelectorAll('.gl-item, .gl-i-wrap, [data-sku]'),
      ).slice(0, 50);

      if (cards.length === 0) return null;

      const listings = cards.map((card) => {
        const titleEl = card.querySelector('.p-name a em, .p-name em');
        const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

        const sku = (card as HTMLElement).dataset?.sku ?? card.getAttribute('data-sku') ?? '';

        const priceEl = card.querySelector('.p-price strong i, .p-price i');
        const priceText = priceEl ? priceEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
        const price = priceText ? parseFloat(priceText) : null;

        const reviewEl = card.querySelector('.p-commit strong a, .p-commit a');
        const reviewText = reviewEl ? reviewEl.textContent ?? '' : '';
        let reviewCount = 0;
        const wanMatch = reviewText.match(/([\d.]+)\s*万/);
        if (wanMatch) {
          reviewCount = Math.round(parseFloat(wanMatch[1]) * 10000);
        } else {
          const numMatch = reviewText.match(/([\d,]+)/);
          if (numMatch) reviewCount = parseInt(numMatch[1].replace(/,/g, ''), 10);
        }

        const shopEl = card.querySelector('.p-shop a, .p-shopnum a');
        const shopName = shopEl ? shopEl.textContent?.trim() ?? '' : '';

        const iconEl = card.querySelector('.p-icons .goods-icons i, .p-icons i');
        const sellerTier = iconEl ? iconEl.textContent?.trim() ?? '' : '';

        return { title, sku, price, reviewCount, shopName, sellerTier };
      });

      return {
        platformId: 'jd',
        url,
        extractedAt,
        data: { pageType: 'search', listings },
      };
    }

    if (url.includes('rank.jd.com')) {
      const items = Array.from(
        document.querySelectorAll('.mc .mc-item, .rank-list li, #sales-list li'),
      ).slice(0, 50);

      if (items.length === 0) return null;

      const listings = items.map((item, index) => {
        const titleEl = item.querySelector('a, .p-name');
        const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

        const priceEl = item.querySelector('.p-price, .price');
        const priceText = priceEl ? priceEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
        const price = priceText ? parseFloat(priceText) : null;

        return { rank: index + 1, title, price };
      });

      return {
        platformId: 'jd',
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
            currency: 'CNY',
            reviewCount: typeof item.reviewCount === 'number' ? item.reviewCount : 0,
            rating: 0,
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
            currency: 'CNY',
            reviewCount: 0,
            rating: 0,
            salesRank: typeof item.rank === 'number' ? item.rank : undefined,
            url: page.url,
          });
        }
      }
    }

    return {
      platformId: 'jd',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },

  getAutoDiscoveryUrls() {
    return [
      { url: 'https://www.jd.com/rankings', label: '京东排行榜' },
      { url: 'https://www.jd.com/xinfan', label: '京东新品' },
    ];
  },
};

registry.register(jdScript);
