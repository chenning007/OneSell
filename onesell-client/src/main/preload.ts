import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — runs in a privileged context before renderer loads.
 *
 * P1/P9: The renderer process has NO direct Node.js access.
 * All system operations must go through this contextBridge.
 * Credentials and session tokens must NEVER be exposed here.
 *
 * IPC handlers are added here as features are implemented.
 * See docs/ARCHITECTURE.md §4.1 for the IPC contract.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  extraction: {
    openView: (platformId: string) =>
      ipcRenderer.invoke('extraction:open-view', platformId),
    closeView: (platformId: string) =>
      ipcRenderer.invoke('extraction:close-view', platformId),
    hideView: (platformId: string) =>
      ipcRenderer.invoke('extraction:hide-view', platformId),
    runExtraction: (platformId: string) =>
      ipcRenderer.invoke('extraction:run', platformId),
    getCurrentUrl: (platformId: string) =>
      ipcRenderer.invoke('extraction:get-url', platformId),
    getOpenPlatforms: () =>
      ipcRenderer.invoke('extraction:get-open-platforms') as Promise<string[]>,
    hideAll: () =>
      ipcRenderer.invoke('extraction:hide-all'),
  },
  payload: {
    build: (sessionId: string, preferences: unknown, rawResults: unknown) =>
      ipcRenderer.invoke('payload:build', { sessionId, preferences, rawResults }),
  },
  analysis: {
    submit: (data: { extractionData: unknown[]; preferences: unknown; marketId: string }) =>
      ipcRenderer.invoke('analysis:submit', data),
    getStatus: (analysisId: string) =>
      ipcRenderer.invoke('analysis:status', analysisId),
    getResults: (analysisId: string) =>
      ipcRenderer.invoke('analysis:results', analysisId),
  },
});

// Type declaration is in src/renderer/electron.d.ts (added per feature)
