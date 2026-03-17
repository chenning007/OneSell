import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

/**
 * Factory that creates an ExtractionScript for a regional eBay variant.
 * Same selectors as ebay-us — only domain, platformId, marketId, and currency differ.
 */
function createEbayRegionalScript(config: {
  platformId: string;
  marketId: string;
  domain: string;
  currency: string;
}): ExtractionScript {
  const { platformId, marketId, domain, currency } = config;

  return {
    platformId,
    marketId,
    version: '1.0.0',
    homeUrl: `https://www.${domain}`,

    getNavigationTargets(keyword: string, _market: MarketContext): string[] {
      return [
        `https://www.${domain}/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Complete=1&LH_Sold=1`,
        `https://www.${domain}/sch/i.html?_nkw=${encodeURIComponent(keyword)}`,
      ];
    },

    // NOTE: This function is serialized with .toString() and run in BrowserView page context.
    // It must be self-contained — no closure over external variables.
    // The domain/platformId are captured via the factory closure at registration time,
    // but extractFromPage itself is self-contained: it reads platformId from a data attribute
    // and detects domain from the URL.
    extractFromPage(document: Document, url: string): RawPlatformData | null {
      const extractedAt = new Date().toISOString();

      if (!url.includes('/sch/')) return null;

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
        // Handle price ranges — take the lower bound
        // Supports "£5.00", "EUR 5,00", "AU $5.00" formats
        const priceNumbers = priceText.match(/[\d]+(?:[.,][\d]{1,3})*(?:[.,]\d+)?/g);
        let parsedPrice: number | null = null;
        if (priceNumbers) {
          // Normalize: if comma is used as decimal (EUR format), convert
          let raw = priceNumbers[0];
          // If format is "1.234,56" (EU), strip dots and convert comma to dot
          if (raw.includes(',') && raw.indexOf(',') > raw.lastIndexOf('.')) {
            raw = raw.replace(/\./g, '').replace(',', '.');
          } else {
            raw = raw.replace(/,/g, '');
          }
          parsedPrice = parseFloat(raw);
        }

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

        return { title, price: parsedPrice, soldCount, itemUrl, condition, isCompleted };
      }).filter((item) => item.title !== '');

      if (listings.length === 0) return null;

      // Determine platformId from URL host
      let detectedPlatformId = 'ebay-uk';
      if (url.includes('ebay.de')) detectedPlatformId = 'ebay-de';
      else if (url.includes('ebay.com.au')) detectedPlatformId = 'ebay-au';

      return {
        platformId: detectedPlatformId,
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
            currency,
            reviewCount: 0,
            rating: 0,
            url: typeof item.itemUrl === 'string' ? item.itemUrl : page.url,
          });
        }
      }

      return {
        platformId,
        marketId,
        extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
        scriptVersion: '1.0.0',
        listings: allListings,
      };
    },
  };
}

// Create and register all three regional eBay variants
export const ebayUkScript = createEbayRegionalScript({
  platformId: 'ebay-uk',
  marketId: 'uk',
  domain: 'ebay.co.uk',
  currency: 'GBP',
});

export const ebayDeScript = createEbayRegionalScript({
  platformId: 'ebay-de',
  marketId: 'de',
  domain: 'ebay.de',
  currency: 'EUR',
});

export const ebayAuScript = createEbayRegionalScript({
  platformId: 'ebay-au',
  marketId: 'au',
  domain: 'ebay.com.au',
  currency: 'AUD',
});

registry.register(ebayUkScript);
registry.register(ebayDeScript);
registry.register(ebayAuScript);
