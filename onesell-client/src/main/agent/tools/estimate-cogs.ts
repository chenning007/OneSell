/**
 * estimate_cogs — Estimate cost of goods sold with currency conversion (P3).
 * Relocated from onesell-backend for v2 client-only architecture.
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
