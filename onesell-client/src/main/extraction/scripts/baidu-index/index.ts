import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

export const baiduIndexScript: ExtractionScript = {
  platformId: 'baidu-index',
  marketId: 'cn',
  version: '1.0.0',
  homeUrl: 'https://index.baidu.com',

  getNavigationTargets(keyword: string, _market: MarketContext): string[] {
    return [
      `https://index.baidu.com/v2/main/index.html#/trend/${encodeURIComponent(keyword)}?words=${encodeURIComponent(keyword)}`,
    ];
  },

  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    if (!url.includes('index.baidu.com')) return null;

    // Baidu Index renders trend charts via canvas — extract summary text
    const summaryEl = document.querySelector('[class*="index-summary"], .index-trend .index-num, #TextContainer');
    const trendEl = document.querySelector('[class*="trend-module"], .trend-wrap, #trend');

    // Try to extract the current search index value
    const indexEls = Array.from(
      document.querySelectorAll('[class*="index-num"], .hot-num, .trend-num, td'),
    );

    const trendPoints: Array<{ date: string; value: number }> = [];

    for (const el of indexEls) {
      const text = el.textContent?.trim() ?? '';
      const numMatch = text.match(/^([\d,]+)$/);
      if (numMatch) {
        trendPoints.push({
          date: extractedAt.slice(0, 10),
          value: parseInt(numMatch[1].replace(/,/g, ''), 10),
        });
      }
    }

    // Extract keyword from page title or URL
    const keywordEl = document.querySelector('[class*="keyword"], .word-item, .hot-word');
    const keyword = keywordEl ? keywordEl.textContent?.trim() ?? '' : '';

    // Extract the overall trend summary if available
    const overallEl = document.querySelector('[class*="overall"], .index-overall');
    const overallText = overallEl ? overallEl.textContent?.trim() ?? '' : '';

    if (trendPoints.length === 0 && !summaryEl && !trendEl) return null;

    return {
      platformId: 'baidu-index',
      url,
      extractedAt,
      data: {
        pageType: 'trend',
        keyword,
        overallSummary: overallText,
        trendPoints,
      },
    };
  },

  normalizeData(raw: RawPlatformData[]): NormalizedPlatformData {
    const trendData: Array<{
      readonly keyword: string;
      readonly trendIndex: number;
      readonly period: string;
    }> = [];

    for (const page of raw) {
      const data = page.data as {
        pageType: string;
        keyword: string;
        trendPoints: Array<{ date: string; value: number }>;
      };

      if (data.trendPoints && data.trendPoints.length > 0) {
        // Normalize to 0–100 scale (relative to max in dataset)
        const maxVal = Math.max(...data.trendPoints.map((p) => p.value), 1);
        for (const point of data.trendPoints) {
          trendData.push({
            keyword: data.keyword || 'unknown',
            trendIndex: Math.round((point.value / maxVal) * 100),
            period: point.date,
          });
        }
      }
    }

    return {
      platformId: 'baidu-index',
      marketId: 'cn',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: [], // Baidu Index is a trend source, not a product listing source
      trendData,
    };
  },
};

registry.register(baiduIndexScript);
