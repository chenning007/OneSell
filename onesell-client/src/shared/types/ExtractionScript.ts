import type { MarketContext } from './MarketContext.js';

/**
 * RawPlatformData — unprocessed DOM extraction output from a single page.
 * Produced by ExtractionScript.extractFromPage() in BrowserView context.
 */
export interface RawPlatformData {
  readonly platformId: string;
  readonly url: string;
  readonly extractedAt: string; // ISO 8601
  readonly data: Record<string, unknown>; // Platform-specific raw fields
}

/**
 * NormalizedPlatformData — canonical form after ExtractionScript.normalizeData().
 * This is the shape stored in AnalysisPayload.platformData.
 */
export interface NormalizedPlatformData {
  readonly platformId: string;
  readonly marketId: string;
  readonly extractedAt: string;
  readonly scriptVersion: string;
  readonly listings: ReadonlyArray<{
    readonly title: string;
    readonly price: number;
    readonly currency: string;
    readonly reviewCount: number;
    readonly rating: number;
    readonly salesRank?: number;
    readonly url: string;
  }>;
  readonly trendData?: ReadonlyArray<{
    readonly keyword: string;
    readonly trendIndex: number; // 0–100
    readonly period: string;
  }>;
}

/**
 * ExtractionScript — plugin interface for all platform extraction modules.
 * Adding a new platform = implementing this interface + registering it.
 * No other files change. (Architectural Principle P6)
 *
 * See docs/ARCHITECTURE.md §4.3
 */
export interface ExtractionScript {
  readonly platformId: string;
  readonly marketId: string;
  readonly version: string; // Semver — increment on any DOM structure change

  /** URLs the BrowserView should navigate to for a given keyword + market. */
  getNavigationTargets(keyword: string, market: MarketContext): string[];

  /**
   * Runs in BrowserView page context. Pure function — no state mutation.
   * Returns null (NOT throws) if page structure is unrecognized.
   */
  extractFromPage(document: Document, url: string): RawPlatformData | null;

  /** Normalizes raw page snapshots into canonical NormalizedPlatformData. */
  normalizeData(raw: RawPlatformData[]): NormalizedPlatformData;
}
