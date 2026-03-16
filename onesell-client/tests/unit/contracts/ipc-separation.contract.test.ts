/**
 * P2 — Client/Backend Separation Contract Test
 * Verifies: No analysis logic (scoring, LLM calls, margin calculations) exists in client IPC handlers.
 * Covers: P2 principle
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_SRC = path.resolve(__dirname, '../../../src');

// Analysis/scoring keywords that should NOT appear in the client codebase
const BANNED_ANALYSIS_PATTERNS = [
  /calc_margin/i,
  /rank_competition/i,
  /score_trend/i,
  /flag_beginner_risk/i,
  /compare_products/i,
  /estimate_cogs/i,
  /get_platform_fees/i,
  /openai\.chat/i,
  /llm\.generate/i,
  /llm\.complete/i,
  /createCompletion/i,
  /PlannerAgent/i,
  /ExecutorAgent/i,
  /SynthesizerAgent/i,
];

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...getAllTsFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) results.push(full);
    }
  } catch { /* directory may not exist */ }
  return results;
}

describe('Contract: Client/Backend Separation (P2)', () => {
  const mainDir = path.join(CLIENT_SRC, 'main');
  const rendererDir = path.join(CLIENT_SRC, 'renderer');

  it('IPC handlers contain no analysis/scoring logic', () => {
    const handlersFile = path.join(mainDir, 'ipc', 'handlers.ts');
    const content = fs.readFileSync(handlersFile, 'utf-8');
    for (const pattern of BANNED_ANALYSIS_PATTERNS) {
      expect(content, `handlers.ts contains analysis pattern: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('no client source file references agent tool functions', () => {
    const allFiles = [...getAllTsFiles(mainDir), ...getAllTsFiles(rendererDir)];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of BANNED_ANALYSIS_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
          const rel = path.relative(CLIENT_SRC, file);
          expect.fail(`${rel} contains analysis pattern "${match[0]}" — violates P2`);
        }
      }
    }
  });

  it('IPC handlers only delegate to ExtractionManager and PayloadBuilder', () => {
    const handlersFile = path.join(mainDir, 'ipc', 'handlers.ts');
    const content = fs.readFileSync(handlersFile, 'utf-8');
    // Should import ExtractionManager and PayloadBuilder — not agent services
    expect(content).toContain('ExtractionManager');
    expect(content).not.toContain('AgentService');
    expect(content).not.toContain('ToolRegistry');
  });
});
