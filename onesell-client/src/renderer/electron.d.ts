import type { RawPlatformData } from '../shared/types/ExtractionScript.js';
import type { UserPreferences, AnalysisPayload } from '../shared/types/AnalysisPayload.js';

/**
 * Type declaration for electronAPI exposed via contextBridge in preload.ts.
 * P1: No credential data is exposed — only platform IDs (strings) are passed.
 */
declare global {
  interface Window {
    electronAPI: {
      extraction: {
        openView(platformId: string): Promise<void>;
        closeView(platformId: string): Promise<void>;
        hideView(platformId: string): Promise<void>;
        runExtraction(platformId: string): Promise<RawPlatformData | null>;
        getCurrentUrl(platformId: string): Promise<string>;
        getOpenPlatforms(): Promise<string[]>;
        hideAll(): Promise<void>;
      };
      payload: {
        build(
          sessionId: string,
          preferences: UserPreferences,
          rawResults: Record<string, RawPlatformData[]>
        ): Promise<AnalysisPayload>;
      };
      analysis: {
        submit(data: {
          extractionData: { platformId: string; available: boolean; data?: unknown }[];
          preferences: {
            budget?: number;
            preferredPlatforms?: string[];
            categories?: string[];
            riskTolerance?: 'low' | 'medium' | 'high';
            fulfillmentPreference?: string;
          };
          marketId: string;
        }): Promise<{ analysisId: string; status: string }>;
        getStatus(analysisId: string): Promise<{ analysisId: string; status: string; message?: string }>;
        getResults(analysisId: string): Promise<{ analysisId: string; results: unknown }>;
      };
    };
  }
}

export {};
