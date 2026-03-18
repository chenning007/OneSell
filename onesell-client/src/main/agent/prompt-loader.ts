/**
 * Prompt Loader — Loads and validates market-specific system prompts (P4, P9).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import type { MarketContext } from './tools/types.js';
import { getPlannerPrompt } from './prompts/planner.js';
import { getExecutorPrompt } from './prompts/executor.js';
import { getSynthesizerPrompt } from './prompts/synthesizer.js';

// ── Types ───────────────────────────────────────────────────────────

export interface AgentPrompts {
  readonly planner: string;
  readonly executor: string;
  readonly synthesizer: string;
}

// ── Anti-injection sanitization (P9) ────────────────────────────────

const INJECTION_PATTERNS = [
  /\bsystem\s*:\s*/gi,
  /\bignore\s+(previous|above|all)\s+instructions?\b/gi,
  /\byou\s+are\s+now\b/gi,
  /\bforget\s+(everything|all|your)\b/gi,
  /\bnew\s+instructions?\s*:/gi,
  /\boverride\s*:/gi,
  /\b(act|behave)\s+as\b/gi,
  /```system\b/gi,
  /<\|im_start\|>system/gi,
  /<system>/gi,
];

export function sanitizeUserInput(input: string): string {
  let sanitized = input;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }
  return sanitized;
}

// ── Loader ──────────────────────────────────────────────────────────

export function loadPrompts(market: MarketContext): AgentPrompts {
  const planner = getPlannerPrompt(market);
  const executor = getExecutorPrompt(market);
  const synthesizer = getSynthesizerPrompt(market);

  if (!planner || typeof planner !== 'string') {
    throw new Error(`Planner prompt is empty for market: ${market.marketId}`);
  }
  if (!executor || typeof executor !== 'string') {
    throw new Error(`Executor prompt is empty for market: ${market.marketId}`);
  }
  if (!synthesizer || typeof synthesizer !== 'string') {
    throw new Error(`Synthesizer prompt is empty for market: ${market.marketId}`);
  }

  return { planner, executor, synthesizer };
}
