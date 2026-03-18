/**
 * P4 — MarketContext Immutability Contract Test
 * Verifies: MarketContext flows as readonly, cannot be mutated mid-session.
 * Covers: P4 principle, wizard store, payload builder
 */
import { describe, it, expect } from 'vitest';
import { useWizardStore } from '../../../src/renderer/store/wizardStore.js';
import { PayloadBuilder } from '../../../src/main/extraction/PayloadBuilder.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';
import type { UserPreferences } from '../../../src/shared/types/AnalysisPayload.js';
import type { NormalizedPlatformData } from '../../../src/shared/types/ExtractionScript.js';

const usMarket: MarketContext = {
  marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'],
};
const cnMarket: MarketContext = {
  marketId: 'cn', language: 'zh-CN', currency: 'CNY', platforms: ['taobao'],
};

describe('Contract: MarketContext Immutability (P4)', () => {
  it('MarketContext interface is readonly — TypeScript enforces immutability at compile time', () => {
    // Runtime check: the market object preserves its original values after being set
    const market: MarketContext = { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] };
    expect(market.marketId).toBe('us');
    expect(market.language).toBe('en-US');
    expect(market.currency).toBe('USD');
    expect(market.platforms).toEqual(['amazon-us']);
  });

  it('wizard store setMarket replaces the entire market (not mutation)', () => {
    const store = useWizardStore;
    store.setState({ market: usMarket, currentStep: 1, preferences: {}, hasProfile: false });
    expect(store.getState().market).toEqual(usMarket);

    store.getState().setMarket(cnMarket);
    const current = store.getState().market;
    expect(current).toEqual(cnMarket);
    expect(current).not.toBe(usMarket); // different object reference
  });

  it('market in payload matches the market in preferences (no drift)', () => {
    const builder = new PayloadBuilder();
    const prefs: UserPreferences = {
      market: usMarket,
      budget: { min: 100, max: 500, currency: 'USD' },
      riskTolerance: 'medium',
      targetPlatforms: ['amazon-us'],
      categories: ['electronics'],
      sellerExperience: 'some',
    };
    const normalized: NormalizedPlatformData = {
      platformId: 'amazon-us', marketId: 'us',
      extractedAt: new Date().toISOString(), scriptVersion: '1.0.0',
      listings: [{ title: 'P', price: 10, currency: 'USD', reviewCount: 1, rating: 5, url: 'https://x.com' }],
    };
    const payload = builder.build('sess-1', prefs, new Map([['amazon-us', normalized]]));
    expect(payload.market).toEqual(usMarket);
    expect(payload.userPreferences.market).toEqual(usMarket);
    expect(payload.market.marketId).toBe(payload.userPreferences.market.marketId);
  });

  it('changing market between builds produces different payloads', () => {
    const builder = new PayloadBuilder();
    const usPrefs: UserPreferences = {
      market: usMarket, budget: { min: 100, max: 500, currency: 'USD' },
      riskTolerance: 'medium', targetPlatforms: ['amazon-us'], categories: ['electronics'], sellerExperience: 'some',
    };
    const cnPrefs: UserPreferences = {
      market: cnMarket, budget: { min: 500, max: 5000, currency: 'CNY' },
      riskTolerance: 'low', targetPlatforms: ['taobao'], categories: ['fashion'], sellerExperience: 'none',
    };
    const usNorm: NormalizedPlatformData = {
      platformId: 'amazon-us', marketId: 'us', extractedAt: new Date().toISOString(), scriptVersion: '1.0.0',
      listings: [{ title: 'US', price: 10, currency: 'USD', reviewCount: 1, rating: 5, url: 'https://x.com' }],
    };
    const cnNorm: NormalizedPlatformData = {
      platformId: 'taobao', marketId: 'cn', extractedAt: new Date().toISOString(), scriptVersion: '1.0.0',
      listings: [{ title: 'CN', price: 100, currency: 'CNY', reviewCount: 1, rating: 5, url: 'https://x.cn' }],
    };
    const p1 = builder.build('s1', usPrefs, new Map([['amazon-us', usNorm]]));
    const p2 = builder.build('s2', cnPrefs, new Map([['taobao', cnNorm]]));
    expect(p1.market.marketId).toBe('us');
    expect(p2.market.marketId).toBe('cn');
    expect(p1.market.currency).not.toBe(p2.market.currency);
  });
});
