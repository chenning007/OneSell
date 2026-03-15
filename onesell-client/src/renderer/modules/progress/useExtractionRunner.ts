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
      for (const platformId of platforms) {
        // Check cancelled state from store directly
        const isCancelled = useExtractionStore.getState().cancelled;
        if (!active || isCancelled) break;

        setStatus(platformId, 'extracting');

        try {
          const result = await window.electronAPI.extraction.runExtraction(platformId);
          const stillCancelled = useExtractionStore.getState().cancelled;
          if (!active || stillCancelled) break;

          if (result !== null) {
            rawResultsRef.current.set(platformId, result);
            const count = Array.isArray((result.data as { listings?: unknown[] }).listings)
              ? ((result.data as { listings: unknown[] }).listings).length
              : 0;
            setStatus(platformId, 'done', count);
          } else {
            setStatus(platformId, 'error', 0, 'Extraction failed');
          }
        } catch {
          if (!active) break;
          setStatus(platformId, 'error', 0, 'Extraction failed');
        }
      }
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
