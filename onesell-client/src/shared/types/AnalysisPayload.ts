import type { MarketContext } from './MarketContext.js';
import type { NormalizedPlatformData } from './ExtractionScript.js';

/**
 * UserPreferences — collected by the 1-step wizard (v2).
 *
 * v2 changes (PRD §3.3, ADR-005 D1):
 * - Removed `targetPlatforms`: platforms are auto-selected from MARKET_CONFIGS[marketId]
 * - Removed `categories`: agent explores all categories autonomously
 * - Added optional `productType` (default: 'physical')
 * - Added optional `fulfillmentTime` (default: 'medium' = 5–15 h/week)
 */
export interface UserPreferences {
  readonly market: MarketContext;
  readonly budget: { readonly min: number; readonly max: number; readonly currency: string };
  readonly riskTolerance: 'low' | 'medium' | 'high';
  readonly sellerExperience: 'none' | 'some' | 'experienced';
  /** Default: 'physical'. Moved from wizard step 4 to Advanced Preferences. */
  readonly productType?: 'physical' | 'digital';
  /** Default: 'medium' (5–15 h/week). Moved from wizard step 6 to Advanced Preferences. */
  readonly fulfillmentTime?: 'low' | 'medium' | 'high';
}

/**
 * AnalysisPayload — the ONLY data crossing the client-to-backend boundary.
 *
 * SECURITY (P1): No credential, session token, cookie, or platform login state
 * may appear in any field of this payload. Any such field is a critical violation.
 *
 * See docs/ARCHITECTURE.md §4.3 and §5.1
 */
export interface AnalysisPayload {
  readonly sessionId: string;
  readonly market: MarketContext;
  readonly userPreferences: UserPreferences;
  readonly platformData: Readonly<Record<string, NormalizedPlatformData>>;
  readonly extractionMetadata: {
    readonly platforms: readonly string[];
    readonly extractedAt: string;          // ISO 8601
    readonly scriptVersions: Readonly<Record<string, string>>;
  };
}
