import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { baiduIndexScript } from '../../../src/main/extraction/scripts/baidu-index/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['baidu-index'],
};

const trendFixture = `<!DOCTYPE html><html><body>
  <div class="trend-module">
    <span class="hot-word">手机壳</span>
    <div class="index-overall">搜索指数整体趋势上升</div>
    <table>
      <tr><td>15000</td></tr>
      <tr><td>12000</td></tr>
      <tr><td>18000</td></tr>
    </table>
  </div>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('Baidu Index ExtractionScript', () => {
  it('extracts trend data from Baidu Index page', () => {
    const doc = new JSDOM(trendFixture).window.document;
    const result = baiduIndexScript.extractFromPage(doc, 'https://index.baidu.com/v2/main/index.html#/trend/手机壳');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('baidu-index');
    expect(result!.data.pageType).toBe('trend');
    expect(result!.data.keyword).toBe('手机壳');
    const points = result!.data.trendPoints as Array<Record<string, unknown>>;
    expect(points.length).toBeGreaterThan(0);
  });

  it('extracts overall summary text', () => {
    const doc = new JSDOM(trendFixture).window.document;
    const result = baiduIndexScript.extractFromPage(doc, 'https://index.baidu.com/v2/main/index.html#/trend/test');
    expect(result!.data.overallSummary).toBe('搜索指数整体趋势上升');
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = baiduIndexScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no trend data found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = baiduIndexScript.extractFromPage(doc, 'https://index.baidu.com/v2/main/index.html');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns Baidu Index URL', () => {
    const targets = baiduIndexScript.getNavigationTargets('手机壳', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('index.baidu.com');
  });

  it('normalizeData produces trendData with 0-100 scale', () => {
    const doc = new JSDOM(trendFixture).window.document;
    const raw = baiduIndexScript.extractFromPage(doc, 'https://index.baidu.com/v2/main/index.html#/trend/手机壳');
    const normalized = baiduIndexScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('baidu-index');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings).toHaveLength(0); // Trend source, not listing source
    expect(normalized.trendData!.length).toBeGreaterThan(0);
    // Max value should normalize to 100
    const maxTrend = Math.max(...normalized.trendData!.map((t) => t.trendIndex));
    expect(maxTrend).toBe(100);
  });

  it('normalizeData trend values are between 0-100', () => {
    const doc = new JSDOM(trendFixture).window.document;
    const raw = baiduIndexScript.extractFromPage(doc, 'https://index.baidu.com/v2/main/index.html#/trend/手机壳');
    const normalized = baiduIndexScript.normalizeData([raw!]);
    for (const point of normalized.trendData!) {
      expect(point.trendIndex).toBeGreaterThanOrEqual(0);
      expect(point.trendIndex).toBeLessThanOrEqual(100);
    }
  });

  it('has correct static properties', () => {
    expect(baiduIndexScript.platformId).toBe('baidu-index');
    expect(baiduIndexScript.marketId).toBe('cn');
    expect(baiduIndexScript.version).toBe('1.0.0');
    expect(baiduIndexScript.homeUrl).toContain('index.baidu.com');
  });
});
