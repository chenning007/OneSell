/**
 * LocalStore — Typed electron-store wrapper for persisting user data (F-01).
 *
 * PRD §12.4, ADR-005 D4:
 * - Profile, preferences, and history stored locally via electron-store
 * - Data persists between app restarts
 * - Credentials are stripped before writing (P1)
 *
 * Closes #205
 */

import type { MarketContext } from '../../shared/types/MarketContext.js';

// electron-store v11 is ESM-only; dynamic import required for CJS main process
let StoreConstructor: typeof import('electron-store').default | null = null;
async function getStoreClass(): Promise<typeof import('electron-store').default> {
  if (!StoreConstructor) {
    const mod = await import('electron-store');
    StoreConstructor = mod.default;
  }
  return StoreConstructor;
}

// ── Stored data shapes ──────────────────────────────────────────────

export interface SavedProfile {
  readonly marketId: string;
  readonly extractionMode: 'auto-discover';
  readonly lastSessionAt: string; // ISO 8601
}

export interface SavedPreferences {
  readonly budget?: { readonly min: number; readonly max: number; readonly currency: string };
  readonly riskTolerance?: 'low' | 'medium' | 'high';
  readonly sellerExperience?: 'none' | 'some' | 'experienced';
  readonly productType?: 'physical' | 'digital';
  readonly fulfillmentTime?: 'low' | 'medium' | 'high';
}

export interface HistoryEntry {
  readonly sessionId: string;
  readonly marketId: string;
  readonly timestamp: string; // ISO 8601
  readonly productCount: number;
  readonly categoryCount: number;
}

interface StoreSchema {
  profile: SavedProfile | null;
  preferences: SavedPreferences;
  history: HistoryEntry[];
}

// ── Credential field names to strip (P1) ────────────────────────────

const CREDENTIAL_FIELDS = new Set([
  'apiKey', 'api_key', 'apikey',
  'secret', 'secretKey', 'secret_key',
  'token', 'accessToken', 'access_token',
  'password', 'passwd',
  'authorization',
  'cookie', 'cookies',
  'sessionToken', 'session_token',
  'refreshToken', 'refresh_token',
]);

/**
 * Recursively strip credential fields from an object before writing to disk.
 * Returns a shallow-safe copy — nested objects are also cleaned.
 */
function stripCredentials<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => stripCredentials(item)) as unknown as T;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (CREDENTIAL_FIELDS.has(key)) {
      continue; // strip this field entirely
    }
    cleaned[key] = stripCredentials(value);
  }
  return cleaned as T;
}

// ── LocalStore ──────────────────────────────────────────────────────

/**
 * Generic typed wrapper around electron-store's get/set.
 * Avoids ESM/CJS type-resolution issues at compile time.
 */
interface TypedStore<T> {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
}

export class LocalStore {
  #store: TypedStore<StoreSchema> | null = null;
  readonly #initPromise: Promise<void>;

  constructor() {
    this.#initPromise = this.#init();
  }

  async #init(): Promise<void> {
    const Store = await getStoreClass();
    this.#store = new Store<StoreSchema>({
      name: 'onesell-scout-data',
      defaults: {
        profile: null,
        preferences: {},
        history: [],
      },
    }) as unknown as TypedStore<StoreSchema>;
  }

  /** Ensure the store is initialized before use. */
  async ready(): Promise<void> {
    await this.#initPromise;
  }

  #requireStore(): TypedStore<StoreSchema> {
    if (!this.#store) throw new Error('LocalStore not initialized — call await store.ready() first');
    return this.#store;
  }

  // ── Profile ───────────────────────────────────────────────────────

  getProfile(): SavedProfile | null {
    return this.#requireStore().get('profile');
  }

  setProfile(profile: SavedProfile): void {
    this.#requireStore().set('profile', stripCredentials(profile) as SavedProfile);
  }

  clearProfile(): void {
    this.#requireStore().set('profile', null);
  }

  // ── Preferences ───────────────────────────────────────────────────

  getPreferences(): SavedPreferences {
    return this.#requireStore().get('preferences');
  }

  setPreferences(prefs: SavedPreferences): void {
    this.#requireStore().set('preferences', stripCredentials(prefs) as SavedPreferences);
  }

  // ── History ───────────────────────────────────────────────────────

  getHistory(): HistoryEntry[] {
    return this.#requireStore().get('history');
  }

  addHistoryEntry(entry: HistoryEntry): void {
    const history = this.getHistory();
    // FIFO cap at 10 entries (F-15, #277 — PRD §8.6)
    const updated = [stripCredentials(entry), ...history].slice(0, 10);
    this.#requireStore().set('history', updated);
  }
}
