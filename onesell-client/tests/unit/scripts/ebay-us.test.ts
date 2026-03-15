import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { ebayUsScript } from '../../../src/main/extraction/scripts/ebay-us/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['ebay-us'],
};

const activeListingsFixture = `<!DOCTYPE html><html><body>
  <li class="s-item">
    <h3 class="s-item__title">Vintage Widget Set</h3>
    <span class="s-item__price">$24.99</span>
    <span class="SECONDARY_INFO">Used</span>
    <a href="https://www.ebay.com/itm/12345"></a>
  </li>
  <li class="s-item">
    <h3 class="s-item__title">Modern Widget Pro</h3>
    <span class="s-item__price">$49.00</span>
    <span class="SECONDARY_INFO">New</span>
    <a href="https://www.ebay.com/itm/67890"></a>
  </li>
</body></html>`;

const completedListingsFixture = `<!DOCTYPE html><html><body>
  <li class="s-item">
    <h3 class="s-item__title">Sold Widget A</h3>
    <span class="s-item__price">$15.00</span>
    <span class="s-item__quantitySold">12 sold</span>
    <a href="https://www.ebay.com/itm/11111"></a>
  </li>
  <li class="s-item">
    <h3 class="s-item__title">Sold Widget B</h3>
    <span class="s-item__price">$30.00</span>
    <span class="s-item__quantitySold">5 sold</span>
    <a href="https://www.ebay.com/itm/22222"></a>
  </li>
</body></html>`;

describe('eBay US ExtractionScript', () => {
  it('valid active listings page returns RawPlatformData', () => {
    const doc = new JSDOM(activeListingsFixture).window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('ebay-us');
    expect(result!.data.pageType).toBe('active');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Vintage Widget Set');
    expect(listings[0].price).toBe(24.99);
    expect(listings[0].condition).toBe('Used');
  });

  it('valid completed listings page returns RawPlatformData with soldCount', () => {
    const doc = new JSDOM(completedListingsFixture).window.document;
    const result = ebayUsScript.extractFromPage(
      doc,
      'https://www.ebay.com/sch/i.html?_nkw=widget&LH_Complete=1&LH_Sold=1',
    );

    expect(result).not.toBeNull();
    expect(result!.data.pageType).toBe('completed');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].soldCount).toBe(12);
    expect(listings[1].soldCount).toBe(5);
  });

  it('unrecognized URL returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('page with no items returns null', () => {
    const doc = new JSDOM('<html><body><div>No results</div></body></html>').window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=xyznothing');
    expect(result).toBeNull();
  });

  it('normalizeData produces valid NormalizedPlatformData', () => {
    const doc = new JSDOM(activeListingsFixture).window.document;
    const raw = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');
    expect(raw).not.toBeNull();
    const normalized = ebayUsScript.normalizeData([raw!]);

    expect(normalized.platformId).toBe('ebay-us');
    expect(normalized.marketId).toBe('us');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(24.99);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = [{
      platformId: 'ebay-us',
      url: 'https://www.ebay.com/sch/i.html?_nkw=test',
      extractedAt: new Date().toISOString(),
      data: {
        pageType: 'active',
        listings: [
          { title: '', price: 10, soldCount: 0, itemUrl: '', condition: '' },
          { title: 'Valid Item', price: 0, soldCount: 0, itemUrl: '', condition: '' },
          { title: 'Good Item', price: 25.00, soldCount: 3, itemUrl: 'https://ebay.com/itm/99', condition: 'New' },
        ],
      },
    }];
    const normalized = ebayUsScript.normalizeData(raw);
    expect(normalized.listings).toHaveLength(1);
    expect(normalized.listings[0].title).toBe('Good Item');
  });

  it('getNavigationTargets returns 2 URLs', () => {
    const targets = ebayUsScript.getNavigationTargets('widget', usMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('LH_Complete=1');
    expect(targets[1]).toContain('ebay.com/sch/');
  });
});
