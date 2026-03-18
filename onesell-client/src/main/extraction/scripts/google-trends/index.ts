import type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from '../../../../shared/types/ExtractionScript.js';
import type { MarketContext } from '../../../../shared/types/MarketContext.js';
import { registry } from '../../ExtractionScriptRegistry.js';

const GEO_MAP: Record<string, string> = {
  us: 'US',
  cn: 'CN',
  uk: 'GB',
  de: 'DE',
  jp: 'JP',
  sea: 'ID',
  au: 'AU',
};

export const googleTrendsScript: ExtractionScript = {
  platformId: 'google-trends',
  marketId: 'us',
  version: '1.0.0',
  homeUrl: 'https://trends.google.com',

  getNavigationTargets(keyword: string, market: MarketContext): string[] {
    const geo = GEO_MAP[market.marketId] ?? 'US';
    return [
      `https://trends.google.com/trends/explore?q=${encodeURIComponent(keyword)}&geo=${geo}&date=today%2012-m`,
    ];
  },

  // NOTE: This function is serialized with .toString() and run in BrowserView page context.
  // It must be self-contained — no closure over external variables.
  extractFromPage(document: Document, url: string): RawPlatformData | null {
    const extractedAt = new Date().toISOString();

    // Extract keyword from URL
    const urlObj = (() => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    })();
    const keyword = urlObj ? (urlObj.searchParams.get('q') ?? '') : '';

    // Find script tags containing timelineData
    const scripts = Array.from(document.querySelectorAll('script'));
    let timelineData: Array<{ time: string; value: number[] }> | null = null;
    let risingQueries: string[] = [];

    for (const scriptEl of scripts) {
      const text = scriptEl.textContent ?? '';

      if (text.includes('"timelineData"') && timelineData === null) {
        try {
          // Extract the JSON object containing timelineData
          const match = text.match(/\{[^{}]*"timelineData"\s*:\s*\[[\s\S]*?\]\s*[,}]/);
          if (match) {
            // Try to parse the broader JSON blob
            const jsonMatch = text.match(/(\{[\s\S]*"timelineData"[\s\S]*\})/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[1]) as {
                timelineData?: Array<{ time: string; value: number[] }>;
              };
              if (Array.isArray(parsed.timelineData)) {
                timelineData = parsed.timelineData;
              }
            }
          }
        } catch {
          // Try alternate extraction
          try {
            const tdMatch = text.match(/"timelineData"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
            if (tdMatch) {
              timelineData = JSON.parse(tdMatch[1]) as Array<{ time: string; value: number[] }>;
            }
          } catch {
            // continue to next script tag
          }
        }
      }

      if (text.includes('"relatedQueriesWidget"') && risingQueries.length === 0) {
        try {
          const rqMatch = text.match(/"rankedList"\s*:\s*\[[\s\S]*?\]/);
          if (rqMatch) {
            const parsed = JSON.parse(`{${rqMatch[0]}}`) as {
              rankedList: Array<{ rankedKeyword: Array<{ query: string }> }>;
            };
            const first = parsed.rankedList[0];
            if (first?.rankedKeyword) {
              risingQueries = first.rankedKeyword
                .map((k) => k.query)
                .filter(Boolean);
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (!timelineData) return null;

    const trendDataArr = timelineData.map((entry) => ({
      date: entry.time,
      index: Array.isArray(entry.value) ? (entry.value[0] ?? 0) : 0,
    }));

    return {
      platformId: 'google-trends',
      url,
      extractedAt,
      data: {
        keyword,
        trendData: trendDataArr,
        risingQueries,
        regionData: [],
      },
    };
  },

  normalizeData(raw: RawPlatformData[]): NormalizedPlatformData {
    const trendDataOut: Array<{
      readonly keyword: string;
      readonly trendIndex: number;
      readonly period: string;
    }> = [];

    for (const page of raw) {
      const data = page.data as {
        keyword: string;
        trendData: Array<{ date: string; index: number }>;
      };
      const kw = data.keyword ?? '';
      for (const entry of data.trendData ?? []) {
        trendDataOut.push({
          keyword: kw,
          trendIndex: entry.index,
          period: entry.date,
        });
      }
    }

    return {
      platformId: 'google-trends',
      marketId: 'us',
      extractedAt: raw[0]?.extractedAt ?? new Date().toISOString(),
      scriptVersion: '1.0.0',
      listings: [],
      trendData: trendDataOut,
    };
  },

  getAutoDiscoveryUrls() {
    return [
      { url: 'https://trends.google.com/trending?geo=US', label: 'Google Trending US' },
    ];
  },
};

registry.register(googleTrendsScript);
