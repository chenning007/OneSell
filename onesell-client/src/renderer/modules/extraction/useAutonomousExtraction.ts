/**
 * useAutonomousExtraction — React hook that starts and manages extraction (E-15, #251).
 *
 * PRD §5.2, ADR-005 D2:
 * - Starts extraction on mount: calls window.electronAPI.extraction.startPipeline(marketId)
 * - Listens to extraction:pipeline-update IPC events → updates extractionStore
 * - Listens to extraction:progress-event IPC events → appends to task in extractionStore
 * - Cleanup: removes listeners on unmount
 *
 * Closes #251
 */

import { useEffect, useRef } from 'react';
import { useExtractionStore } from '../../store/extractionStore.js';
import { useWizardStore } from '../../store/wizardStore.js';
import type { ExtractionProgressEvent } from '../../store/extractionStore.js';

// ── IPC event types from main process ───────────────────────────────

interface PipelineUpdateEvent {
  platformId: string;
  status?: string;
  productCount?: number;
  doneLabel?: string;
  enabled?: boolean;
}

interface ProgressEventPayload {
  platformId: string;
  message: string;
  field?: string;
  timestamp?: string;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useAutonomousExtraction(): void {
  const market = useWizardStore((s) => s.market);
  const initPipeline = useExtractionStore((s) => s.initPipeline);
  const updateTask = useExtractionStore((s) => s.updateTask);
  const started = useRef(false);

  useEffect(() => {
    if (!market?.marketId || started.current) return;
    started.current = true;

    // Initialize pipeline tasks from market config
    initPipeline(market.marketId);

    // Start the extraction pipeline via IPC
    void window.electronAPI.extraction.startPipeline(market.marketId);

    // W-13 (#267): Auto-save profile when extraction starts (PRD §3.5)
    void (async () => {
      try {
        await window.electronAPI.store.setProfile({
          marketId: market.marketId,
          extractionMode: 'auto-discover',
          lastSessionAt: new Date().toISOString(),
        });
        useWizardStore.getState().setHasProfile(true);
      } catch {
        // Non-critical — profile save failure should not block extraction
      }
    })();

    // Set up IPC event listeners
    const ipcRenderer = (window as Record<string, unknown>)['__electronIpcRenderer'] as {
      on(channel: string, callback: (...args: unknown[]) => void): void;
      removeListener(channel: string, callback: (...args: unknown[]) => void): void;
    } | undefined;

    // Pipeline update listener
    function handlePipelineUpdate(_event: unknown, data: PipelineUpdateEvent): void {
      const update: Record<string, unknown> = {};
      if (data.status !== undefined) update['status'] = data.status;
      if (data.productCount !== undefined) update['productCount'] = data.productCount;
      if (data.doneLabel !== undefined) update['doneLabel'] = data.doneLabel;
      if (data.enabled !== undefined) update['enabled'] = data.enabled;
      if (Object.keys(update).length > 0) {
        updateTask(data.platformId, update as Partial<{ status: string; productCount: number; doneLabel: string; enabled: boolean }>);
      }
    }

    // Progress event listener
    function handleProgressEvent(_event: unknown, data: ProgressEventPayload): void {
      const progressEvent: ExtractionProgressEvent = {
        timestamp: data.timestamp ?? new Date().toISOString(),
        message: data.message,
        field: data.field,
      };
      const state = useExtractionStore.getState();
      const task = state.tasks.find((t) => t.platformId === data.platformId);
      if (task) {
        updateTask(data.platformId, {
          progressEvents: [...(task.progressEvents ?? []), progressEvent],
        });
      }
    }

    if (ipcRenderer) {
      ipcRenderer.on('extraction:pipeline-update', handlePipelineUpdate);
      ipcRenderer.on('extraction:progress-event', handleProgressEvent);
    }

    // Cleanup
    return () => {
      if (ipcRenderer) {
        ipcRenderer.removeListener('extraction:pipeline-update', handlePipelineUpdate);
        ipcRenderer.removeListener('extraction:progress-event', handleProgressEvent);
      }
    };
  }, [market?.marketId, initPipeline, updateTask]);
}
