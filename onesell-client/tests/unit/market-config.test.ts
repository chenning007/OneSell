import { describe, it, expect } from 'vitest';
import { MARKET_CONFIGS, BUDGET_RANGES, MARKET_CATEGORIES } from '../../src/renderer/config/markets.js';

const REQUIRED_MARKET_IDS = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'] as const;

describe('market-config', () => {
  it('defines all 7 markets', () => {
    expect(Object.keys(MARKET_CONFIGS)).toHaveLength(7);
    for (const id of REQUIRED_MARKET_IDS) {
      expect(MARKET_CONFIGS[id]).toBeDefined();
    }
  });

  it.each(REQUIRED_MARKET_IDS)('market %s has all required fields', (id) => {
    const config = MARKET_CONFIGS[id]!;
    expect(config.marketId).toBe(id);
    expect(config.language).toBeTruthy();
    expect(config.currency).toBeTruthy();
    expect(config.flag).toBeTruthy();
    expect(config.i18nLang).toBeTruthy();
    expect(config.platforms.length).toBeGreaterThan(0);
  });

  it('all markets have budget ranges', () => {
    for (const id of REQUIRED_MARKET_IDS) {
      const range = BUDGET_RANGES[id];
      expect(range).toBeDefined();
      expect(range!.min).toBeLessThan(range!.mid);
      expect(range!.mid).toBeLessThan(range!.max);
      expect(range!.currency).toBeTruthy();
      expect(range!.symbol).toBeTruthy();
    }
  });

  it('all markets have categories defined', () => {
    for (const id of REQUIRED_MARKET_IDS) {
      const categories = MARKET_CATEGORIES[id];
      expect(categories).toBeDefined();
      expect(categories!.length).toBeGreaterThan(0);
    }
  });

  it('US market uses USD', () => {
    expect(MARKET_CONFIGS['us']!.currency).toBe('USD');
    expect(BUDGET_RANGES['us']!.symbol).toBe('$');
  });

  it('CN market uses CNY', () => {
    expect(MARKET_CONFIGS['cn']!.currency).toBe('CNY');
    expect(BUDGET_RANGES['cn']!.symbol).toBe('¥');
  });
});
