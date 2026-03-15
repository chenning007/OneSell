import { create } from 'zustand';
import type { MarketContext } from '../../shared/types/index.js';
import type { UserPreferences } from '../../shared/types/index.js';

interface WizardState {
  currentStep: number;
  market: MarketContext | null;
  preferences: Partial<UserPreferences>;
  selectedPlatforms: string[];
}

interface WizardActions {
  setMarket: (market: MarketContext) => void;
  setStep: (step: number) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  setSelectedPlatforms: (platforms: string[]) => void;
}

export const useWizardStore = create<WizardState & WizardActions>((set) => ({
  currentStep: 1,
  market: null,
  preferences: {},
  selectedPlatforms: [],

  setMarket: (market) => set({ market }),
  setStep: (step) => set({ currentStep: step }),
  updatePreferences: (partial) =>
    set((state) => ({ preferences: { ...state.preferences, ...partial } })),
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
}));
