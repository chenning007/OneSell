# Extraction Module Interface

**Version**: 1.0.0  
**Status**: Accepted  
**Date**: 2026-03-15  
**Author**: Architect  
**Linked Issue**: #6  
**Depends on**: ADR-001 (#3)

---

## Purpose

This document defines the contract that every platform extraction module must satisfy. It covers:

1. The TypeScript interface that all extraction scripts must implement
2. The versioning strategy for extraction scripts
3. The graceful degradation contract
4. The registry pattern for loading scripts
5. The per-platform module directory structure

All developers implementing or updating extraction scripts must follow this contract. Deviations require an updated ADR — not an inline exception.

---

## 1. Core TypeScript Interface

```typescript
// File: packages/extraction/src/types.ts
// This is the canonical interface. All extraction scripts must implement it.

/**
 * A single normalised product record extracted from one platform listing.
 * Every field that cannot be reliably extracted must be null — never
 * undefined, never a fallback string like "N/A".
 */
export interface ProductRecord {
  id: string;                        // platform-native listing/product ID
  title: string;
  price: number;                     // in the platform's displayed currency
  currency: string;                  // ISO 4217
  sales30d: number | null;           // units sold in last 30 days
  reviewCount: number | null;
  reviewRating: number | null;       // 0.0 – 5.0
  category: string | null;
  subcategory: string | null;
  sellerType: 'brand' | 'reseller' | 'factory' | 'unknown';
  listingAge: number | null;         // calendar days since first listed
  imageUrl: string | null;           // HTTPS URL; used in Renderer only
  productUrl: string | null;         // HTTPS URL; stored for reference
  extraFields: Record<string, unknown>; // platform-specific raw metadata
}

/**
 * Aggregated category-level statistics collected from search results pages.
 * Null values mean the information was not available on the page.
 */
export interface CategoryStats {
  topKeywords: string[];             // up to 10 related keywords shown on platform
  avgPrice: number | null;
  avgSales30d: number | null;
  totalListings: number | null;
}

/**
 * Describes a page-level error encountered during extraction.
 * Non-fatal errors are logged here instead of throwing.
 * recoverable = true means the caller may retry the same URL.
 */
export interface ExtractionError {
  page: string;                      // URL or logical page name
  error: string;
  recoverable: boolean;
}

/**
 * The complete output of a single extraction run against one platform.
 */
export interface ExtractionResult {
  platform: string;                  // must match ExtractionScript.platform
  extractedAt: string;               // ISO 8601 timestamp
  scriptVersion: string;             // semver — propagated to AnalysisPayload
  products: ProductRecord[];
  categoryStats: CategoryStats;
  extractionErrors: ExtractionError[];
}

/**
 * ExtractionContext is injected by ExtractionManager when invoking a script.
 * Scripts MUST NOT read from any other source — no window globals, no IPC.
 */
export interface ExtractionContext {
  keyword: string;
  market: string;
  maxProducts: number;               // configured maximum per platform (default: 100)
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * The primary interface all extraction scripts must implement.
 *
 * Lifecycle:
 *   ExtractionManager calls canHandle() first.
 *   If true, it calls extractFromPage().
 *   extractFromPage() is the script's only entry point for DOM interaction.
 *
 * The BrowserView context is provided by ExtractionManager via webContents;
 * scripts do not directly reference Electron APIs.
 */
export interface ExtractionScript {
  /**
   * Stable platform identifier. Must match a value in the platforms registry.
   * Example: 'amazon', 'shopee', 'taobao'
   */
  platform: string;

  /**
   * Semver version of this extraction script.
   * Increment on ANY change to DOM selectors, page navigation logic,
   * or output field mapping. Never decrement.
   */
  version: string;

  /**
   * List of URL patterns this script handles.
   * ExtractionManager uses these to route page loads.
   * Example: ['amazon.com/s?', 'amazon.co.uk/s?']
   */
  urlPatterns: string[];

  /**
   * Returns true if this script can process the given URL.
   * Called before extractFromPage — must be synchronous and cheap.
   * Must NOT interact with the DOM.
   */
  canHandle(url: string): boolean;

  /**
   * Main extraction entry point. Called once per target page load.
   *
   * MUST return null (not throw) when:
   *  - The page structure is unrecognised
   *  - The user is not logged in and the data is paywalled
   *  - No products appear on the page (empty search results)
   *
   * MUST throw only for unrecoverable programming errors (e.g. missing
   * required context field injected by ExtractionManager).
   *
   * Any caught DOM errors should be appended to the returned
   * ExtractionResult.extractionErrors array, not thrown.
   *
   * @param document - The live DOM Document of the loaded page
   * @param context  - Injected parameters from ExtractionManager
   * @returns ExtractionResult on success, null on unrecognised page
   */
  extractFromPage(
    document: Document,
    context: ExtractionContext
  ): Promise<ExtractionResult | null>;

  /**
   * Called by ExtractionManager to normalise a raw ProductRecord extracted
   * from this platform into the canonical shape.
   *
   * Implementations should:
   *  - Convert prices to numbers (strip currency symbols)
   *  - Normalise sellerType to the canonical enum
   *  - Default unknown optional fields to null (not zero, not empty string)
   *
   * @param raw - Raw data object from the DOM traversal
   * @returns Normalised ProductRecord
   */
  normalizeProduct(raw: Record<string, unknown>): ProductRecord;
}
```

---

## 2. Versioning Strategy

### 2.1 Semver Rules

Each script carries its own `version` field following semver (`MAJOR.MINOR.PATCH`):

| Change type | Bump |
|---|---|
| Any DOM selector change | PATCH |
| New optional field added to `extraFields` | PATCH |
| New field added to `ProductRecord` (optional) | MINOR |
| Any change to `extractFromPage` output structure or existing field semantics | MAJOR |
| Script deleted / platform removed | MAJOR (deprecation notice first) |

The `version` value from the script is propagated verbatim into `ExtractionResult.scriptVersion`, which flows into `AnalysisPayload.extractedData[].scriptVersion`. This lets the backend correlate backend analysis requests with the exact script version that produced the data.

### 2.2 Version Compatibility Check

At startup, `ExtractionManager` compares each loaded script version against the minimum version declared in `market-config.json`. Example:

```json
{
  "platform": "amazon",
  "minimumScriptVersion": "1.2.0"
}
```

If a loaded script's `version` is below the minimum, `ExtractionManager` refuses to run it and surfaces a UI warning prompting the user to update the app. This prevents silent data quality degradation after a platform UI change.

### 2.3 Version History (per script)

Each script file carries a version history comment block at the top:

```typescript
/**
 * Amazon extraction script
 * @version 1.3.0
 *
 * Changelog:
 *   1.3.0 — 2026-03-10: Updated search results selector after Amazon March UI change
 *   1.2.1 — 2026-02-01: Fixed price parser for 'From $X.XX' format
 *   1.2.0 — 2026-01-15: Added listingAge extraction from badge text
 *   1.1.0 — 2026-01-01: Added sellerType detection from 'Ships from and sold by' text
 *   1.0.0 — 2025-12-01: Initial release
 */
```

---

## 3. Graceful Degradation Contract

These rules are mandatory. Violations will be caught in code review.

### 3.1 Return null on unrecognised pages

`extractFromPage` MUST return `null` (not throw, not return empty) when:

- The DOM structure does not match expected selectors
- Login is required and the page shows a login wall
- The search produced zero results (empty SERP)
- The page is a CAPTCHA or bot-detection page

`ExtractionManager` handles `null` by logging a warning and recording it in `extractionErrors` for that platform. The overall extraction session continues with other platforms.

### 3.2 Isolate per-product errors

If extracting a single product card fails (e.g. a malformed listing), the error MUST be caught and appended to `ExtractionResult.extractionErrors`. The script continues processing remaining products.

```typescript
// Correct pattern:
const products: ProductRecord[] = [];
for (const row of productRows) {
  try {
    products.push(this.normalizeProduct(parseRow(row)));
  } catch (err) {
    context.logger.warn(`Failed to parse product row: ${err}`);
    result.extractionErrors.push({
      page: document.URL,
      error: String(err),
      recoverable: false,
    });
  }
}
```

### 3.3 Never throw network or navigation errors

Scripts do not control navigation — that is `ExtractionManager`'s responsibility. If a DOM query unexpectedly returns null due to a race condition, the script should treat it as an unrecognised page and return `null`.

### 3.4 Partial results are valid

A script completing with 0 products and 5 errors in `extractionErrors` is a valid result. The backend agent handles sparse data gracefully — it will simply have less to work with for that platform.

### 3.5 No side effects

Scripts MUST NOT:

- Submit forms
- Click buttons (except pagination if the interface requires it and it is explicitly scoped)
- Store cookies or localStorage values
- Make XHR or fetch calls
- Modify the DOM beyond necessary for reading

---

## 4. ExtractionScriptRegistry

`ExtractionManager` loads scripts via a registry. The registry is a plain array of script instances — no dynamic imports, no runtime discovery.

```typescript
// File: packages/extraction/src/registry.ts

import { AmazonExtractionScript } from './scripts/amazon';
import { ShopeeExtractionScript } from './scripts/shopee';
import { LazadaExtractionScript } from './scripts/lazada';
import { TiktokShopExtractionScript } from './scripts/tiktokshop';
import { TaobaoExtractionScript } from './scripts/taobao';
import { TmallExtractionScript } from './scripts/tmall';
import { JDExtractionScript } from './scripts/jd';
import { EbayExtractionScript } from './scripts/ebay';
import { RakutenExtractionScript } from './scripts/rakuten';
import type { ExtractionScript } from './types';

export const EXTRACTION_REGISTRY: ExtractionScript[] = [
  new AmazonExtractionScript(),
  new ShopeeExtractionScript(),
  new LazadaExtractionScript(),
  new TiktokShopExtractionScript(),
  new TaobaoExtractionScript(),
  new TmallExtractionScript(),
  new JDExtractionScript(),
  new EbayExtractionScript(),
  new RakutenExtractionScript(),
];
```

`ExtractionManager` selects the correct script for each page load by calling `canHandle(url)` on each registered script and using the first match.

### Adding a new platform

1. Create `packages/extraction/src/scripts/<platform>.ts` implementing `ExtractionScript`
2. Write unit tests in `packages/extraction/tests/scripts/<platform>.test.ts`
3. Register the new script in `registry.ts`
4. Add the platform to `market-config.json` with `minimumScriptVersion: "1.0.0"`
5. Update the `AnalysisPayload` JSON schema supported platforms list (see `api-contract.md`)

---

## 5. Directory Structure

```
packages/
  extraction/
    src/
      types.ts                  ← ExtractionScript interface (this document)
      registry.ts               ← EXTRACTION_REGISTRY array
      ExtractionManager.ts      ← orchestrates BrowserView + script dispatch
      scripts/
        amazon.ts               ← AmazonExtractionScript
        shopee.ts
        lazada.ts
        tiktokshop.ts
        taobao.ts
        tmall.ts
        jd.ts
        ebay.ts
        rakuten.ts
    tests/
      scripts/
        amazon.test.ts          ← unit tests using jsdom fixtures
        shopee.test.ts
        ...
      fixtures/
        amazon/
          search-us-001.html    ← DOM snapshot for regression tests
          search-us-002.html
        shopee/
          ...
```

### DOM Fixture Testing

Every extraction script must have at least one unit test using a saved DOM fixture (`*.html` snapshot). This ensures a DOM change on a live platform triggers a test failure before the script is shipped. When a platform changes its UI:

1. Developer captures new HTML snapshot and adds it to `fixtures/`
2. Updates the failing test to use the new snapshot
3. Updates the script selectors
4. Bumps the script version (PATCH at minimum)
5. Updates the changelog comment block

---

## 6. ExtractionManager Responsibilities (for context)

The `ExtractionManager` is not part of the script contract, but developers need to understand what it provides:

| Responsibility | Where |
|---|---|
| Load the BrowserView with a platform URL | ExtractionManager |
| Inject `ExtractionContext` before calling `extractFromPage` | ExtractionManager |
| Call `canHandle()` to route page loads to the correct script | ExtractionManager |
| Retry on `ExtractionResult.extractionErrors[].recoverable === true` (max 2 retries) | ExtractionManager |
| Enforce per-platform timeout (30s per page) | ExtractionManager |
| Aggregate results from all platforms into a single `AnalysisPayload` | ExtractionManager |
| Send progress events via IPC to the Renderer | ExtractionManager |
| Version-check loaded scripts against `minimumScriptVersion` | ExtractionManager |

Scripts must not duplicate any of this logic.
