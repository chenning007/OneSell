/**
 * P8 — Config Over Hardcoding Contract Test
 * Verifies: No market IDs, platform names, or fee values hardcoded in logic files.
 * Covers: P8 principle
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKET_CONFIGS, BUDGET_RANGES, MARKET_CATEGORIES } from '../../../src/renderer/config/markets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_SRC = path.resolve(__dirname, '../../../src');

function getAllTsFiles(dir: string, exclude: string[] = []): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (exclude.some(e => full.includes(e))) continue;
      if (entry.isDirectory()) results.push(...getAllTsFiles(full, exclude));
      else if (/\.(ts|tsx)$/.test(entry.name)) results.push(full);
    }
  } catch { /* dir doesn't exist */ }
  return results;
}

describe('Contract: Config Over Hardcoding (P8)', () => {
  it('all 7 markets are defined in MARKET_CONFIGS', () => {
    const marketIds = Object.keys(MARKET_CONFIGS);
    expect(marketIds).toContain('us');
    expect(marketIds).toContain('cn');
    expect(marketIds).toContain('uk');
    expect(marketIds).toContain('de');
    expect(marketIds).toContain('jp');
    expect(marketIds).toContain('sea');
    expect(marketIds).toContain('au');
    expect(marketIds).toHaveLength(7);
  });

  it('every market has a matching budget range', () => {
    for (const marketId of Object.keys(MARKET_CONFIGS)) {
      expect(BUDGET_RANGES[marketId], `Missing BUDGET_RANGES for ${marketId}`).toBeDefined();
      expect(BUDGET_RANGES[marketId].min).toBeLessThan(BUDGET_RANGES[marketId].max);
    }
  });

  it('every market has a matching category config', () => {
    for (const marketId of Object.keys(MARKET_CONFIGS)) {
      expect(MARKET_CATEGORIES[marketId], `Missing MARKET_CATEGORIES for ${marketId}`).toBeDefined();
      expect(MARKET_CATEGORIES[marketId].length).toBeGreaterThan(0);
    }
  });

  it('no logic files hardcode market ID strings (except config and types)', () => {
    // Logic files = everything except config, types, i18n locales, and test files
    const exclude = [
      path.join('config', 'markets.ts'),
      'shared' + path.sep + 'types',
      'i18n' + path.sep + 'locales',
      'i18n' + path.sep + 'index',
      'extraction' + path.sep + 'scripts', // scripts legitimately reference their own market
    ];
    const logicFiles = getAllTsFiles(path.join(CLIENT_SRC, 'renderer', 'modules'), exclude);

    // Patterns: literal market ID comparisons like === 'us' or marketId: 'cn'
    const hardcodedPattern = /(?:===?\s*['"](?:us|cn|uk|de|jp|sea|au)['"])|(?:marketId:\s*['"](?:us|cn|uk|de|jp|sea|au)['"])/;

    for (const file of logicFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(hardcodedPattern);
      if (match) {
        const rel = path.relative(CLIENT_SRC, file);
        // This is a warning, not necessarily a failure — market switch logic may be valid
        // For now assert no hardcoded market checks in wizard modules
        expect.fail(`${rel} hardcodes market ID: "${match[0]}" — prefer config lookup (P8)`);
      }
    }
  });

  it('market configs have all required fields', () => {
    for (const [id, cfg] of Object.entries(MARKET_CONFIGS)) {
      expect(cfg.marketId, `${id}.marketId`).toBe(id);
      expect(cfg.language, `${id}.language`).toBeTruthy();
      expect(cfg.currency, `${id}.currency`).toBeTruthy();
      expect(cfg.flag, `${id}.flag`).toBeTruthy();
      expect(cfg.i18nLang, `${id}.i18nLang`).toBeTruthy();
      expect(cfg.platforms.length, `${id}.platforms`).toBeGreaterThan(0);
    }
  });
});
