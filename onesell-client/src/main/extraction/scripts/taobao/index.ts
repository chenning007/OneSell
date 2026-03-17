import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const taobaoScript: ExtractionScript = {
  platformId: 'taobao',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://www.taobao.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    // CAPTCHA detection — return null immediately (ADR-china-anti-automation)
    if (document.querySelector('#nocaptcha, .J_MIDDLE_WRAP_H')) return null;

    if (!url.includes('s.taobao.com/search') && !url.includes('taobao.com/search')) return null;

    const cards = Array.from(
      document.querySelectorAll('.Card--doubleCardWrapper, [data-widgetid] .Content--contentInner, .items .item'),
    ).slice(0, 50);

    if (cards.length === 0) return null;

    const listings = cards.map((card) => {
      const titleEl = card.querySelector('.Title--title, .title, a[href*="item.htm"]');
      const title = titleEl ? titleEl.textContent?.trim() ?? '' : '';

      const priceEl = card.querySelector('.Price--priceInt, .price strong, .g_price strong');
      const priceDecEl = card.querySelector('.Price--priceDec');
      let priceText = priceEl ? priceEl.textContent?.replace(/[^\d.]/g, '') ?? '' : '';
      if (priceDecEl) {
        const dec = priceDecEl.textContent?.replace(/[^\d.]/g, '') ?? '';
        priceText += dec.startsWith('.') ? dec : '.' + dec;
      }
      const price = priceText ? parseFloat(priceText) : null;

      const salesEl = card.querySelector('.Deal--dealCnt, .deal-cnt, .sale-num');
      const salesText = salesEl ? salesEl.textContent ?? '' : '';
      // Handle "1000+人付款" or "5万+人收货" patterns
      let monthlySales = 0;
      const wanMatch = salesText.match(/([\d.]+)\s*万/);
      if (wanMatch) {
        monthlySales = Math.round(parseFloat(wanMatch[1]) * 10000);
      } else {
        const numMatch = salesText.match(/([\d,]+)/);
        if (numMatch) {
          monthlySales = parseInt(numMatch[1].replace(/,/g, ''), 10);
        }
      }

      const shopEl = card.querySelector('.Shop--shopName, .shopname, .shop a');
      const shopName = shopEl ? shopEl.textContent?.trim() ?? '' : '';

      const ratingEl = card.querySelector('.Shop--shopIcon, .icon-service-reputation');
      const sellerRating = ratingEl ? ratingEl.textContent?.trim() ?? '' : '';

      const linkEl = card.querySelector('a[href*="item.htm"], a[href*="detail"]');
      const itemUrl = linkEl ? linkEl.getAttribute('href') ?? '' : '';

      return { title, price, monthlySales, shopName, sellerRating, itemUrl };
    });

    return {
      platformId: 'taobao',
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
      readonly salesRank?: number;
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
          reviewCount: typeof item.monthlySales === 'number' ? item.monthlySales : 0,
          rating: 0,
          url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
        });
      }
    }

    return {
      platformId: 'taobao',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: allListings,
    };
  },
};

registry.register(taobaoScript);
