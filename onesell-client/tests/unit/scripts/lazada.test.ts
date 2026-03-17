import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { lazadaScript } from '../../../src/main/extraction/scripts/lazada/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const seaMarket: MarketContext = {
  marketId: 'sea',
  language: 'en',
  currency: 'USD',
  platforms: ['lazada'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <div data-tracking="product-card">
    <a href="/product/123" title="Bluetooth Speaker Portable">
      <span class="RfADt" title="Bluetooth Speaker Portable">Bluetooth Speaker Portable</span>
    </a>
    <span class="ooOxS">$24.99</span>
    <span class="WNoq3">-30%</span>
    <span class="qzqFw">4.7</span>
    <span class="_1zEQKa">(350)</span>
  </div>
  <div data-tracking="product-card">
    <a href="/product/456" title="USB-C Charging Cable">
      <span class="RfADt" title="USB-C Charging Cable">USB-C Charging Cable</span>
    </a>
    <span class="ooOxS">$5.50</span>
    <span class="WNoq3">-15%</span>
    <span class="qzqFw">4.2</span>
    <span class="_1zEQKa">(1,200)</span>
  </div>
</body></html>`;

describe('Lazada ExtractionScript', () => {
  it('valid search page returns RawPlatformData with listings', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = lazadaScript.extractFromPage(doc, 'https://www.lazada.sg/catalog/?q=speaker');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('lazada');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Bluetooth Speaker Portable');
    expect(listings[0].price).toBe(24.99);
  });

  it('extracts discount information', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = lazadaScript.extractFromPage(doc, 'https://www.lazada.sg/catalog/?q=speaker');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].discount).toBe('-30%');
    expect(listings[1].discount).toBe('-15%');
  });

  it('extracts rating', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = lazadaScript.extractFromPage(doc, 'https://www.lazada.sg/catalog/?q=speaker');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].rating).toBe(4.7);
    expect(listings[1].rating).toBe(4.2);
  });

  it('extracts review count', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = lazadaScript.extractFromPage(doc, 'https://www.lazada.sg/catalog/?q=speaker');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[0].reviewCount).toBe(350);
    expect(listings[1].reviewCount).toBe(1200);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = lazadaScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no cards found', () => {
    const doc = new JSDOM('<html><body></body></html>').window.document;
    const result = lazadaScript.extractFromPage(doc, 'https://www.lazada.sg/catalog/?q=xyz');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns Lazada catalog URL with encoded keyword', () => {
    const targets = lazadaScript.getNavigationTargets('bluetooth speaker', seaMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('lazada.sg/catalog');
    expect(targets[0]).toContain(encodeURIComponent('bluetooth speaker'));
  });

  it('normalizeData produces valid NormalizedPlatformData with USD', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = lazadaScript.extractFromPage(doc, 'https://www.lazada.sg/catalog/?q=speaker');
    expect(raw).not.toBeNull();

    const normalized = lazadaScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('lazada');
    expect(normalized.marketId).toBe('sea');
    expect(normalized.scriptVersion).toBe('1.0.0');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('USD');
    expect(normalized.listings[0].price).toBe(24.99);
  });

  it('normalizeData skips listings with no title or price', () => {
    const raw = {
      platformId: 'lazada',
      url: 'https://www.lazada.sg/catalog/?q=test',
      extractedAt: new Date().toISOString(),
      data: { pageType: 'search', listings: [{ title: '', price: null }] },
    };
    const normalized = lazadaScript.normalizeData([raw]);
    expect(normalized.listings).toHaveLength(0);
  });

  it('has correct static properties', () => {
    expect(lazadaScript.platformId).toBe('lazada');
    expect(lazadaScript.marketId).toBe('sea');
    expect(lazadaScript.version).toBe('1.0.0');
    expect(lazadaScript.homeUrl).toBe('https://www.lazada.sg');
  });
});
