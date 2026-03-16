import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { etsyScript } from '../../../src/main/extraction/scripts/etsy/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['etsy'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-listing-id="111222">
    <h3>Handmade Wooden Widget</h3>
    <span class="currency-value">18.99</span>
    <span class="shop2-rating-count">245</span>
    <span class="v2-listing-rating" aria-label="4.8 out of 5 stars">4.8</span>
    <a href="https://www.etsy.com/listing/111222/handmade-wooden-widget"></a>
  </div>
  <div data-listing-id="333444">
    <h3>Personalized Widget Gift</h3>
    <span class="currency-value">32.50</span>
    <span class="shop2-rating-count">87</span>
    <a href="https://www.etsy.com/listing/333444/personalized-widget-gift"></a>
  </div>
</body></html>`;

const ratingViaAriaFixture = `<!DOCTYPE html><html><body>
  <div data-listing-id="555666">
    <h3>Rated Widget</h3>
    <span class="currency-value">15.00</span>
    <span class="review-count">50</span>
    <span aria-label="4.5 out of 5 stars">4.5</span>
    <a href="https://www.etsy.com/listing/555666/rated-widget"></a>
  </div>
</body></html>`;

const listingCardFixture = `<!DOCTYPE html><html><body>
  <div class="v2-listing-card">
    <h3>Alternate Card Widget</h3>
    <span class="currency-value">22.00</span>
    <a href="https://www.etsy.com/listing/777888/alternate-card-widget"></a>
  </div>
</body></html>`;

// --- Credential-shaped fields that must NEVER appear in extracted data (P1) ---
const CREDENTIAL_PATTERNS = /cookie|token|password|session_id|auth|secret|api.?key/i;

describe('Etsy ExtractionScript', () => {
  // --- AC: Extracts listing count, top listing review counts, price spread, recent listing dates ---

  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('etsy');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].title).toBe('Handmade Wooden Widget');
    expect(listings[0].price).toBe(18.99);
    expect(listings[0].reviewCount).toBe(245);
  });

  it('extracts rating via aria-label attribute', () => {
    const doc = new JSDOM(ratingViaAriaFixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');

    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].rating).toBe(4.5);
  });

  it('extracts from .v2-listing-card selector', () => {
    const doc = new JSDOM(listingCardFixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');

    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].title).toBe('Alternate Card Widget');
    expect(listings[0].price).toBe(22.0);
  });

  it('extracts multiple listings reflecting listing count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');

    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
  });

  // --- AC: Returns null gracefully on DOM change ---

  it('unrecognized URL returns null', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.amazon.com');
    expect(result).toBeNull();
  });

  it('search URL with empty page returns null', () => {
    const doc = new JSDOM('<html><body><div>No results found</div></body></html>').window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=xyznothing');
    expect(result).toBeNull();
  });

  it('page with items that have empty titles returns null', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <div data-listing-id="999">
        <h3></h3>
        <span class="currency-value">10.00</span>
      </div>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');
    expect(result).toBeNull();
  });

  // --- normalizeData ---

  it('normalizeData produces valid NormalizedPlatformData', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');
    expect(raw).not.toBeNull();
    const normalized = etsyScript.normalizeData([raw!]);

    expect(normalized.platformId).toBe('etsy');
    expect(normalized.marketId).toBe('us');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(18.99);
    expect(normalized.listings[0].reviewCount).toBe(245);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = [{
      platformId: 'etsy',
      url: 'https://www.etsy.com/search?q=test',
      extractedAt: new Date().toISOString(),
      data: {
        pageType: 'search',
        listings: [
          { title: '', price: 10, reviewCount: 5, rating: 4.5, itemUrl: '' },
          { title: 'Nice Item', price: 0, reviewCount: 3, rating: 4.0, itemUrl: '' },
          { title: 'Great Item', price: 22.50, reviewCount: 100, rating: 4.9, itemUrl: 'https://etsy.com/listing/1' },
        ],
      },
    }];
    const normalized = etsyScript.normalizeData(raw);
    expect(normalized.listings).toHaveLength(1);
    expect(normalized.listings[0].title).toBe('Great Item');
    expect(normalized.listings[0].rating).toBe(4.9);
  });

  it('normalizeData with empty raw array returns empty listings', () => {
    const normalized = etsyScript.normalizeData([]);
    expect(normalized.listings).toHaveLength(0);
    expect(normalized.platformId).toBe('etsy');
  });

  it('normalizeData preserves reviewCount and rating from raw', () => {
    const raw = [{
      platformId: 'etsy',
      url: 'https://www.etsy.com/search?q=test',
      extractedAt: '2026-03-15T00:00:00.000Z',
      data: {
        pageType: 'search',
        listings: [
          { title: 'Widget A', price: 15.0, reviewCount: 200, rating: 4.7, itemUrl: '/listing/1' },
          { title: 'Widget B', price: 30.0, reviewCount: 50, rating: 3.9, itemUrl: '/listing/2' },
        ],
      },
    }];
    const normalized = etsyScript.normalizeData(raw);
    expect(normalized.listings[0].reviewCount).toBe(200);
    expect(normalized.listings[0].rating).toBe(4.7);
    expect(normalized.listings[1].reviewCount).toBe(50);
    expect(normalized.listings[1].rating).toBe(3.9);
  });

  // --- P6 contract: NormalizedPlatformData shape ---

  it('NormalizedPlatformData has all required interface fields', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');
    const normalized = etsyScript.normalizeData([raw!]);

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

  it('getNavigationTargets returns 1 URL with keyword encoded', () => {
    const targets = etsyScript.getNavigationTargets('handmade widget', usMarket);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain('etsy.com/search');
    expect(targets[0]).toContain('handmade%20widget');
  });

  it('getNavigationTargets encodes special characters in keyword', () => {
    const targets = etsyScript.getNavigationTargets('widget & gift', usMarket);
    expect(targets[0]).toContain('widget%20%26%20gift');
  });

  // --- P1: Credentials never leave client ---

  it('P1: extracted data contains no credential-shaped fields', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');
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
      platforms: ['etsy'],
    };
    const frozen = Object.freeze({ ...market });
    const targets = etsyScript.getNavigationTargets('widget', frozen as MarketContext);
    expect(targets.length).toBeGreaterThan(0);
  });

  // --- P5: Graceful degradation ---

  it('P5: handles listing with missing review/rating gracefully', () => {
    const fixture = `<!DOCTYPE html><html><body>
      <div data-listing-id="888">
        <h3>No Review Widget</h3>
        <span class="currency-value">12.00</span>
        <a href="https://www.etsy.com/listing/888/no-review-widget"></a>
      </div>
    </body></html>`;
    const doc = new JSDOM(fixture).window.document;
    const result = etsyScript.extractFromPage(doc, 'https://www.etsy.com/search?q=widget');
    expect(result).not.toBeNull();
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].reviewCount).toBe(0);
    expect(listings[0].rating).toBe(0);
  });

  // --- P6: Script metadata ---

  it('P6: script has correct platformId, marketId, version, homeUrl', () => {
    expect(etsyScript.platformId).toBe('etsy');
    expect(etsyScript.marketId).toBe('us');
    expect(etsyScript.version).toBe('1.0.0');
    expect(etsyScript.homeUrl).toContain('etsy.com');
  });

  // --- AC: No login required ---

  it('AC: homeUrl is a public page (no login required)', () => {
    expect(etsyScript.homeUrl).toBe('https://www.etsy.com');
    const targets = etsyScript.getNavigationTargets('test', usMarket);
    for (const url of targets) {
      expect(url).not.toMatch(/login|signin|auth/i);
    }
  });
});
