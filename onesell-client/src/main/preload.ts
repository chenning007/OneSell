import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — runs in a privileged context before renderer loads.
 *
 * P1/P9: The renderer process has NO direct Node.js access.
 * All system operations must go through this contextBridge.
 * Credentials and session tokens must NEVER be exposed here.
 *
 * v2: Added store, apikey, pipeline, agent, and preferences channels.
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
    startPipeline: (marketId: string) =>
      ipcRenderer.invoke('extraction:start-pipeline', marketId),
    togglePlatform: (args: { platformId: string; enabled: boolean }) =>
      ipcRenderer.invoke('extraction:toggle-platform', args),
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
  store: {
    getProfile: () =>
      ipcRenderer.invoke('store:get-profile'),
    setProfile: (profile: { marketId: string; extractionMode: 'auto-discover'; lastSessionAt: string }) =>
      ipcRenderer.invoke('store:set-profile', profile),
    clearProfile: () =>
      ipcRenderer.invoke('store:clear-profile'),
    getPreferences: () =>
      ipcRenderer.invoke('store:get-preferences'),
    setPreferences: (prefs: Record<string, unknown>) =>
      ipcRenderer.invoke('store:set-preferences', prefs),
    getHistory: () =>
      ipcRenderer.invoke('store:get-history'),
    addHistory: (entry: { sessionId: string; marketId: string; timestamp: string; productCount: number; categoryCount: number }) =>
      ipcRenderer.invoke('store:add-history', entry),
  },
  saveApiKey: (key: string) =>
    ipcRenderer.invoke('apikey:save', key),
  hasApiKey: () =>
    ipcRenderer.invoke('apikey:get-status').then((r: { hasKey: boolean }) => r.hasKey),
  clearApiKey: () =>
    ipcRenderer.invoke('apikey:clear'),
  agent: {
    runAnalysis: (marketId: string) =>
      ipcRenderer.invoke('agent:run-analysis', marketId),
  },
  preferences: {
    getDefaults: (marketId: string) =>
      ipcRenderer.invoke('preferences:get-defaults', marketId),
  },
});

// Type declaration is in src/renderer/electron.d.ts (added per feature)
