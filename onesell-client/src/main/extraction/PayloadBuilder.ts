import type { AnalysisPayload, UserPreferences } from '../../shared/types/index.js';
import type { NormalizedPlatformData, RawPlatformData } from '../../shared/types/index.js';
import { registry } from './ExtractionScriptRegistry.js';

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Keys whose presence in the payload would violate P1 (credential leakage)
const CREDENTIAL_KEYS = new Set([
  'password', 'token', 'cookie', 'credential', 'secret', 'auth', 'session',
]);

function isCredentialKey(key: string): boolean {
  return CREDENTIAL_KEYS.has(key.toLowerCase());
}

/**
 * Deep-strips any object key whose name matches a known credential pattern.
 * Defense-in-depth for P1: credentials must never leave the client.
 */
function stripCredentials<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripCredentials) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!isCredentialKey(k)) {
        result[k] = stripCredentials(v);
      }
    }
    return result as T;
  }
  return value;
}

export class PayloadBuilder {
  /**
   * Normalizes raw platform data using registered extraction scripts.
   * Handles partial/missing data gracefully (P5).
   */
  normalizeAll(rawResults: Record<string, RawPlatformData[]>): Map<string, NormalizedPlatformData> {
    const normalized = new Map<string, NormalizedPlatformData>();

    for (const [platformId, rawList] of Object.entries(rawResults)) {
      const script = registry.get(platformId);
      if (!script) {
        console.warn(`[PayloadBuilder] No registered script for platformId "${platformId}" — skipping.`);
        continue;
      }
      try {
        const data = script.normalizeData(rawList);
        normalized.set(platformId, data);
      } catch (err) {
        console.warn(`[PayloadBuilder] normalizeData threw for "${platformId}" — skipping.`, err);
      }
    }

    return normalized;
  }

  /**
   * Builds and validates the AnalysisPayload from normalized extraction results.
   * P1: Strips credential-shaped fields.
   * P9: Validates size < 5MB.
   */
  build(
    sessionId: string,
    preferences: UserPreferences,
    normalizedData: Map<string, NormalizedPlatformData>,
  ): AnalysisPayload {
    const platformData: Record<string, NormalizedPlatformData> = {};
    const scriptVersions: Record<string, string> = {};

    for (const [platformId, data] of normalizedData.entries()) {
      platformData[platformId] = data;
      scriptVersions[platformId] = data.scriptVersion;
    }

    const payload: AnalysisPayload = {
      sessionId,
      market: preferences.market,
      userPreferences: preferences,
      platformData,
      extractionMetadata: {
        platforms: Array.from(normalizedData.keys()),
        extractedAt: new Date().toISOString(),
        scriptVersions,
      },
    };

    // P1: strip credential-shaped keys as a defense-in-depth measure
    const clean = stripCredentials(payload);

    // P9: enforce 5MB size limit (UTF-16 estimate: 2 bytes per char)
    const sizeBytes = JSON.stringify(clean).length * 2;
    if (sizeBytes > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `AnalysisPayload exceeds 5MB size limit (${sizeBytes} bytes). Reduce the data and try again.`,
      );
    }

    return clean;
  }
}
