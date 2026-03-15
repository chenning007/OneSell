import type { ExtractionScript } from '../../shared/types/ExtractionScript.js';

/**
 * ExtractionScriptRegistry — plugin registry for platform extraction scripts.
 * Architectural Principle P6: ExtractionManager never knows platform internals.
 */
export class ExtractionScriptRegistry {
  private scripts = new Map<string, ExtractionScript>();

  register(script: ExtractionScript): void {
    this.scripts.set(script.platformId, script);
  }

  get(platformId: string): ExtractionScript | undefined {
    return this.scripts.get(platformId);
  }

  getAll(): ExtractionScript[] {
    return Array.from(this.scripts.values());
  }

  getForMarket(marketId: string): ExtractionScript[] {
    return this.getAll().filter((s) => s.marketId === marketId);
  }
}

/** Singleton registry — import and register platform scripts against this. */
export const registry = new ExtractionScriptRegistry();
