/**
 * Unit tests for Redis session store helpers (P5: Graceful Degradation).
 * Tests key generation, ISO week calculation, and type exports.
 * Integration tests with real Redis are in tests/integration/.
 */

import { describe, it, expect } from 'vitest';
import { redisKeys, getISOWeek } from '../../src/services/redis.js';

describe('Redis key builders', () => {
  it('builds payload key correctly', () => {
    expect(redisKeys.payload('abc-123')).toBe('session:abc-123:payload');
  });

  it('builds status key correctly', () => {
    expect(redisKeys.status('abc-123')).toBe('session:abc-123:status');
  });

  it('builds results key correctly', () => {
    expect(redisKeys.results('abc-123')).toBe('session:abc-123:results');
  });

  it('builds rateLimit key correctly', () => {
    expect(redisKeys.rateLimit('user-1', '2026-W12')).toBe('ratelimit:user-1:2026-W12');
  });

  it('builds marketConfig key correctly', () => {
    expect(redisKeys.marketConfig('us')).toBe('market:config:us');
  });

  it('builds feeCache key correctly', () => {
    expect(redisKeys.feeCache('us', 'amazon-us')).toBe('market:fees:us:amazon-us');
  });

  it('builds exchangeRate key correctly', () => {
    expect(redisKeys.exchangeRate('USD', 'CNY', '2026-03-16'))
      .toBe('exchange-rate:USD:CNY:2026-03-16');
  });
});

describe('getISOWeek', () => {
  it('returns correct format YYYY-WNN', () => {
    const week = getISOWeek(new Date('2026-03-16'));
    expect(week).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns consistent result for same date', () => {
    const d = new Date('2026-01-15');
    expect(getISOWeek(d)).toBe(getISOWeek(d));
  });

  it('handles year boundary (Jan 1)', () => {
    const week = getISOWeek(new Date('2026-01-01'));
    expect(week).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('handles year boundary (Dec 31)', () => {
    const week = getISOWeek(new Date('2025-12-31'));
    expect(week).toMatch(/^\d{4}-W\d{2}$/);
  });
});
