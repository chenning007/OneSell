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

const priceRangeFixture = `<!DOCTYPE html><html><body>
  <li class="s-item">
    <h3 class="s-item__title">Range Price Widget</h3>
    <span class="s-item__price">$5.00 to $15.00</span>
    <a href="https://www.ebay.com/itm/33333"></a>
  </li>
</body></html>`;

const commaPriceFixture = `<!DOCTYPE html><html><body>
  <li class="s-item">
    <h3 class="s-item__title">Expensive Widget</h3>
    <span class="s-item__price">$1,234.56</span>
    <a href="https://www.ebay.com/itm/44444"></a>
  </li>
</body></html>`;

const hotnessSellerFixture = `<!DOCTYPE html><html><body>
  <li class="s-item">
    <h3 class="s-item__title">Hot Widget</h3>
    <span class="s-item__price">$20.00</span>
    <span class="s-item__hotness">25 sold</span>
    <a href="https://www.ebay.com/itm/55555"></a>
  </li>
</body></html>`;

// --- Credential-shaped fields that must NEVER appear in extracted data (P1) ---
const CREDENTIAL_PATTERNS = /cookie|token|password|session_id|auth|secret|api.?key/i;

describe('eBay US ExtractionScript', () => {
  // --- AC: Extracts completed listings, sell-through rate, price distribution ---

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

  it('handles price range by taking the lower bound', () => {
    const doc = new JSDOM(priceRangeFixture).window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');

    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(5.0);
  });

  it('handles comma-separated prices correctly', () => {
    const doc = new JSDOM(commaPriceFixture).window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');

    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].price).toBe(1234.56);
  });

  it('extracts soldCount from .s-item__hotness selector', () => {
    const doc = new JSDOM(hotnessSellerFixture).window.document;
    const result = ebayUsScript.extractFromPage(
      doc,
      'https://www.ebay.com/sch/i.html?_nkw=widget&LH_Complete=1&LH_Sold=1',
    );

    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].soldCount).toBe(25);
  });

  // --- AC: Returns null gracefully on DOM change ---

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

  it('page with items that have empty titles returns null', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <li class="s-item"><h3 class="s-item__title"></h3><span class="s-item__price">$10.00</span></li>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');
    expect(result).toBeNull();
  });

  // --- normalizeData ---

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

  it('normalizeData merges multiple raw pages', () => {
    const docActive = new JSDOM(activeListingsFixture).window.document;
    const docCompleted = new JSDOM(completedListingsFixture).window.document;
    const rawActive = ebayUsScript.extractFromPage(docActive, 'https://www.ebay.com/sch/i.html?_nkw=widget');
    const rawCompleted = ebayUsScript.extractFromPage(
      docCompleted,
      'https://www.ebay.com/sch/i.html?_nkw=widget&LH_Complete=1&LH_Sold=1',
    );
    expect(rawActive).not.toBeNull();
    expect(rawCompleted).not.toBeNull();

    const normalized = ebayUsScript.normalizeData([rawActive!, rawCompleted!]);
    expect(normalized.listings).toHaveLength(4);
  });

  it('normalizeData with empty raw array returns empty listings', () => {
    const normalized = ebayUsScript.normalizeData([]);
    expect(normalized.listings).toHaveLength(0);
    expect(normalized.platformId).toBe('ebay-us');
  });

  // --- P6 contract: NormalizedPlatformData shape ---

  it('NormalizedPlatformData has all required interface fields', () => {
    const doc = new JSDOM(activeListingsFixture).window.document;
    const raw = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');
    const normalized = ebayUsScript.normalizeData([raw!]);

    expect(normalized).toHaveProperty('platformId');
    expect(normalized).toHaveProperty('marketId');
    expect(normalized).toHaveProperty('extractedAt');
    expect(normalized).toHaveProperty('scriptVersion');
    expect(normalized).toHaveProperty('listings');
    expect(typeof normalized.extractedAt).toBe('string');

    for (const listing of normalized.listings) {
      expect(listing).toHaveProperty('title');
      expect(listing).toHaveProperty('price');
      expect(listing).toHaveProperty('currency');
      expect(listing).toHaveProperty('reviewCount');
      expect(listing).toHaveProperty('rating');
      expect(listing).toHaveProperty('url');
      expect(typeof listing.price).toBe('number');
      expect(typeof listing.reviewCount).toBe('number');
      expect(typeof listing.rating).toBe('number');
    }
  });

  // --- getNavigationTargets ---

  it('getNavigationTargets returns 2 URLs', () => {
    const targets = ebayUsScript.getNavigationTargets('widget', usMarket);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toContain('LH_Complete=1');
    expect(targets[1]).toContain('ebay.com/sch/');
  });

  it('getNavigationTargets encodes special characters in keyword', () => {
    const targets = ebayUsScript.getNavigationTargets('widget & gadget', usMarket);
    expect(targets[0]).toContain('widget%20%26%20gadget');
  });

  // --- P1: Credentials never leave client ---

  it('P1: extracted data contains no credential-shaped fields', () => {
    const doc = new JSDOM(activeListingsFixture).window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');
    expect(result).not.toBeNull();

    const rawJson = JSON.stringify(result);
    const keys = Object.keys(result!.data);
    for (const key of keys) {
      expect(key).not.toMatch(CREDENTIAL_PATTERNS);
    }
    expect(rawJson).not.toMatch(CREDENTIAL_PATTERNS);
  });

  // --- P4: MarketContext immutability ---

  it('P4: getNavigationTargets does not mutate MarketContext', () => {
    const market: MarketContext = {
      marketId: 'us',
      language: 'en-US',
      currency: 'USD',
      platforms: ['ebay-us'],
    };
    const frozen = Object.freeze({ ...market });
    // Should not throw when called with frozen context
    const targets = ebayUsScript.getNavigationTargets('widget', frozen as MarketContext);
    expect(targets.length).toBeGreaterThan(0);
  });

  // --- P5: Graceful degradation ---

  it('P5: handles listing with missing price gracefully', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <li class="s-item">
        <h3 class="s-item__title">No Price Widget</h3>
        <a href="https://www.ebay.com/itm/99999"></a>
      </li>
      <li class="s-item">
        <h3 class="s-item__title">Valid Widget</h3>
        <span class="s-item__price">$10.00</span>
        <a href="https://www.ebay.com/itm/88888"></a>
      </li>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = ebayUsScript.extractFromPage(doc, 'https://www.ebay.com/sch/i.html?_nkw=widget');
    // Should not throw — returns data with null price for the first item
    expect(result).not.toBeNull();
  });

  // --- P6: Script metadata ---

  it('P6: script has correct platformId, marketId, version, homeUrl', () => {
    expect(ebayUsScript.platformId).toBe('ebay-us');
    expect(ebayUsScript.marketId).toBe('us');
    expect(ebayUsScript.version).toBe('1.0.0');
    expect(ebayUsScript.homeUrl).toContain('ebay.com');
  });

  // --- AC: No login required ---

  it('AC: homeUrl is a public page (no login required)', () => {
    expect(ebayUsScript.homeUrl).toBe('https://www.ebay.com');
    // Navigation targets are public search URLs, not account/login pages
    const targets = ebayUsScript.getNavigationTargets('test', usMarket);
    for (const url of targets) {
      expect(url).not.toMatch(/login|signin|auth/i);
    }
  });
});
