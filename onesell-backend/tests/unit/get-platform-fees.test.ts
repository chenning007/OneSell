/**
 * Unit tests for get_platform_fees tool (P3, P4, P5, P8).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { getPlatformFees } from '../../src/services/agent/tools/get-platform-fees.js';
import type { MarketContext } from '../../src/services/agent/tools/types.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon-us', 'ebay-us'],
};

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['taobao', 'jd'],
};

describe('get_platform_fees', () => {
  it('has correct tool metadata', () => {
    expect(getPlatformFees.name).toBe('get_platform_fees');
    expect(getPlatformFees.description).toBeTruthy();
  });

  // ── Known platforms ───────────────────────────────────────────────

  it('returns Amazon US fees', () => {
    const r = getPlatformFees.execute({ platformId: 'amazon-us', market: usMarket });
    expect(r.platformId).toBe('amazon-us');
    expect(r.commissionPercent).toBe(0.15);
    expect(r.listingFee).toBe(0);
    expect(r.paymentProcessingPercent).toBe(0);
    expect(r.currency).toBe('USD');
    expect(r.notes).toBeTruthy();
  });

  it('returns eBay US fees', () => {
    const r = getPlatformFees.execute({ platformId: 'ebay-us', market: usMarket });
    expect(r.commissionPercent).toBe(0.1292);
    expect(r.listingFee).toBe(0.35);
    expect(r.paymentProcessingPercent).toBe(0.029);
  });

  it('returns Etsy fees', () => {
    const r = getPlatformFees.execute({ platformId: 'etsy', market: usMarket });
    expect(r.commissionPercent).toBe(0.065);
    expect(r.listingFee).toBe(0.20);
    expect(r.paymentProcessingPercent).toBe(0.03);
  });

  it('returns TikTok Shop US fees', () => {
    const r = getPlatformFees.execute({ platformId: 'tiktok-shop-us', market: usMarket });
    expect(r.commissionPercent).toBe(0.05);
    expect(r.paymentProcessingPercent).toBe(0.01);
  });

  it('returns Alibaba fees (zero)', () => {
    const r = getPlatformFees.execute({ platformId: 'alibaba', market: usMarket });
    expect(r.commissionPercent).toBe(0);
    expect(r.listingFee).toBe(0);
    expect(r.notes).toContain('B2B');
  });

  it('returns Google Trends as data source (zero fees)', () => {
    const r = getPlatformFees.execute({ platformId: 'google-trends', market: usMarket });
    expect(r.commissionPercent).toBe(0);
    expect(r.listingFee).toBe(0);
    expect(r.paymentProcessingPercent).toBe(0);
    expect(r.notes).toContain('Data source');
  });

  it('returns Taobao fees', () => {
    const r = getPlatformFees.execute({ platformId: 'taobao', market: cnMarket });
    expect(r.commissionPercent).toBe(0.01);
    expect(r.currency).toBe('CNY');
  });

  it('returns JD fees', () => {
    const r = getPlatformFees.execute({ platformId: 'jd', market: cnMarket });
    expect(r.commissionPercent).toBe(0.08);
  });

  it('returns Pinduoduo fees', () => {
    const r = getPlatformFees.execute({ platformId: 'pinduoduo', market: cnMarket });
    expect(r.commissionPercent).toBe(0.006);
  });

  // ── Currency from market ──────────────────────────────────────────

  it('returns currency from market context', () => {
    const jpMarket: MarketContext = {
      marketId: 'jp', language: 'ja-JP', currency: 'JPY', platforms: [],
    };
    const r = getPlatformFees.execute({ platformId: 'amazon-us', market: jpMarket });
    expect(r.currency).toBe('JPY');
  });

  // ── Unknown platform (P5) ─────────────────────────────────────────

  it('returns zero fees for unknown platform', () => {
    const r = getPlatformFees.execute({ platformId: 'unknown-platform', market: usMarket });
    expect(r.commissionPercent).toBe(0);
    expect(r.listingFee).toBe(0);
    expect(r.paymentProcessingPercent).toBe(0);
    expect(r.notes).toBe('Unknown platform — fees not available');
  });

  it('returns zero fees for empty platformId', () => {
    const r = getPlatformFees.execute({ platformId: '', market: usMarket });
    expect(r.commissionPercent).toBe(0);
    expect(r.notes).toBe('Unknown platform — fees not available');
  });

  // ── Case insensitivity ────────────────────────────────────────────

  it('handles mixed-case platformId', () => {
    const r = getPlatformFees.execute({ platformId: 'Amazon-US', market: usMarket });
    expect(r.commissionPercent).toBe(0.15);
  });

  it('handles uppercase platformId', () => {
    const r = getPlatformFees.execute({ platformId: 'ETSY', market: usMarket });
    expect(r.commissionPercent).toBe(0.065);
  });
});
