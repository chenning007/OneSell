import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { googleTrendsScript } from '../../../src/main/extraction/scripts/google-trends/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['google-trends'],
};

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['google-trends'],
};

// Minimal fixture that mimics the Google Trends page with embedded JSON
const timelinePayload = JSON.stringify({
  timelineData: [
    { time: '1704067200', value: [72] },
    { time: '1706745600', value: [85] },
    { time: '1709251200', value: [60] },
  ],
});

const trendsPageFixture = `<!DOCTYPE html><html><body>
  <script>var data = ${timelinePayload};</script>
</body></html>`;

const noTimelineFixture = `<!DOCTYPE html><html><body>
  <script>var x = {"foo": "bar"};</script>
</body></html>`;

const malformedJsonFixture = `<!DOCTYPE html><html><body>
  <script>var data = {"timelineData": [INVALID JSON HERE};</script>
</body></html>`;

describe('Google Trends ExtractionScript', () => {
  it('page with timelineData returns RawPlatformData', () => {
    const doc = new JSDOM(trendsPageFixture).window.document;
    const url = 'https://trends.google.com/trends/explore?q=widget&geo=US&date=today%2012-m';
    const result = googleTrendsScript.extractFromPage(doc, url);

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('google-trends');
    const data = result!.data as { trendData: Array<{ date: string; index: number }> };
    expect(data.trendData).toHaveLength(3);
    expect(data.trendData[0].index).toBe(72);
    expect(data.trendData[1].index).toBe(85);
  });

  it('page without timelineData returns null', () => {
    const doc = new JSDOM(noTimelineFixture).window.document;
    const result = googleTrendsScript.extractFromPage(
      doc,
      'https://trends.google.com/trends/explore?q=widget&geo=US',
    );
    expect(result).toBeNull();
  });

  it('page with malformed JSON in script tag returns null (no throw)', () => {
    const doc = new JSDOM(malformedJsonFixture).window.document;
    expect(() => {
      const result = googleTrendsScript.extractFromPage(
        doc,
        'https://trends.google.com/trends/explore?q=widget&geo=US',
      );
      expect(result).toBeNull();
    }).not.toThrow();
  });

  it('normalizeData maps trendData correctly', () => {
    const doc = new JSDOM(trendsPageFixture).window.document;
    const url = 'https://trends.google.com/trends/explore?q=gadget&geo=US&date=today%2012-m';
    const raw = googleTrendsScript.extractFromPage(doc, url);
    expect(raw).not.toBeNull();

    const normalized = googleTrendsScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('google-trends');
    expect(normalized.listings).toHaveLength(0);
    expect(normalized.trendData).toBeDefined();
    expect(normalized.trendData!.length).toBe(3);
    expect(normalized.trendData![0].trendIndex).toBe(72);
    expect(normalized.trendData![1].trendIndex).toBe(85);
  });

  it('getNavigationTargets maps market to correct geo code', () => {
    const usTargets = googleTrendsScript.getNavigationTargets('widget', usMarket);
    expect(usTargets).toHaveLength(1);
    expect(usTargets[0]).toContain('geo=US');

    const cnTargets = googleTrendsScript.getNavigationTargets('widget', cnMarket);
    expect(cnTargets[0]).toContain('geo=CN');

    const ukMarket: MarketContext = { marketId: 'uk', language: 'en-GB', currency: 'GBP', platforms: [] };
    const ukTargets = googleTrendsScript.getNavigationTargets('widget', ukMarket);
    expect(ukTargets[0]).toContain('geo=GB');
  });
});
