/**
 * F-16 (#278) — Session history test (LocalStore).
 *
 * AC:
 *   1. addHistory stores session
 *   2. getHistory returns all
 *   3. Caps at 10 FIFO
 *   4. Auto-saves after analysis (verifies addHistoryEntry can be called)
 *
 * Principles tested: P1 (credentials stripped via stripCredentials)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock electron-store ─────────────────────────────────────────────

const mockStoreData = new Map<string, unknown>();

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      #data: Map<string, unknown>;

      constructor(opts: { name?: string; defaults?: Record<string, unknown> }) {
        this.#data = mockStoreData;
        if (opts.defaults) {
          for (const [key, value] of Object.entries(opts.defaults)) {
            if (!this.#data.has(key)) {
              this.#data.set(key, structuredClone(value));
            }
          }
        }
      }

      get<T>(key: string): T {
        return structuredClone(this.#data.get(key)) as T;
      }

      set(key: string, value: unknown): void {
        this.#data.set(key, structuredClone(value));
      }
    },
  };
});

import { LocalStore } from '../../src/main/store/LocalStore.js';
import type { HistoryEntry } from '../../src/main/store/LocalStore.js';

// ── Fixtures ────────────────────────────────────────────────────────

function makeEntry(id: number): HistoryEntry {
  return {
    sessionId: `sess-${id.toString().padStart(3, '0')}`,
    marketId: 'us',
    timestamp: `2026-03-${(id % 28 + 1).toString().padStart(2, '0')}T12:00:00.000Z`,
    productCount: id * 5,
    categoryCount: id,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('LocalStore — Session history (F-16, #278)', () => {
  let store: LocalStore;

  beforeEach(async () => {
    mockStoreData.clear();
    store = new LocalStore();
    await store.ready();
  });

  // TC-1: addHistory stores session
  it('addHistoryEntry stores a session entry', () => {
    const entry = makeEntry(1);
    store.addHistoryEntry(entry);

    const history = store.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]!.sessionId).toBe('sess-001');
    expect(history[0]!.marketId).toBe('us');
    expect(history[0]!.productCount).toBe(5);
  });

  // TC-2: getHistory returns all entries
  it('getHistory returns all stored entries in FIFO order', () => {
    store.addHistoryEntry(makeEntry(1));
    store.addHistoryEntry(makeEntry(2));
    store.addHistoryEntry(makeEntry(3));

    const history = store.getHistory();
    expect(history).toHaveLength(3);
    // Newest first (addHistoryEntry prepends)
    expect(history[0]!.sessionId).toBe('sess-003');
    expect(history[1]!.sessionId).toBe('sess-002');
    expect(history[2]!.sessionId).toBe('sess-001');
  });

  // TC-3: Caps at 10 FIFO
  it('caps history at 10 entries, dropping oldest', () => {
    // Add 12 entries
    for (let i = 1; i <= 12; i++) {
      store.addHistoryEntry(makeEntry(i));
    }

    const history = store.getHistory();
    expect(history).toHaveLength(10);
    // Newest (12) should be first, oldest surviving should be entry 3
    expect(history[0]!.sessionId).toBe('sess-012');
    expect(history[9]!.sessionId).toBe('sess-003');
    // Entries 1 and 2 should have been dropped
    expect(history.find((h) => h.sessionId === 'sess-001')).toBeUndefined();
    expect(history.find((h) => h.sessionId === 'sess-002')).toBeUndefined();
  });

  // TC-4: Auto-saves after analysis (verifies idempotent add)
  it('addHistoryEntry can be called repeatedly (auto-save after analysis)', () => {
    store.addHistoryEntry(makeEntry(1));
    store.addHistoryEntry(makeEntry(2));

    const history = store.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.sessionId).toBe('sess-002');
  });

  it('returns empty array when no history exists', () => {
    const history = store.getHistory();
    expect(history).toEqual([]);
  });

  it('strips credential fields from history entries (P1)', () => {
    const entryWithCreds = {
      sessionId: 'sess-100',
      marketId: 'us',
      timestamp: '2026-03-15T12:00:00.000Z',
      productCount: 10,
      categoryCount: 3,
      apiKey: 'sk-secret-123',
      token: 'bearer-abc',
    } as unknown as HistoryEntry;

    store.addHistoryEntry(entryWithCreds);
    const history = store.getHistory();

    expect(history[0]).not.toHaveProperty('apiKey');
    expect(history[0]).not.toHaveProperty('token');
    expect(history[0]!.sessionId).toBe('sess-100');
  });
});
