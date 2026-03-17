/**
 * ToolRegistry — Registers all agent tool functions and generates
 * OpenAI function-calling compatible schemas (P3, P9).
 *
 * Pure tool functions are wrapped to validate input via Zod before execution.
 *
 * Closes #122
 */

import { z, type ZodType } from 'zod';
import type { Tool } from './tools/types.js';
import { calcMargin } from './tools/calc-margin.js';
import { rankCompetition } from './tools/rank-competition.js';
import { scoreTrend } from './tools/score-trend.js';
import { flagBeginnerRisk } from './tools/flag-beginner-risk.js';
import { compareProducts } from './tools/compare-products.js';
import { estimateCOGS } from './tools/estimate-cogs.js';
import { getPlatformFees } from './tools/get-platform-fees.js';

// ── Types ───────────────────────────────────────────────────────────

export interface RegisteredTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType;
  readonly execute: (input: unknown) => unknown;
}

export interface FunctionSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

// ── Zod schemas for each tool (P9: validate at boundary) ────────────

const marketIdSchema = z.enum(['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au']);

const marketContextSchema = z.object({
  marketId: marketIdSchema,
  language: z.string(),
  currency: z.string(),
  platforms: z.array(z.string()),
});

const calcMarginInputSchema = z.object({
  sellPrice: z.number(),
  cogs: z.number(),
  platformFeePercent: z.number(),
  shipping: z.number(),
  market: marketIdSchema,
  currency: z.string(),
});

const rankCompetitionInputSchema = z.object({
  listings: z.array(z.object({
    reviewCount: z.number(),
    sellerAge: z.number().optional(),
    salesVolume: z.number().optional(),
  })),
  market: marketIdSchema,
});

const scoreTrendInputSchema = z.object({
  timeSeries: z.array(z.object({
    date: z.string(),
    value: z.number(),
  })),
  market: marketIdSchema,
});

const flagBeginnerRiskInputSchema = z.object({
  category: z.string(),
  weight: z.number().optional(),
  regulatoryKeywords: z.array(z.string()).optional(),
  market: marketContextSchema,
});

const compareProductsInputSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    marginPercent: z.number(),
    competitionScore: z.number(),
    trendScore: z.number(),
    riskLevel: z.string(),
  })),
});

const estimateCOGSInputSchema = z.object({
  unitCostUSD: z.number(),
  shippingCostUSD: z.number().optional(),
  quantity: z.number().optional(),
  targetCurrency: z.string(),
  exchangeRates: z.record(z.string(), z.number()),
});

const getPlatformFeesInputSchema = z.object({
  platformId: z.string(),
  market: marketContextSchema,
});

// ── Registry ────────────────────────────────────────────────────────

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor() {
    this.registerDefaults();
  }

  /** Register a tool with input validation wrapper. */
  register(
    name: string,
    fn: (input: unknown) => unknown,
    inputSchema: ZodType,
    description: string,
  ): void {
    const validatedFn = (input: unknown): unknown => {
      const parsed = inputSchema.parse(input);
      return fn(parsed);
    };

    this.tools.set(name, {
      name,
      description,
      inputSchema,
      execute: validatedFn,
    });
  }

  /** Resolve a tool by name. Throws if not found. */
  resolve(name: string): RegisteredTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool;
  }

  /** Return all registered tools. */
  getAll(): readonly RegisteredTool[] {
    return [...this.tools.values()];
  }

  /**
   * Generate OpenAI function-calling compatible schema for all tools.
   * Each entry has: name, description, parameters (JSON Schema object).
   */
  generateSchema(): readonly FunctionSchema[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema),
    }));
  }

  // ── Default registrations ──────────────────────────────────────────

  private registerDefaults(): void {
    this.registerTool(calcMargin, calcMarginInputSchema);
    this.registerTool(rankCompetition, rankCompetitionInputSchema);
    this.registerTool(scoreTrend, scoreTrendInputSchema);
    this.registerTool(flagBeginnerRisk, flagBeginnerRiskInputSchema);
    this.registerTool(compareProducts, compareProductsInputSchema);
    this.registerTool(estimateCOGS, estimateCOGSInputSchema);
    this.registerTool(getPlatformFees, getPlatformFeesInputSchema);
  }

  private registerTool<TIn, TOut>(tool: Tool<TIn, TOut>, schema: ZodType): void {
    this.register(tool.name, tool.execute as (input: unknown) => unknown, schema, tool.description);
  }
}

// ── Zod → JSON Schema (minimal converter for function-calling) ──────

function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  // Use Zod's internal description to build a minimal JSON Schema.
  // This handles the shapes we actually use (objects, arrays, enums, primitives).
  return convertZod(schema);
}

function convertZod(schema: ZodType): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldDef = (value as unknown as { _def: Record<string, unknown> })._def;
        if (fieldDef.typeName === 'ZodOptional') {
          properties[key] = convertZod(fieldDef.innerType as ZodType);
        } else {
          properties[key] = convertZod(value as ZodType);
          required.push(key);
        }
      }

      return { type: 'object', properties, required };
    }

    case 'ZodArray':
      return { type: 'array', items: convertZod(def.type as ZodType) };

    case 'ZodString':
      return { type: 'string' };

    case 'ZodNumber':
      return { type: 'number' };

    case 'ZodEnum':
      return { type: 'string', enum: (def.values as string[]) };

    case 'ZodRecord':
      return {
        type: 'object',
        additionalProperties: convertZod(def.valueType as ZodType),
      };

    case 'ZodOptional':
      return convertZod(def.innerType as ZodType);

    default:
      return {};
  }
}
