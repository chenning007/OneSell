/**
 * MarketContext — immutable session parameter (Architectural Principle P4)
 *
 * Created once at wizard Step 1. Flows as a readonly parameter through every
 * component, prompt, tool call, UI element, and output within the session.
 * No component may assume a default market or mutate this object.
 * Market switching resets the entire session.
 *
 * See docs/ARCHITECTURE.md §4.3
 */
export interface MarketContext {
  readonly marketId: 'us' | 'cn' | 'uk' | 'de' | 'jp' | 'sea' | 'au';
  readonly language: string;  // BCP-47 language tag, e.g. 'en-US', 'zh-CN'
  readonly currency: string;  // ISO 4217 currency code, e.g. 'USD', 'CNY'
  readonly platforms: readonly string[]; // Available platformIds for this market
}
