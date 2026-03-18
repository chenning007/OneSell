/**
 * ApiKeyManager — Secure API key storage using Electron's safeStorage (F-03).
 *
 * PRD §12.3, ADR-005 D4:
 * - Encrypts API key via safeStorage.encryptString() (OS keychain)
 * - Stores encrypted buffer in electron-store
 * - Key is NEVER logged, printed, or sent to the renderer process (P1)
 *
 * Closes #207
 */

import { safeStorage } from 'electron';

// ── Store schema for encrypted key ──────────────────────────────────

interface KeyStoreSchema {
  /** Base64-encoded encrypted buffer. Never store plaintext. */
  encryptedApiKey: string | null;
}

// ── ApiKeyManager ───────────────────────────────────────────────────

// electron-store v11 is ESM-only; dynamic import required for CJS main process
let StoreConstructor: typeof import('electron-store').default | null = null;
async function getStoreClass(): Promise<typeof import('electron-store').default> {
  if (!StoreConstructor) {
    const mod = await import('electron-store');
    StoreConstructor = mod.default;
  }
  return StoreConstructor;
}

interface TypedStore<T> {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
}

export class ApiKeyManager {
  #store: TypedStore<KeyStoreSchema> | null = null;
  readonly #initPromise: Promise<void>;

  constructor() {
    this.#initPromise = this.#init();
  }

  async #init(): Promise<void> {
    const Store = await getStoreClass();
    this.#store = new Store<KeyStoreSchema>({
      name: 'onesell-scout-keys',
      defaults: {
        encryptedApiKey: null,
      },
    }) as unknown as TypedStore<KeyStoreSchema>;
  }

  /** Ensure the store is initialized before use. */
  async ready(): Promise<void> {
    await this.#initPromise;
  }

  #requireStore(): TypedStore<KeyStoreSchema> {
    if (!this.#store) throw new Error('ApiKeyManager not initialized — call await manager.ready() first');
    return this.#store;
  }

  /**
   * Encrypt and persist the API key using OS-level safeStorage.
   * The plaintext key is never written to disk (P1).
   */
  saveKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('API key must be a non-empty string');
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level encryption (safeStorage) is not available');
    }

    const encrypted = safeStorage.encryptString(key);
    // Store as base64 so it survives JSON serialization
    this.#requireStore().set('encryptedApiKey', encrypted.toString('base64'));
  }

  /**
   * Decrypt and return the stored API key.
   * Throws if no key is stored.
   */
  getKey(): string {
    const encoded = this.#requireStore().get('encryptedApiKey');
    if (!encoded) {
      throw new Error('No API key stored');
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-level encryption (safeStorage) is not available');
    }

    const encrypted = Buffer.from(encoded, 'base64');
    return safeStorage.decryptString(encrypted);
  }

  /**
   * Remove the stored API key entirely.
   */
  clearKey(): void {
    this.#requireStore().set('encryptedApiKey', null);
  }

  /**
   * Check whether an API key has been stored.
   */
  hasKey(): boolean {
    return this.#requireStore().get('encryptedApiKey') !== null;
  }
}
