import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { alibabaScript } from '../../../src/main/extraction/scripts/alibaba/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['alibaba'],
};

const alibabaFixture = `<!DOCTYPE html><html><body>
  <div class="organic-list-offer-outter">
    <h4 class="offer-title">Industrial Widget 500pcs</h4>
    <span class="price-range">$2.50 - $5.00 / Piece</span>
    <span class="moq">100 Pieces</span>
    <span class="score-number">4.8</span>
    <span class="supplier-location">Guangdong, China</span>
  </div>
  <div class="organic-list-offer-outter">
    <h4 class="offer-title">Budget Widget</h4>
    <span class="price-range">$1.00 - $2.00 / Piece</span>
    <span class="moq">500 Pieces</span>
    <span class="score-number">4.2</span>
    <span class="supplier-location">Zhejiang, China</span>
  </div>
</body></html>`;

const aliexpressFixture = `<!DOCTYPE html><html><body>
  <div class="manhattan--container--1lP57Ag">
    <h3 class="product-title">AliExpress Widget</h3>
    <span class="manhattan--price--2PNpy">US $3.99</span>
    <span class="manhattan--shipping--2ntL7">Free Shipping</span>
  </div>
  <div class="manhattan--container--1lP57Ag">
    <h3 class="product-title">Another AliExpress Item</h3>
    <span class="manhattan--price--2PNpy">US $7.50</span>
    <span class="manhattan--shipping--2ntL7">$1.99 Shipping</span>
  </div>
</body></html>`;

describe('Alibaba/AliExpress ExtractionScript', () => {
  it('alibaba.com page with product cards returns RawPlatformData', () => {
    const doc = new JSDOM(alibabaFixture).window.document;
    const result = alibabaScript.extractFromPage(
      doc,
      'https://www.alibaba.com/trade/search?SearchText=widget',
    );

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('alibaba');
    expect(result!.data.pageType).toBe('alibaba');
    const suppliers = result!.data.suppliers as Array<Record<string, unknown>>;
    expect(suppliers).toHaveLength(2);
    expect(suppliers[0].title).toBe('Industrial Widget 500pcs');
    expect(suppliers[0].priceMin).toBe(2.5);
    expect(suppliers[0].priceMax).toBe(5.0);
    expect(suppliers[0].moq).toBe(100);
    expect(suppliers[0].supplierRating).toBe(4.8);
    expect(suppliers[0].shipsFrom).toBe('Guangdong, China');
  });

  it('aliexpress.com page returns RawPlatformData', () => {
    const doc = new JSDOM(aliexpressFixture).window.document;
    const result = alibabaScript.extractFromPage(
      doc,
      'https://www.aliexpress.com/wholesale?SearchText=widget',
    );

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('aliexpress');
    const suppliers = result!.data.suppliers as Array<Record<string, unknown>>;
    expect(suppliers).toHaveLength(2);
    expect(suppliers[0].title).toBe('AliExpress Widget');
    expect(suppliers[0].price).toBe(3.99);
  });

  it('unrecognized URL returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = alibabaScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?q=widget');
    expect(result).toBeNull();
  });

  it('normalizeData produces valid listings with midpoint price', () => {
    const doc = new JSDOM(alibabaFixture).window.document;
    const raw = alibabaScript.extractFromPage(
      doc,
      'https://www.alibaba.com/trade/search?SearchText=widget',
    );
    expect(raw).not.toBeNull();
    const normalized = alibabaScript.normalizeData([raw!]);

    expect(normalized.platformId).toBe('alibaba');
    expect(normalized.marketId).toBe('us');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings).toHaveLength(2);
    // Midpoint of $2.50–$5.00 = $3.75
    expect(normalized.listings[0].price).toBe(3.75);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].rating).toBe(4.8);
  });

  it('getNavigationTargets returns 2 URLs for a keyword', () => {
    const targets = alibabaScript.getNavigationTargets('widget', usMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('alibaba.com');
    expect(targets[1]).toContain('aliexpress.com');
  });
});
