import { describe, it, expect, beforeEach } from 'vitest';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';

describe('extractionStore', () => {
  beforeEach(() => {
    useExtractionStore.getState().reset();
  });

  it('initPlatforms creates entries for each platform in "waiting" state', () => {
    const { initPlatforms } = useExtractionStore.getState();
    initPlatforms(['amazon-us', 'ebay-us', 'etsy']);

    const { platforms } = useExtractionStore.getState();
    expect(platforms).toHaveLength(3);
    for (const p of platforms) {
      expect(p.status).toBe('waiting');
      expect(p.productCount).toBe(0);
      expect(p.errorMessage).toBeUndefined();
    }
    expect(platforms.map((p) => p.platformId)).toEqual(['amazon-us', 'ebay-us', 'etsy']);
  });

  it('setStatus transitions status correctly', () => {
    useExtractionStore.getState().initPlatforms(['amazon-us']);
    const { setStatus } = useExtractionStore.getState();

    setStatus('amazon-us', 'extracting');
    expect(useExtractionStore.getState().platforms[0]!.status).toBe('extracting');

    setStatus('amazon-us', 'done', 42);
    const p = useExtractionStore.getState().platforms[0]!;
    expect(p.status).toBe('done');
    expect(p.productCount).toBe(42);
  });

  it('setStatus records error message on error transition', () => {
    useExtractionStore.getState().initPlatforms(['ebay-us']);
    useExtractionStore.getState().setStatus('ebay-us', 'error', 0, 'Extraction failed');

    const p = useExtractionStore.getState().platforms[0]!;
    expect(p.status).toBe('error');
    expect(p.errorMessage).toBe('Extraction failed');
  });

  it('cancel sets cancelled flag', () => {
    useExtractionStore.getState().initPlatforms(['amazon-us']);
    expect(useExtractionStore.getState().cancelled).toBe(false);

    useExtractionStore.getState().cancel();
    expect(useExtractionStore.getState().cancelled).toBe(true);
  });

  it('reset restores initial state', () => {
    useExtractionStore.getState().initPlatforms(['amazon-us', 'ebay-us']);
    useExtractionStore.getState().setStatus('amazon-us', 'done', 10);
    useExtractionStore.getState().cancel();

    useExtractionStore.getState().reset();
    const state = useExtractionStore.getState();
    expect(state.platforms).toEqual([]);
    expect(state.cancelled).toBe(false);
    expect(state.allDone).toBe(false);
  });

  it('allDone is true only when all platforms are done or error', () => {
    useExtractionStore.getState().initPlatforms(['amazon-us', 'ebay-us']);
    expect(useExtractionStore.getState().allDone).toBe(false);

    useExtractionStore.getState().setStatus('amazon-us', 'done', 5);
    expect(useExtractionStore.getState().allDone).toBe(false);

    useExtractionStore.getState().setStatus('ebay-us', 'error', 0, 'failed');
    expect(useExtractionStore.getState().allDone).toBe(true);
  });

  it('allDone is false for empty platforms list', () => {
    // After reset, platforms is empty — allDone should remain false
    expect(useExtractionStore.getState().allDone).toBe(false);
  });

  it('allDone is false when some platforms are still waiting', () => {
    useExtractionStore.getState().initPlatforms(['amazon-us', 'ebay-us', 'etsy']);
    useExtractionStore.getState().setStatus('amazon-us', 'done', 3);
    // ebay-us and etsy still 'waiting'
    expect(useExtractionStore.getState().allDone).toBe(false);
  });
});
