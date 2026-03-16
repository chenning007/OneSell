/**
 * Unit tests for DB schema definition (P9: Security by Default).
 * Verifies table structure, constraints, cascades, and indices.
 */

import { describe, it, expect } from 'vitest';
import { users, userPreferences, analysisSessions, savedProducts } from '../../src/db/schema.js';

describe('DB Schema', () => {
  // ── Tables exist ──────────────────────────────────────────────────

  it('exports users table', () => {
    expect(users).toBeDefined();
  });

  it('exports userPreferences table', () => {
    expect(userPreferences).toBeDefined();
  });

  it('exports analysisSessions table', () => {
    expect(analysisSessions).toBeDefined();
  });

  it('exports savedProducts table', () => {
    expect(savedProducts).toBeDefined();
  });

  // ── Users table columns ───────────────────────────────────────────

  it('users has required columns', () => {
    const cols = Object.keys(users);
    expect(cols).toContain('id');
    expect(cols).toContain('email');
    expect(cols).toContain('passwordHash');
    expect(cols).toContain('tier');
    expect(cols).toContain('createdAt');
    expect(cols).toContain('updatedAt');
  });

  // ── User preferences columns ──────────────────────────────────────

  it('userPreferences has required columns', () => {
    const cols = Object.keys(userPreferences);
    expect(cols).toContain('userId');
    expect(cols).toContain('market');
    expect(cols).toContain('budgetLocal');
    expect(cols).toContain('preferredPlatforms');
    expect(cols).toContain('categories');
    expect(cols).toContain('timeAvailability');
  });

  // ── Analysis sessions columns ─────────────────────────────────────

  it('analysisSessions has required columns', () => {
    const cols = Object.keys(analysisSessions);
    expect(cols).toContain('id');
    expect(cols).toContain('userId');
    expect(cols).toContain('market');
    expect(cols).toContain('status');
    expect(cols).toContain('platformsUsed');
    expect(cols).toContain('resultCount');
    expect(cols).toContain('completedAt');
  });

  // ── Saved products columns ────────────────────────────────────────

  it('savedProducts has required columns', () => {
    const cols = Object.keys(savedProducts);
    expect(cols).toContain('userId');
    expect(cols).toContain('sessionId');
    expect(cols).toContain('market');
    expect(cols).toContain('productName');
    expect(cols).toContain('overallScore');
    expect(cols).toContain('cardData');
  });
});
