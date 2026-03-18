/**
 * Unit Test — ApiKeyManager encrypt/decrypt, clear, status check (F-04, #208).
 *
 * AC:
 * 1. saveKey + getKey round-trip produces original key
 * 2. clearKey + hasKey returns false
 * 3. getKey with no stored key throws typed error
 * 4. No key value in any log output
 *
 * Principles tested: P1 (credentials never leave client — encrypted, never logged)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock electron safeStorage ───────────────────────────────────────

const mockEncryptedStore = new Map<string, string>();

vi.mock('electron', () => {
  // Simulate safeStorage with simple base64 "encryption" for testing
  return {
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (plaintext: string): Buffer => {
        // Simulated encryption: reverse + base64 (NOT real crypto — test only)
        const reversed = plaintext.split('').reverse().join('');
        return Buffer.from(reversed, 'utf-8');
      },
      decryptString: (encrypted: Buffer): string => {
        // Simulated decryption: reverse back
        const reversed = encrypted.toString('utf-8');
        return reversed.split('').reverse().join('');
      },
    },
  };
});

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

// Import after mocks
import { ApiKeyManager } from '../../src/main/store/ApiKeyManager.js';

// ── Tests ────────────────────────────────────────────────────────────

describe('ApiKeyManager', () => {
  let manager: ApiKeyManager;

  beforeEach(async () => {
    mockStoreData.clear();
    manager = new ApiKeyManager();
    await manager.ready();
  });

  // AC-1: saveKey + getKey round-trip produces original key
  describe('AC-1: encrypt/decrypt round-trip', () => {
    it('saveKey + getKey returns the original API key', () => {
      const key = 'sk-test-key-abc123xyz';
      manager.saveKey(key);
      expect(manager.getKey()).toBe(key);
    });

    it('round-trips a long API key', () => {
      const key = 'sk-' + 'a'.repeat(200);
      manager.saveKey(key);
      expect(manager.getKey()).toBe(key);
    });

    it('round-trips a key with special characters', () => {
      const key = 'sk-key_with-special.chars/2026!@#$%';
      manager.saveKey(key);
      expect(manager.getKey()).toBe(key);
    });

    it('overwriting a key replaces the previous one', () => {
      manager.saveKey('first-key');
      manager.saveKey('second-key');
      expect(manager.getKey()).toBe('second-key');
    });

    it('stored value is not the plaintext key (encrypted)', () => {
      const key = 'sk-plaintext-key';
      manager.saveKey(key);
      // The raw stored value should be base64 of encrypted bytes, NOT the plaintext
      const rawStored = mockStoreData.get('encryptedApiKey') as string;
      expect(rawStored).not.toBe(key);
      expect(rawStored).toBeTypeOf('string');
    });
  });

  // AC-2: clearKey + hasKey returns false
  describe('AC-2: clearKey and hasKey', () => {
    it('hasKey returns true after saveKey', () => {
      manager.saveKey('my-key');
      expect(manager.hasKey()).toBe(true);
    });

    it('clearKey removes the stored key', () => {
      manager.saveKey('my-key');
      manager.clearKey();
      expect(manager.hasKey()).toBe(false);
    });

    it('hasKey returns false on fresh store', () => {
      expect(manager.hasKey()).toBe(false);
    });

    it('clearKey is idempotent — no error when called twice', () => {
      manager.saveKey('my-key');
      manager.clearKey();
      expect(() => manager.clearKey()).not.toThrow();
      expect(manager.hasKey()).toBe(false);
    });
  });

  // AC-3: getKey with no stored key throws typed error
  describe('AC-3: getKey without stored key throws', () => {
    it('throws "No API key stored" when no key exists', () => {
      expect(() => manager.getKey()).toThrow('No API key stored');
    });

    it('throws after clearKey removes the key', () => {
      manager.saveKey('temp-key');
      manager.clearKey();
      expect(() => manager.getKey()).toThrow('No API key stored');
    });
  });

  // AC-4: No key value in any log output (P1)
  describe('AC-4: no key leakage in logs (P1)', () => {
    it('saveKey does not log the key value', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const key = 'sk-super-secret-key-12345';
      manager.saveKey(key);
      manager.getKey();

      const allCalls = [
        ...consoleSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...infoSpy.mock.calls,
      ];

      for (const args of allCalls) {
        const output = args.map(String).join(' ');
        expect(output).not.toContain(key);
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });

  // Input validation
  describe('input validation', () => {
    it('rejects empty string key', () => {
      expect(() => manager.saveKey('')).toThrow('API key must be a non-empty string');
    });

    it('rejects non-string key', () => {
      expect(() => manager.saveKey(null as unknown as string)).toThrow();
    });
  });

  // Encryption availability
  describe('encryption availability', () => {
    it('saveKey and getKey work when encryption is available', () => {
      manager.saveKey('test-key');
      expect(manager.getKey()).toBe('test-key');
    });
  });
});
