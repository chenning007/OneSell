/**
 * MarketConfigService — static market configuration with in-memory cache.
 *
 * Serves all 7 supported markets (US, CN, UK, DE, JP, AU, SEA).
 * Data mirrors onesell-client/src/renderer/config/markets.ts.
 *
 * Closes #106
 */

// ── Types ───────────────────────────────────────────────────────────

export type MarketId = 'us' | 'cn' | 'uk' | 'de' | 'jp' | 'sea' | 'au';

export interface MarketConfig {
  readonly marketId: MarketId;
  readonly language: string;
  readonly currency: string;
  readonly flag: string;
  readonly platforms: readonly string[];
}

// ── Static data ─────────────────────────────────────────────────────

const MARKET_DATA: Record<MarketId, MarketConfig> = {
  us:  { marketId: 'us',  language: 'en-US', currency: 'USD', flag: '🇺🇸', platforms: ['amazon-us','ebay-us','etsy','tiktok-shop-us','alibaba','google-trends'] },
  cn:  { marketId: 'cn',  language: 'zh-CN', currency: 'CNY', flag: '🇨🇳', platforms: ['taobao','jd','pinduoduo','douyin-shop','1688','baidu-index'] },
  uk:  { marketId: 'uk',  language: 'en-GB', currency: 'GBP', flag: '🇬🇧', platforms: ['amazon-uk','ebay-uk','etsy','alibaba','google-trends'] },
  de:  { marketId: 'de',  language: 'de-DE', currency: 'EUR', flag: '🇩🇪', platforms: ['amazon-de','ebay-de','otto','etsy','alibaba','google-trends'] },
  jp:  { marketId: 'jp',  language: 'ja-JP', currency: 'JPY', flag: '🇯🇵', platforms: ['amazon-jp','rakuten','mercari-jp','alibaba','google-trends'] },
  sea: { marketId: 'sea', language: 'en-US', currency: 'USD', flag: '🇮🇩', platforms: ['shopee','tokopedia','lazada','tiktok-shop-sea','alibaba','google-trends'] },
  au:  { marketId: 'au',  language: 'en-AU', currency: 'AUD', flag: '🇦🇺', platforms: ['amazon-au','ebay-au','catch','etsy','alibaba','google-trends'] },
};

// ── Cache ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let allMarketsCache: CacheEntry<MarketConfig[]> | null = null;

// ── Service ─────────────────────────────────────────────────────────

export function getAllMarkets(): MarketConfig[] {
  const now = Date.now();
  if (allMarketsCache && now < allMarketsCache.expiresAt) {
    return allMarketsCache.data;
  }
  const markets = Object.values(MARKET_DATA);
  allMarketsCache = { data: markets, expiresAt: now + CACHE_TTL_MS };
  return markets;
}

export function getMarket(marketId: string): MarketConfig | null {
  const market = MARKET_DATA[marketId as MarketId];
  return market ?? null;
}

/** Reset cache — exported for testing only. */
export function _resetCache(): void {
  allMarketsCache = null;
}
