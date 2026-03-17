/**
 * estimate_cogs — Estimate cost of goods sold with currency conversion (P3).
 *
 * Pure function: deterministic, no side effects, no LLM involvement.
 * Calculates total and per-unit COGS in the target currency.
 *
 * Closes #118
 */

import type { Tool, EstimateCOGSInput, COGSResult } from './types.js';

function safePositive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function estimateCOGSExecute(input: EstimateCOGSInput): COGSResult {
  const { unitCostUSD, shippingCostUSD, quantity, targetCurrency, exchangeRates } = input;

  const safeUnitCost = safePositive(unitCostUSD, 0);
  const safeShipping = safePositive(shippingCostUSD, 0);
  const safeQuantity = Math.max(1, Math.round(safePositive(quantity, 1)));

  const totalUSD = (safeUnitCost + safeShipping) * safeQuantity;

  // Look up exchange rate; default to 1.0 if currency not found (P5)
  const rate = (exchangeRates && typeof exchangeRates === 'object')
    ? (Number.isFinite(exchangeRates[targetCurrency]) ? exchangeRates[targetCurrency] : 1.0)
    : 1.0;

  const totalCOGS = Math.round(totalUSD * rate * 100) / 100;
  const perUnitCOGS = Math.round((totalCOGS / safeQuantity) * 100) / 100;

  return {
    totalCOGS,
    perUnitCOGS,
    currency: targetCurrency ?? 'USD',
  };
}

export const estimateCOGS: Tool<EstimateCOGSInput, COGSResult> = {
  name: 'estimate_cogs',
  description: 'Estimate cost of goods sold including unit cost, shipping, and currency conversion for the target market.',
  execute: estimateCOGSExecute,
};
