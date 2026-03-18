/**
 * calc_margin — Deterministic margin calculation tool (P3).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import type { Tool, CalcMarginInput, MarginResult } from './types.js';

function clampZero(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function calcMarginExecute(input: CalcMarginInput): MarginResult {
  const { sellPrice, cogs, platformFeePercent, shipping, currency } = input;

  if (sellPrice <= 0) {
    return {
      grossMarginPercent: 0,
      netMarginPercent: 0,
      profitPerUnit: 0,
      currency,
      error: 'sellPrice must be positive',
    };
  }

  const safeCogs = Math.max(0, cogs);
  const safeShipping = Math.max(0, shipping);
  const safeFee = Math.max(0, Math.min(1, platformFeePercent));

  const platformFee = sellPrice * safeFee;
  const totalCost = safeCogs + safeShipping + platformFee;
  const profit = sellPrice - totalCost;

  const grossMarginPercent = clampZero((sellPrice - safeCogs) / sellPrice);
  const netMarginPercent = clampZero(profit / sellPrice);
  const profitPerUnit = clampZero(profit);

  return {
    grossMarginPercent: Math.round(grossMarginPercent * 10000) / 10000,
    netMarginPercent: Math.round(netMarginPercent * 10000) / 10000,
    profitPerUnit: Math.round(profitPerUnit * 100) / 100,
    currency,
  };
}

export const calcMargin: Tool<CalcMarginInput, MarginResult> = {
  name: 'calc_margin',
  description: 'Calculate gross margin %, net margin %, and profit per unit in local currency given sell price, COGS, platform fees, and shipping.',
  execute: calcMarginExecute,
};
