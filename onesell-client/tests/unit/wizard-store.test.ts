import { describe, it, expect, beforeEach } from 'vitest';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import type { MarketContext } from '../../src/shared/types/index.js';

const mockMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon-us', 'ebay-us'],
};

describe('wizardStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useWizardStore.setState({
      currentStep: 1,
      market: null,
      preferences: {},
      selectedPlatforms: [],
    });
  });

  it('initializes with step 1 and no market', () => {
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.market).toBeNull();
    expect(state.selectedPlatforms).toEqual([]);
  });

  it('setMarket stores market context', () => {
    useWizardStore.getState().setMarket(mockMarket);
    expect(useWizardStore.getState().market).toEqual(mockMarket);
  });

  it('setStep advances to given step', () => {
    useWizardStore.getState().setStep(3);
    expect(useWizardStore.getState().currentStep).toBe(3);
  });

  it('updatePreferences merges partial preferences', () => {
    useWizardStore.getState().updatePreferences({ budget: { min: 50, max: 200, currency: 'USD' } });
    const state = useWizardStore.getState();
    expect(state.preferences.budget).toEqual({ min: 50, max: 200, currency: 'USD' });
  });

  it('updatePreferences does not overwrite unrelated fields', () => {
    useWizardStore.getState().updatePreferences({ riskTolerance: 'low' });
    useWizardStore.getState().updatePreferences({ budget: { min: 50, max: 200, currency: 'USD' } });
    const state = useWizardStore.getState();
    expect(state.preferences.riskTolerance).toBe('low');
    expect(state.preferences.budget).toBeDefined();
  });

  it('setSelectedPlatforms stores platform list', () => {
    useWizardStore.getState().setSelectedPlatforms(['amazon-us', 'etsy']);
    expect(useWizardStore.getState().selectedPlatforms).toEqual(['amazon-us', 'etsy']);
  });
});
