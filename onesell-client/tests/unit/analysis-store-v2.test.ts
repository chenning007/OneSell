/**
 * R-02 (#254) — analysisStore v2 categories unit tests.
 *
 * AC:
 *   1. Setting results populates both categories and flat results
 *   2. Reset clears both
 *   3. Empty categories handled gracefully
 *
 * Principles:
 *   P5 — Graceful degradation: empty categories do not crash
 *   P7 — Extensible pipeline: ProductCard contract preserved
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import type { ProductCard } from '../../src/shared/types/index.js';
import type { CandidateCategory, AnalysisResult, ProductCandidate } from '../../src/shared/types/index.js';

// ── Helpers ──────────────────────────────────────────────────────────

function resetStore(): void {
  useAnalysisStore.getState().reset();
}

function makeProductCard(overrides: Partial<ProductCard> = {}): ProductCard {
  return {
    cardId: 'card-1',
    rank: 1,
    productName: 'Test Widget',
    market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    category: 'electronics',
    overallScore: 85,
    estimatedCogs: { value: 5, currency: 'USD' },
    estimatedSellPrice: { value: 20, currency: 'USD' },
    estimatedMargin: 0.6,
    primaryPlatform: 'amazon-us',
    supplierSearchTerms: ['widget'],
    riskFlags: [],
    agentJustification: 'High demand, low competition.',
    rawScores: { demand: 90, competition: 30, margin: 80, trend: 70, beginner: 85 },
    marketInsight: 'Growing category.',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    ...makeProductCard(),
    oneLineReason: 'High margin everyday item',
    whyBullets: ['Strong demand', 'Low competition', 'Good margins'],
    sourcePlatforms: [{ platformId: 'amazon-us', dataPoints: ['price', 'reviews'] }],
    ...overrides,
  };
}

function makeCategory(name: string, count: number): CandidateCategory {
  const products: ProductCandidate[] = [];
  for (let i = 0; i < count; i++) {
    products.push(
      makeCandidate({
        cardId: `card-${name}-${i}`,
        rank: i + 1,
        productName: `${name} Product ${i}`,
      }),
    );
  }
  return { name, products };
}

function makeAnalysisResult(categories: CandidateCategory[]): AnalysisResult {
  return {
    categories,
    generatedAt: '2026-03-15T12:00:00Z',
    marketId: 'us',
  };
}

// ═══════════════════════════════════════════════════════════════════
// AC-1: Setting results populates both categories and flat results
// ═══════════════════════════════════════════════════════════════════

describe('analysisStore v2 — setResults (AC-1)', () => {
  beforeEach(resetStore);

  it('v2 AnalysisResult populates categories', () => {
    const cat1 = makeCategory('Trending', 3);
    const cat2 = makeCategory('Evergreen', 2);
    const input = makeAnalysisResult([cat1, cat2]);

    useAnalysisStore.getState().setResults(input);

    const state = useAnalysisStore.getState();
    expect(state.categories).toHaveLength(2);
    expect(state.categories[0]!.name).toBe('Trending');
    expect(state.categories[1]!.name).toBe('Evergreen');
  });

  it('v2 AnalysisResult also populates flat results array', () => {
    const cat1 = makeCategory('Trending', 3);
    const cat2 = makeCategory('Evergreen', 2);
    const input = makeAnalysisResult([cat1, cat2]);

    useAnalysisStore.getState().setResults(input);

    const state = useAnalysisStore.getState();
    // Total products = 3 + 2 = 5
    expect(state.results).toHaveLength(5);
  });

  it('flat results contain all products from all categories', () => {
    const cat1 = makeCategory('A', 2);
    const cat2 = makeCategory('B', 1);
    const input = makeAnalysisResult([cat1, cat2]);

    useAnalysisStore.getState().setResults(input);

    const resultNames = useAnalysisStore.getState().results.map((r) => r.productName);
    expect(resultNames).toContain('A Product 0');
    expect(resultNames).toContain('A Product 1');
    expect(resultNames).toContain('B Product 0');
  });

  it('sets status to complete', () => {
    const input = makeAnalysisResult([makeCategory('X', 1)]);
    useAnalysisStore.getState().setResults(input);
    expect(useAnalysisStore.getState().status).toBe('complete');
  });

  it('clears error on setResults', () => {
    useAnalysisStore.getState().setError('previous error');
    const input = makeAnalysisResult([makeCategory('X', 1)]);
    useAnalysisStore.getState().setResults(input);
    expect(useAnalysisStore.getState().error).toBeNull();
  });

  // ── v1 backward compatibility ─────────────────────────────────

  it('v1 ProductCard[] sets flat results directly', () => {
    const cards: ProductCard[] = [
      makeProductCard({ cardId: 'v1-1', rank: 1 }),
      makeProductCard({ cardId: 'v1-2', rank: 2 }),
    ];
    useAnalysisStore.getState().setResults(cards);
    const state = useAnalysisStore.getState();
    expect(state.results).toHaveLength(2);
    expect(state.status).toBe('complete');
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-2: Reset clears both categories and flat results
// ═══════════════════════════════════════════════════════════════════

describe('analysisStore v2 — reset (AC-2)', () => {
  beforeEach(resetStore);

  it('reset clears categories', () => {
    const input = makeAnalysisResult([makeCategory('X', 3)]);
    useAnalysisStore.getState().setResults(input);
    expect(useAnalysisStore.getState().categories).toHaveLength(1);

    useAnalysisStore.getState().reset();
    expect(useAnalysisStore.getState().categories).toHaveLength(0);
  });

  it('reset clears flat results', () => {
    const input = makeAnalysisResult([makeCategory('X', 3)]);
    useAnalysisStore.getState().setResults(input);
    expect(useAnalysisStore.getState().results.length).toBeGreaterThan(0);

    useAnalysisStore.getState().reset();
    expect(useAnalysisStore.getState().results).toHaveLength(0);
  });

  it('reset restores idle status', () => {
    useAnalysisStore.getState().setStatus('executing');
    useAnalysisStore.getState().reset();
    expect(useAnalysisStore.getState().status).toBe('idle');
  });

  it('reset clears analysisId and error', () => {
    useAnalysisStore.getState().setAnalysisId('abc-123');
    useAnalysisStore.getState().setError('something went wrong');
    useAnalysisStore.getState().reset();

    const state = useAnalysisStore.getState();
    expect(state.analysisId).toBeNull();
    expect(state.error).toBeNull();
  });

  it('reset clears selectedCardId', () => {
    useAnalysisStore.getState().setSelectedCardId('card-1');
    useAnalysisStore.getState().reset();
    expect(useAnalysisStore.getState().selectedCardId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-3: Empty categories handled gracefully
// ═══════════════════════════════════════════════════════════════════

describe('analysisStore v2 — empty categories (AC-3)', () => {
  beforeEach(resetStore);

  it('setResults with empty categories array produces empty results', () => {
    const input = makeAnalysisResult([]);
    useAnalysisStore.getState().setResults(input);

    const state = useAnalysisStore.getState();
    expect(state.categories).toHaveLength(0);
    expect(state.results).toHaveLength(0);
    expect(state.status).toBe('complete');
  });

  it('categories with zero products produce empty flat results', () => {
    const emptyCategory: CandidateCategory = { name: 'Empty', products: [] };
    const input = makeAnalysisResult([emptyCategory]);
    useAnalysisStore.getState().setResults(input);

    const state = useAnalysisStore.getState();
    expect(state.categories).toHaveLength(1);
    expect(state.categories[0]!.name).toBe('Empty');
    expect(state.results).toHaveLength(0);
  });

  it('mix of populated and empty categories flattens correctly', () => {
    const full = makeCategory('Full', 2);
    const empty: CandidateCategory = { name: 'Empty', products: [] };
    const input = makeAnalysisResult([full, empty]);
    useAnalysisStore.getState().setResults(input);

    const state = useAnalysisStore.getState();
    expect(state.categories).toHaveLength(2);
    expect(state.results).toHaveLength(2); // only from 'Full'
  });
});

// ═══════════════════════════════════════════════════════════════════
// Status transitions
// ═══════════════════════════════════════════════════════════════════

describe('analysisStore v2 — status transitions', () => {
  beforeEach(resetStore);

  it('setStatus transitions through pipeline stages', () => {
    useAnalysisStore.getState().setStatus('planning');
    expect(useAnalysisStore.getState().status).toBe('planning');

    useAnalysisStore.getState().setStatus('executing');
    expect(useAnalysisStore.getState().status).toBe('executing');

    useAnalysisStore.getState().setStatus('synthesizing');
    expect(useAnalysisStore.getState().status).toBe('synthesizing');

    useAnalysisStore.getState().setStatus('complete');
    expect(useAnalysisStore.getState().status).toBe('complete');
  });

  it('setStatus to error sets error status', () => {
    useAnalysisStore.getState().setStatus('error');
    expect(useAnalysisStore.getState().status).toBe('error');
  });
});
