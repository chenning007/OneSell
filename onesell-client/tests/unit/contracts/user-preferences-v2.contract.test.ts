/**
 * Contract Test — UserPreferences v2 Zod schema handles new shape (W-02, #228).
 *
 * AC:
 * 1. Schema validates payload with defaults (no productType/fulfillmentTime specified)
 * 2. Schema validates payload with explicit preferences
 * 3. Payload with removed fields (targetPlatforms) is accepted (fields simply absent)
 * 4. Invalid types rejected
 *
 * Principles tested: P4 (immutable context), P9 (boundary validation)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { UserPreferences, AnalysisPayload } from '../../../src/shared/types/AnalysisPayload.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

// ── Zod schema matching the UserPreferences v2 interface ────────────
// The source file defines TypeScript interfaces (not Zod schemas),
// so we build the schema here to validate conformance at the boundary.

const marketContextSchema = z.object({
  marketId: z.enum(['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au']),
  language: z.string().min(1),
  currency: z.string().min(1),
  platforms: z.array(z.string()),
});

const userPreferencesSchema = z.object({
  market: marketContextSchema,
  budget: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
    currency: z.string().min(1),
  }),
  riskTolerance: z.enum(['low', 'medium', 'high']),
  sellerExperience: z.enum(['none', 'some', 'experienced']),
  // v2: optional fields with defaults
  productType: z.enum(['physical', 'digital']).optional(),
  fulfillmentTime: z.enum(['low', 'medium', 'high']).optional(),
});

const analysisPayloadSchema = z.object({
  sessionId: z.string().min(1),
  market: marketContextSchema,
  userPreferences: userPreferencesSchema,
  platformData: z.record(z.string(), z.unknown()),
  extractionMetadata: z.object({
    platforms: z.array(z.string()),
    extractedAt: z.string(),
    scriptVersions: z.record(z.string(), z.string()),
  }),
});

// ── Fixtures ────────────────────────────────────────────────────────

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon-us', 'ebay-us'],
};

function makePreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    market: usMarket,
    budget: { min: 100, max: 500, currency: 'USD' },
    riskTolerance: 'medium',
    sellerExperience: 'some',
    ...overrides,
  };
}

function makePayload(prefs: UserPreferences): AnalysisPayload {
  return {
    sessionId: 'test-session-123',
    market: usMarket,
    userPreferences: prefs,
    platformData: {},
    extractionMetadata: {
      platforms: ['amazon-us'],
      extractedAt: '2026-03-15T00:00:00.000Z',
      scriptVersions: { 'amazon-us': '1.0.0' },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Contract: UserPreferences v2 Schema', () => {
  // AC-1: Schema validates payload with defaults (no productType/fulfillmentTime)
  describe('AC-1: defaults — optional fields omitted', () => {
    it('validates preferences without productType or fulfillmentTime', () => {
      const prefs = makePreferences();
      expect(prefs.productType).toBeUndefined();
      expect(prefs.fulfillmentTime).toBeUndefined();

      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('validates full AnalysisPayload with default preferences', () => {
      const payload = makePayload(makePreferences());
      const result = analysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  // AC-2: Schema validates payload with explicit preferences
  describe('AC-2: explicit preferences', () => {
    it('validates preferences with productType=physical', () => {
      const prefs = makePreferences({ productType: 'physical' });
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productType).toBe('physical');
      }
    });

    it('validates preferences with productType=digital', () => {
      const prefs = makePreferences({ productType: 'digital' });
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('validates preferences with fulfillmentTime=low', () => {
      const prefs = makePreferences({ fulfillmentTime: 'low' });
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('validates preferences with fulfillmentTime=high', () => {
      const prefs = makePreferences({ fulfillmentTime: 'high' });
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('validates preferences with all explicit fields set', () => {
      const prefs = makePreferences({
        productType: 'digital',
        fulfillmentTime: 'high',
        riskTolerance: 'low',
        sellerExperience: 'experienced',
      });
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('validates full AnalysisPayload with explicit preferences', () => {
      const payload = makePayload(
        makePreferences({ productType: 'physical', fulfillmentTime: 'medium' }),
      );
      const result = analysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('validates preferences across all 7 markets', () => {
      const markets = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'] as const;
      for (const marketId of markets) {
        const market: MarketContext = {
          marketId,
          language: 'en',
          currency: 'USD',
          platforms: [],
        };
        const prefs = makePreferences({ market, productType: 'physical', fulfillmentTime: 'low' });
        const result = userPreferencesSchema.safeParse(prefs);
        expect(result.success, `market ${marketId} should be valid`).toBe(true);
      }
    });
  });

  // AC-3: Removed fields (targetPlatforms, categories) are simply absent
  describe('AC-3: removed v1 fields accepted when absent', () => {
    it('v2 preferences without targetPlatforms validates', () => {
      const prefs = makePreferences();
      // Verify the field does not exist on the v2 interface shape
      expect('targetPlatforms' in prefs).toBe(false);
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('v2 preferences without categories validates', () => {
      const prefs = makePreferences();
      expect('categories' in prefs).toBe(false);
      const result = userPreferencesSchema.safeParse(prefs);
      expect(result.success).toBe(true);
    });

    it('extra unknown fields are stripped by strict schema', () => {
      const prefsWith = {
        ...makePreferences(),
        targetPlatforms: ['amazon-us'],
        categories: ['electronics'],
      };
      // Zod default: extra fields pass .safeParse but are stripped by .strict()
      const strictSchema = userPreferencesSchema.strict();
      const result = strictSchema.safeParse(prefsWith);
      expect(result.success).toBe(false); // strict rejects unknown keys
    });
  });

  // AC-4: Invalid types rejected
  describe('AC-4: invalid types rejected', () => {
    it('rejects invalid riskTolerance value', () => {
      const result = userPreferencesSchema.safeParse({
        ...makePreferences(),
        riskTolerance: 'extreme',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid productType value', () => {
      const result = userPreferencesSchema.safeParse({
        ...makePreferences(),
        productType: 'service',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid fulfillmentTime value', () => {
      const result = userPreferencesSchema.safeParse({
        ...makePreferences(),
        fulfillmentTime: 'ultra',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid sellerExperience value', () => {
      const result = userPreferencesSchema.safeParse({
        ...makePreferences(),
        sellerExperience: 'expert',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric budget min', () => {
      const result = userPreferencesSchema.safeParse({
        ...makePreferences(),
        budget: { min: 'free', max: 500, currency: 'USD' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid market ID', () => {
      const result = userPreferencesSchema.safeParse({
        ...makePreferences(),
        market: { ...usMarket, marketId: 'xx' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = userPreferencesSchema.safeParse({
        market: usMarket,
        // missing budget, riskTolerance, sellerExperience
      });
      expect(result.success).toBe(false);
    });

    it('rejects null payload', () => {
      const result = userPreferencesSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });
});
