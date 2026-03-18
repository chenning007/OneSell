/**
 * get_platform_fees — Return platform fee structure by platform and market (P3, P4, P8).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import type { Tool, GetPlatformFeesInput, PlatformFeesResult } from './types.js';

interface PlatformFeeConfig {
  readonly commissionPercent: number;
  readonly listingFee: number;
  readonly paymentProcessingPercent: number;
  readonly notes: string;
}

const PLATFORM_FEES: Record<string, PlatformFeeConfig> = {
  'amazon-us': {
    commissionPercent: 0.15,
    listingFee: 0,
    paymentProcessingPercent: 0,
    notes: 'Referral fee varies 8–15% by category; payment processing included in referral fee.',
  },
  'ebay-us': {
    commissionPercent: 0.1292,
    listingFee: 0.35,
    paymentProcessingPercent: 0.029,
    notes: 'Final value fee ~12.92%; insertion fee $0.35 after 250 free listings; payment processing ~2.9%.',
  },
  'etsy': {
    commissionPercent: 0.065,
    listingFee: 0.20,
    paymentProcessingPercent: 0.03,
    notes: 'Transaction fee 6.5%; listing fee $0.20 per item; payment processing ~3% + $0.25.',
  },
  'tiktok-shop-us': {
    commissionPercent: 0.05,
    listingFee: 0,
    paymentProcessingPercent: 0.01,
    notes: 'Commission ~5%; new seller incentives may apply; payment processing ~1%.',
  },
  'alibaba': {
    commissionPercent: 0,
    listingFee: 0,
    paymentProcessingPercent: 0,
    notes: 'B2B platform — no per-transaction commission; annual membership fee applies separately.',
  },
  'google-trends': {
    commissionPercent: 0,
    listingFee: 0,
    paymentProcessingPercent: 0,
    notes: 'Data source only — no selling fees.',
  },
  'taobao': {
    commissionPercent: 0.01,
    listingFee: 0,
    paymentProcessingPercent: 0.006,
    notes: 'Technical service fee ~1%; Alipay processing ~0.6%.',
  },
  'jd': {
    commissionPercent: 0.08,
    listingFee: 0,
    paymentProcessingPercent: 0.006,
    notes: 'Commission 5–10% by category; platform usage fee varies; payment processing ~0.6%.',
  },
  'pinduoduo': {
    commissionPercent: 0.006,
    listingFee: 0,
    paymentProcessingPercent: 0.006,
    notes: 'Technical service fee ~0.6%; payment processing ~0.6%; very low-fee platform.',
  },
};

function getPlatformFeesExecute(input: GetPlatformFeesInput): PlatformFeesResult {
  const { platformId, market } = input;
  const currency = market?.currency ?? 'USD';
  const id = (platformId ?? '').toLowerCase();

  const config = PLATFORM_FEES[id];

  if (!config) {
    return {
      platformId: platformId ?? '',
      commissionPercent: 0,
      listingFee: 0,
      paymentProcessingPercent: 0,
      currency,
      notes: 'Unknown platform — fees not available',
    };
  }

  return {
    platformId: platformId ?? '',
    commissionPercent: config.commissionPercent,
    listingFee: config.listingFee,
    paymentProcessingPercent: config.paymentProcessingPercent,
    currency,
    notes: config.notes,
  };
}

export const getPlatformFees: Tool<GetPlatformFeesInput, PlatformFeesResult> = {
  name: 'get_platform_fees',
  description: 'Return the platform fee structure (commission, listing fee, payment processing) for a given platform and market.',
  execute: getPlatformFeesExecute,
};
