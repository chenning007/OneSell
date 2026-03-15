import type { RawPlatformData } from '../shared/types/ExtractionScript.js';

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
      };
    };
  }
}

export {};
