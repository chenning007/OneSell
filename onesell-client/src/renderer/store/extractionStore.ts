import { create } from 'zustand';

export type PlatformStatus = 'waiting' | 'extracting' | 'done' | 'error';

export interface PlatformProgress {
  platformId: string;
  status: PlatformStatus;
  productCount: number;
  errorMessage?: string;
}

interface ExtractionState {
  platforms: PlatformProgress[];
  cancelled: boolean;
  allDone: boolean;
  keywords: string;
  initPlatforms(platformIds: string[]): void;
  setStatus(platformId: string, status: PlatformStatus, productCount?: number, errorMessage?: string): void;
  setKeywords(keywords: string): void;
  cancel(): void;
  reset(): void;
}

function computeAllDone(platforms: PlatformProgress[]): boolean {
  return platforms.length > 0 && platforms.every((p) => p.status === 'done' || p.status === 'error');
}

export const useExtractionStore = create<ExtractionState>((set) => ({
  platforms: [],
  cancelled: false,
  allDone: false,
  keywords: '',

  initPlatforms: (platformIds) => {
    const platforms: PlatformProgress[] = platformIds.map((platformId) => ({
      platformId,
      status: 'waiting',
      productCount: 0,
    }));
    set({ platforms, cancelled: false, allDone: false });
  },

  setStatus: (platformId, status, productCount = 0, errorMessage) => {
    set((state) => {
      const platforms = state.platforms.map((p) =>
        p.platformId === platformId
          ? { ...p, status, productCount, errorMessage }
          : p
      );
      return { platforms, allDone: computeAllDone(platforms) };
    });
  },

  setKeywords: (keywords) => set({ keywords }),

  cancel: () => set({ cancelled: true }),

  reset: () => set({ platforms: [], cancelled: false, allDone: false, keywords: '' }),
}));
