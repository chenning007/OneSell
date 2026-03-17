import { create } from 'zustand';
import type { ProductCard } from '../../shared/types/index.js';

export type AnalysisStatus = 'idle' | 'planning' | 'executing' | 'synthesizing' | 'complete' | 'error';

interface AnalysisState {
  analysisId: string | null;
  status: AnalysisStatus;
  results: ProductCard[];
  error: string | null;
  selectedCardId: string | null;
}

interface AnalysisActions {
  setAnalysisId: (id: string) => void;
  setStatus: (status: AnalysisStatus) => void;
  setResults: (results: ProductCard[]) => void;
  setError: (error: string | null) => void;
  setSelectedCardId: (cardId: string | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState & AnalysisActions>((set) => ({
  analysisId: null,
  status: 'idle',
  results: [],
  error: null,
  selectedCardId: null,

  setAnalysisId: (id) => set({ analysisId: id }),
  setStatus: (status) => set({ status }),
  setResults: (results) => set({ results }),
  setError: (error) => set({ error }),
  setSelectedCardId: (cardId) => set({ selectedCardId: cardId }),
  reset: () => set({ analysisId: null, status: 'idle', results: [], error: null, selectedCardId: null }),
}));
