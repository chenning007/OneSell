/**
 * Unit tests for rank_competition tool (P3, P4).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { rankCompetition } from '../../src/services/agent/tools/rank-competition.js';
import type { RankCompetitionInput, ListingData } from '../../src/services/agent/tools/types.js';

describe('rank_competition', () => {
  it('has correct tool metadata', () => {
    expect(rankCompetition.name).toBe('rank_competition');
    expect(rankCompetition.description).toBeTruthy();
  });

  // ── Empty listings → max score ────────────────────────────────────

  it('returns score 100 for empty listings array', () => {
    const r = rankCompetition.execute({ listings: [], market: 'us' });
    expect(r.score).toBe(100);
    expect(r.narrative).toContain('wide open');
  });

  // ── Low competition ───────────────────────────────────────────────

  it('scores high for few low-review listings', () => {
    const listings: ListingData[] = [
      { reviewCount: 5 },
      { reviewCount: 8 },
      { reviewCount: 3 },
    ];
    const r = rankCompetition.execute({ listings, market: 'us' });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.narrative).toContain('Low competition');
  });

  // ── High competition ──────────────────────────────────────────────

  it('scores low for many high-review listings', () => {
    const listings: ListingData[] = Array.from({ length: 300 }, () => ({
      reviewCount: 15_000,
      sellerAge: 72,
    }));
    const r = rankCompetition.execute({ listings, market: 'us' });
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.narrative).toContain('Saturated');
  });

  // ── Moderate competition ──────────────────────────────────────────

  it('scores moderately for medium review counts', () => {
    const listings: ListingData[] = Array.from({ length: 30 }, () => ({
      reviewCount: 500,
    }));
    const r = rankCompetition.execute({ listings, market: 'us' });
    expect(r.score).toBeGreaterThan(25);
    expect(r.score).toBeLessThanOrEqual(80);
  });

  // ── Market-specific thresholds (P4) ───────────────────────────────

  it('uses JP thresholds (lower saturation point)', () => {
    const listings: ListingData[] = Array.from({ length: 20 }, () => ({
      reviewCount: 1_500,
    }));
    const usResult = rankCompetition.execute({ listings, market: 'us' });
    const jpResult = rankCompetition.execute({ listings, market: 'jp' });
    // JP has lower saturation threshold, so same reviews = more competition
    expect(jpResult.score).toBeLessThan(usResult.score);
  });

  it('handles all 7 markets', () => {
    const markets = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'] as const;
    const listings: ListingData[] = [{ reviewCount: 100 }];
    for (const market of markets) {
      const r = rankCompetition.execute({ listings, market });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.narrative).toBeTruthy();
    }
  });

  // ── Seller age influence ──────────────────────────────────────────

  it('scores higher when sellers are young (< 6 months)', () => {
    const young: ListingData[] = [
      { reviewCount: 100, sellerAge: 2 },
      { reviewCount: 100, sellerAge: 4 },
    ];
    const old: ListingData[] = [
      { reviewCount: 100, sellerAge: 72 },
      { reviewCount: 100, sellerAge: 84 },
    ];
    const youngResult = rankCompetition.execute({ listings: young, market: 'us' });
    const oldResult = rankCompetition.execute({ listings: old, market: 'us' });
    expect(youngResult.score).toBeGreaterThan(oldResult.score);
  });

  // ── Seller count influence ────────────────────────────────────────

  it('scores lower with 200+ sellers vs 5 sellers', () => {
    const fewSellers: ListingData[] = Array.from({ length: 3 }, () => ({ reviewCount: 50 }));
    const manySellers: ListingData[] = Array.from({ length: 250 }, () => ({ reviewCount: 50 }));
    const fewResult = rankCompetition.execute({ listings: fewSellers, market: 'us' });
    const manyResult = rankCompetition.execute({ listings: manySellers, market: 'us' });
    expect(fewResult.score).toBeGreaterThan(manyResult.score);
  });

  // ── Score bounds ──────────────────────────────────────────────────

  it('score is always between 0 and 100', () => {
    const extremes: RankCompetitionInput[] = [
      { listings: [], market: 'us' },
      { listings: [{ reviewCount: 0 }], market: 'us' },
      { listings: Array.from({ length: 500 }, () => ({ reviewCount: 100_000, sellerAge: 120 })), market: 'us' },
    ];
    for (const input of extremes) {
      const r = rankCompetition.execute(input);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  // ── Determinism (P3) ──────────────────────────────────────────────

  it('returns identical results for identical inputs', () => {
    const input: RankCompetitionInput = {
      listings: [{ reviewCount: 200, sellerAge: 12, salesVolume: 50 }],
      market: 'de',
    };
    const r1 = rankCompetition.execute(input);
    const r2 = rankCompetition.execute(input);
    expect(r1).toEqual(r2);
  });
});
