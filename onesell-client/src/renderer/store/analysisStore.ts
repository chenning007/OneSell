/**
 * analysisStore v2 — categorized candidates (R-01, #253).
 *
 * PRD §8, ADR-005 D3:
 * - `categories` field for grouped CandidateCategory[]
 * - `setResults(analysisResult)` populates categories + backward-compatible flat `results`
 * - `reset()` clears everything
 * - Status tracks planning → executing → synthesizing → complete pipeline
 *
 * Closes #253
 */

import { create } from 'zustand';
import type { ProductCard } from '../../shared/types/index.js';
import type { CandidateCategory, AnalysisResult, ProductCandidate } from '../../shared/types/index.js';

export type AnalysisStatus = 'idle' | 'planning' | 'executing' | 'synthesizing' | 'complete' | 'error';

interface AnalysisState {
  analysisId: string | null;
  status: AnalysisStatus;
  categories: CandidateCategory[];
  /** Backward-compatible flat results array — all candidates from all categories. */
  results: ProductCard[];
  error: string | null;
  selectedCardId: string | null;
}

interface AnalysisActions {
  setAnalysisId: (id: string) => void;
  setStatus: (status: AnalysisStatus) => void;
  /** Populate from v2 AnalysisResult or v1 ProductCard[] (backward compat). */
  setResults: (input: AnalysisResult | ProductCard[]) => void;
  setError: (error: string | null) => void;
  setSelectedCardId: (cardId: string | null) => void;
  reset: () => void;
}

/**
 * Flatten all candidates from all categories into a single ProductCard[].
 * ProductCandidate extends ProductCard, so the cast is safe.
 */
function flattenCandidates(categories: readonly CandidateCategory[]): ProductCard[] {
  const all: ProductCard[] = [];
  for (const cat of categories) {
    for (const product of cat.products) {
      all.push(product as ProductCandidate & ProductCard);
    }
  }
  return all;
}

export const useAnalysisStore = create<AnalysisState & AnalysisActions>((set) => ({
  analysisId: null,
  status: 'idle',
  categories: [],
  results: [],
  error: null,
  selectedCardId: null,

  setAnalysisId: (id) => set({ analysisId: id }),
  setStatus: (status) => set({ status }),

  setResults: (input) => {
    if (Array.isArray(input)) {
      // v1 backward compatibility: ProductCard[]
      set({ results: input, status: 'complete', error: null });
    } else {
      // v2: AnalysisResult with categories
      const categories = [...input.categories];
      const results = flattenCandidates(input.categories);
      set({ categories, results, status: 'complete', error: null });

      // F-15 (#277): Auto-save session to history after analysis completes (PRD §8.6)
      const totalProducts = results.length;
      const topProduct = results[0]?.productName ?? '';
      void window.electronAPI.store.addHistory({
        sessionId: input.sessionId,
        marketId: input.market.marketId,
        timestamp: input.generatedAt,
        productCount: totalProducts,
        categoryCount: categories.length,
      }).catch(() => { /* non-critical */ });
    }
  },

  setError: (error) => set({ error }),
  setSelectedCardId: (cardId) => set({ selectedCardId: cardId }),

  reset: () =>
    set({
      analysisId: null,
      status: 'idle',
      categories: [],
      results: [],
      error: null,
      selectedCardId: null,
    }),
}));
