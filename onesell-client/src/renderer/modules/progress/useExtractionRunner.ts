import { useRef, useState, useEffect } from 'react';
import type { RawPlatformData } from '../../../shared/types/ExtractionScript.js';
import { useExtractionStore } from '../../store/extractionStore.js';

interface ExtractionRunnerResult {
  rawResults: Map<string, RawPlatformData>;
  isRunning: boolean;
}

export function useExtractionRunner(platforms: string[]): ExtractionRunnerResult {
  const rawResultsRef = useRef<Map<string, RawPlatformData>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const { setStatus, cancelled, initPlatforms } = useExtractionStore();

  useEffect(() => {
    if (platforms.length === 0) return;

    initPlatforms(platforms);
    rawResultsRef.current = new Map();

    let active = true;

    async function runAll(): Promise<void> {
      setIsRunning(true);
      console.log('[ExtractionRunner] Starting extraction for platforms:', platforms);

      // Hide all BrowserViews so they don't overlay the progress screen
      try {
        await window.electronAPI.extraction.hideAll();
        console.log('[ExtractionRunner] All BrowserViews hidden');
      } catch (err) {
        console.warn('[ExtractionRunner] Failed to hide views:', err);
      }

      // Check which platforms actually have open BrowserViews
      let openPlatforms: string[] = [];
      try {
        openPlatforms = await window.electronAPI.extraction.getOpenPlatforms();
        console.log('[ExtractionRunner] Open platforms:', openPlatforms);
      } catch (err) {
        console.error('[ExtractionRunner] Failed to get open platforms:', err);
      }

      for (const platformId of platforms) {
        // Check cancelled state from store directly
        const isCancelled = useExtractionStore.getState().cancelled;
        if (!active || isCancelled) {
          console.log('[ExtractionRunner] Cancelled/inactive, stopping at:', platformId);
          break;
        }

        // Skip platforms that don't have a BrowserView open
        if (!openPlatforms.includes(platformId)) {
          console.warn(`[ExtractionRunner] ${platformId} has no open BrowserView — skipping`);
          setStatus(platformId, 'error', 0, 'Not connected');
          continue;
        }

        console.log(`[ExtractionRunner] Extracting: ${platformId}`);
        setStatus(platformId, 'extracting');

        try {
          const result = await window.electronAPI.extraction.runExtraction(platformId);
          console.log(`[ExtractionRunner] ${platformId} result:`, result ? `OK (keys: ${Object.keys(result.data || {})})` : 'null');
          const stillCancelled = useExtractionStore.getState().cancelled;
          if (!active || stillCancelled) break;

          if (result !== null) {
            rawResultsRef.current.set(platformId, result);
            const count = Array.isArray((result.data as { listings?: unknown[] }).listings)
              ? ((result.data as { listings: unknown[] }).listings).length
              : 0;
            console.log(`[ExtractionRunner] ${platformId} done — ${count} listings`);
            setStatus(platformId, 'done', count);
          } else {
            console.warn(`[ExtractionRunner] ${platformId} returned null — marking as error`);
            setStatus(platformId, 'error', 0, 'No data found on page');
          }
        } catch (err) {
          console.error(`[ExtractionRunner] ${platformId} threw:`, err);
          if (!active) break;
          setStatus(platformId, 'error', 0, 'Extraction failed');
        }
      }
      console.log('[ExtractionRunner] All extractions finished');
      setIsRunning(false);
    }

    void runAll();

    return () => {
      active = false;
    };
    // Run only once on mount with the initial platforms list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rawResults: rawResultsRef.current, isRunning };
}
