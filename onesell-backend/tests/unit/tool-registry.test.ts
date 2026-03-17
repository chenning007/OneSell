/**
 * Unit tests for ToolRegistry (#122).
 * Covers: register, resolve, getAll, schema generation, unknown tool, input validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../src/services/agent/tool-registry.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // ── Auto-registration ─────────────────────────────────────────────

  it('auto-registers all 7 tools on construction', () => {
    const all = registry.getAll();
    expect(all).toHaveLength(7);

    const names = all.map(t => t.name);
    expect(names).toContain('calc_margin');
    expect(names).toContain('rank_competition');
    expect(names).toContain('score_trend');
    expect(names).toContain('flag_beginner_risk');
    expect(names).toContain('compare_products');
    expect(names).toContain('estimate_cogs');
    expect(names).toContain('get_platform_fees');
  });

  // ── resolve ───────────────────────────────────────────────────────

  it('resolves a registered tool by name', () => {
    const tool = registry.resolve('calc_margin');
    expect(tool.name).toBe('calc_margin');
    expect(tool.description).toBeTruthy();
    expect(typeof tool.execute).toBe('function');
  });

  it('throws for unknown tool name', () => {
    expect(() => registry.resolve('nonexistent_tool')).toThrow('Unknown tool: nonexistent_tool');
  });

  // ── register custom tool ──────────────────────────────────────────

  it('registers a custom tool and resolves it', () => {
    const schema = z.object({ value: z.number() });
    registry.register('custom_tool', (input) => input, schema, 'A custom tool');

    const tool = registry.resolve('custom_tool');
    expect(tool.name).toBe('custom_tool');
    expect(tool.description).toBe('A custom tool');
    expect(registry.getAll()).toHaveLength(8); // 7 defaults + 1 custom
  });

  // ── Input validation (P9) ─────────────────────────────────────────

  it('validates input before executing tool', () => {
    const tool = registry.resolve('calc_margin');
    const result = tool.execute({
      sellPrice: 30,
      cogs: 7,
      platformFeePercent: 0.15,
      shipping: 5,
      market: 'us',
      currency: 'USD',
    });
    expect(result).toHaveProperty('grossMarginPercent');
    expect(result).toHaveProperty('profitPerUnit');
  });

  it('rejects invalid input with Zod error', () => {
    const tool = registry.resolve('calc_margin');
    expect(() => tool.execute({ sellPrice: 'not_a_number' })).toThrow();
  });

  it('rejects invalid market ID', () => {
    const tool = registry.resolve('calc_margin');
    expect(() =>
      tool.execute({
        sellPrice: 30,
        cogs: 7,
        platformFeePercent: 0.15,
        shipping: 5,
        market: 'invalid_market',
        currency: 'USD',
      }),
    ).toThrow();
  });

  // ── Tool execution via registry ───────────────────────────────────

  it('executes rank_competition through registry', () => {
    const tool = registry.resolve('rank_competition');
    const result = tool.execute({
      listings: [{ reviewCount: 100 }, { reviewCount: 200 }],
      market: 'us',
    }) as { score: number; narrative: string };
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.narrative).toBeTruthy();
  });

  it('executes compare_products through registry', () => {
    const tool = registry.resolve('compare_products');
    const result = tool.execute({
      products: [
        { name: 'A', marginPercent: 40, competitionScore: 70, trendScore: 60, riskLevel: 'SAFE' },
        { name: 'B', marginPercent: 30, competitionScore: 50, trendScore: 80, riskLevel: 'FLAGGED' },
      ],
    }) as { ranked: Array<{ name: string; rank: number }> };
    expect(result.ranked).toHaveLength(2);
    expect(result.ranked[0].rank).toBe(1);
  });

  // ── generateSchema ────────────────────────────────────────────────

  it('generates OpenAI function-calling compatible schema for all tools', () => {
    const schemas = registry.generateSchema();
    expect(schemas).toHaveLength(7);

    for (const s of schemas) {
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.parameters).toBeDefined();
      expect(s.parameters).toHaveProperty('type', 'object');
      expect(s.parameters).toHaveProperty('properties');
    }
  });

  it('schema includes correct parameter types', () => {
    const schemas = registry.generateSchema();
    const calcSchema = schemas.find(s => s.name === 'calc_margin');
    expect(calcSchema).toBeDefined();

    const params = calcSchema!.parameters as {
      type: string;
      properties: Record<string, { type: string }>;
      required: string[];
    };
    expect(params.properties.sellPrice).toEqual({ type: 'number' });
    expect(params.properties.market).toHaveProperty('enum');
    expect(params.required).toContain('sellPrice');
    expect(params.required).toContain('cogs');
  });

  it('schema handles array and nested object types', () => {
    const schemas = registry.generateSchema();
    const rankSchema = schemas.find(s => s.name === 'rank_competition');
    expect(rankSchema).toBeDefined();

    const params = rankSchema!.parameters as {
      properties: Record<string, { type: string; items?: Record<string, unknown> }>;
    };
    expect(params.properties.listings.type).toBe('array');
    expect(params.properties.listings.items).toHaveProperty('type', 'object');
  });

  it('schema handles record types for exchangeRates', () => {
    const schemas = registry.generateSchema();
    const cogsSchema = schemas.find(s => s.name === 'estimate_cogs');
    expect(cogsSchema).toBeDefined();

    const params = cogsSchema!.parameters as {
      properties: Record<string, { type: string; additionalProperties?: Record<string, unknown> }>;
    };
    expect(params.properties.exchangeRates.type).toBe('object');
    expect(params.properties.exchangeRates.additionalProperties).toEqual({ type: 'number' });
  });

  // ── getAll returns copies ─────────────────────────────────────────

  it('getAll returns all tools with metadata', () => {
    const all = registry.getAll();
    for (const tool of all) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(typeof tool.execute).toBe('function');
      expect(tool.inputSchema).toBeDefined();
    }
  });
});
