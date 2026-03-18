/**
 * P5 — Graceful Degradation Contract Test
 * Verifies: Every component handles empty/partial input without throwing.
 * Covers: P5 principle, extraction scripts, PayloadBuilder, stores
 */
import { describe, it, expect } from 'vitest';
import { PayloadBuilder } from '../../../src/main/extraction/PayloadBuilder.js';
import { ExtractionScriptRegistry } from '../../../src/main/extraction/ExtractionScriptRegistry.js';
import { useExtractionStore } from '../../../src/renderer/store/extractionStore.js';
import { useWizardStore } from '../../../src/renderer/store/wizardStore.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';
import type { UserPreferences } from '../../../src/shared/types/AnalysisPayload.js';

const usMarket: MarketContext = {
  marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'],
};

const basePrefs: UserPreferences = {
  market: usMarket, budget: { min: 100, max: 500, currency: 'USD' },
  riskTolerance: 'medium', targetPlatforms: ['amazon-us'],
  categories: ['electronics'], sellerExperience: 'some',
};

describe('Contract: Graceful Degradation (P5)', () => {
  it('PayloadBuilder.normalizeAll skips unknown platforms without throwing', () => {
    const builder = new PayloadBuilder();
    const result = builder.normalizeAll({
      'nonexistent-platform': [{
        platformId: 'nonexistent-platform', url: 'https://x.com',
        extractedAt: new Date().toISOString(), data: {},
      }],
    });
    expect(result.size).toBe(0); // skipped gracefully
  });

  it('PayloadBuilder.build works with empty platformData', () => {
    const builder = new PayloadBuilder();
    const payload = builder.build('sess', basePrefs, new Map());
    expect(payload.platformData).toEqual({});
    expect(payload.extractionMetadata.platforms).toEqual([]);
  });

  it('ExtractionScriptRegistry.get returns undefined for unknown platform', () => {
    const reg = new ExtractionScriptRegistry();
    expect(reg.get('does-not-exist')).toBeUndefined();
  });

  it('ExtractionScriptRegistry.getForMarket returns empty for unknown market', () => {
    const reg = new ExtractionScriptRegistry();
    expect(reg.getForMarket('mars')).toEqual([]);
  });

  it('extractionStore handles updateTask for non-initialized platform gracefully', () => {
    const store = useExtractionStore;
    store.getState().reset();
    // updateTask on uninitialized platform — should not throw
    expect(() => store.getState().updateTask('unknown', { status: 'done', productCount: 5 })).not.toThrow();
  });

  it('extractionStore allDone is false when no platforms initialized', () => {
    const store = useExtractionStore;
    store.getState().reset();
    expect(store.getState().allDone).toBe(false);
  });

  it('wizardStore works with null market', () => {
    const store = useWizardStore;
    store.setState({ market: null, currentStep: 1, preferences: {}, hasProfile: false });
    expect(store.getState().market).toBeNull();
    expect(store.getState().currentStep).toBe(1);
  });
});
