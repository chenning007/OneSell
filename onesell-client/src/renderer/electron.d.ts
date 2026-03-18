import type { RawPlatformData } from '../shared/types/ExtractionScript.js';
import type { UserPreferences, AnalysisPayload } from '../shared/types/AnalysisPayload.js';
import type { SavedProfile, SavedPreferences, HistoryEntry } from '../main/store/LocalStore.js';

/**
 * Type declaration for electronAPI exposed via contextBridge in preload.ts.
 * P1: No credential data is exposed — only platform IDs (strings) are passed.
 * v2: Added store, apikey, pipeline, agent, and preferences channels.
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
        startPipeline(marketId: string): Promise<{ ok: boolean; marketId: string }>;
        togglePlatform(args: { platformId: string; enabled: boolean }): Promise<{ ok: boolean; platformId: string; enabled: boolean }>;
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
      store: {
        getProfile(): Promise<SavedProfile | null>;
        setProfile(profile: SavedProfile): Promise<{ ok: boolean } | { error: true; code: string; message: string }>;
        clearProfile(): Promise<{ ok: boolean }>;
        getPreferences(): Promise<SavedPreferences>;
        setPreferences(prefs: SavedPreferences): Promise<{ ok: boolean } | { error: true; code: string; message: string }>;
        getHistory(): Promise<HistoryEntry[]>;
        addHistory(entry: HistoryEntry): Promise<{ ok: boolean } | { error: true; code: string; message: string }>;
      };
      saveApiKey(key: string): Promise<{ ok: boolean } | { error: true; code: string; message: string }>;
      hasApiKey(): Promise<boolean>;
      clearApiKey(): Promise<{ ok: boolean }>;
      agent: {
        runAnalysis(marketId: string): Promise<{ ok: boolean; marketId: string; status: string }>;
      };
      preferences: {
        getDefaults(marketId: string): Promise<{
          budget: { min: number; max: number; currency: string };
          riskTolerance: 'low' | 'medium' | 'high';
          sellerExperience: 'none' | 'some' | 'experienced';
          productType: 'physical' | 'digital';
          fulfillmentTime: 'low' | 'medium' | 'high';
          platforms: readonly string[];
        } | { error: true; code: string; message: string }>;
      };
    };
  }
}

export {};
