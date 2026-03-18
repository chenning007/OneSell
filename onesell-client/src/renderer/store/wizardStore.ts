/**
 * wizardStore v2 — simplified wizard state (W-05, #231).
 *
 * PRD §3.4, §9, ADR-005 D1:
 * - Removed `selectedPlatforms`: platforms derived from MARKET_CONFIGS[marketId]
 * - Added `hasProfile` flag populated from store:get-profile IPC on init
 * - Step range: 0–5 (0=QuickStart, 1=MarketSelection, 2=Extraction, 3=Agent, 4=Results, 5=Detail)
 * - currentStep defaults: 0 if profile exists, 1 if no profile
 *
 * Closes #231
 */

import { create } from 'zustand';
import type { MarketContext } from '../../shared/types/index.js';
import type { UserPreferences } from '../../shared/types/index.js';

const MIN_STEP = 0;
const MAX_STEP = 11; // v2 uses 0–5; v1 deprecated components use up to 11

interface WizardState {
  currentStep: number;
  market: MarketContext | null;
  preferences: Partial<UserPreferences>;
  hasProfile: boolean;
}

interface WizardActions {
  setMarket: (market: MarketContext) => void;
  setStep: (step: number) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  setHasProfile: (has: boolean) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState & WizardActions>((set) => ({
  currentStep: 1,
  market: null,
  preferences: {},
  hasProfile: false,

  setMarket: (market) => set({ market }),

  setStep: (step) => {
    if (step < MIN_STEP || step > MAX_STEP) return;
    set({ currentStep: step });
  },

  updatePreferences: (partial) =>
    set((state) => ({ preferences: { ...state.preferences, ...partial } })),

  setHasProfile: (has) =>
    set({ hasProfile: has, currentStep: has ? 0 : 1 }),

  reset: () =>
    set({ currentStep: 1, market: null, preferences: {}, hasProfile: false }),
}));
