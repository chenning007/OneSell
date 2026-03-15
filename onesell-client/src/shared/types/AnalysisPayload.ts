import type { MarketContext } from './MarketContext.js';
import type { NormalizedPlatformData } from './ExtractionScript.js';

/**
 * UserPreferences — collected by the 6-step wizard.
 * See docs/PRD §5 for the full wizard step definitions.
 */
export interface UserPreferences {
  readonly market: MarketContext;
  readonly budget: { readonly min: number; readonly max: number; readonly currency: string };
  readonly riskTolerance: 'low' | 'medium' | 'high';
  readonly targetPlatforms: readonly string[];
  readonly categories: readonly string[];     // User-selected interest categories
  readonly sellerExperience: 'none' | 'some' | 'experienced';
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
