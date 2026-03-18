/**
 * wizardStore v2 unit tests (W-05, #231).
 * Updated for v2: removed selectedPlatforms, added hasProfile, step range 0-5.
 */

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
    useWizardStore.setState({
      currentStep: 1,
      market: null,
      preferences: {},
      hasProfile: false,
    });
  });

  it('initializes with step 1 and no market', () => {
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.market).toBeNull();
    expect(state.hasProfile).toBe(false);
  });

  it('setMarket stores market context', () => {
    useWizardStore.getState().setMarket(mockMarket);
    expect(useWizardStore.getState().market).toEqual(mockMarket);
  });

  it('setStep advances to given step', () => {
    useWizardStore.getState().setStep(3);
    expect(useWizardStore.getState().currentStep).toBe(3);
  });

  it('setStep rejects values below 0', () => {
    useWizardStore.getState().setStep(3);
    useWizardStore.getState().setStep(-1);
    expect(useWizardStore.getState().currentStep).toBe(3);
  });

  it('setStep rejects values above MAX_STEP (11)', () => {
    useWizardStore.getState().setStep(3);
    useWizardStore.getState().setStep(12);
    expect(useWizardStore.getState().currentStep).toBe(3);
  });

  it('setStep accepts boundary values 0 and 11', () => {
    useWizardStore.getState().setStep(0);
    expect(useWizardStore.getState().currentStep).toBe(0);
    useWizardStore.getState().setStep(11);
    expect(useWizardStore.getState().currentStep).toBe(11);
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

  it('setHasProfile(true) sets currentStep to 0', () => {
    useWizardStore.getState().setHasProfile(true);
    const state = useWizardStore.getState();
    expect(state.hasProfile).toBe(true);
    expect(state.currentStep).toBe(0);
  });

  it('setHasProfile(false) sets currentStep to 1', () => {
    useWizardStore.getState().setHasProfile(true);
    useWizardStore.getState().setHasProfile(false);
    const state = useWizardStore.getState();
    expect(state.hasProfile).toBe(false);
    expect(state.currentStep).toBe(1);
  });

  it('reset restores initial state', () => {
    useWizardStore.getState().setMarket(mockMarket);
    useWizardStore.getState().setStep(4);
    useWizardStore.getState().setHasProfile(true);
    useWizardStore.getState().reset();
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.market).toBeNull();
    expect(state.hasProfile).toBe(false);
    expect(state.preferences).toEqual({});
  });

  it('selectedPlatforms is not present in the store', () => {
    const state = useWizardStore.getState();
    expect('selectedPlatforms' in state).toBe(false);
  });
});
