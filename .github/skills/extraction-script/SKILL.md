# Extraction Script Development Skill

## Purpose
Guide the creation of new platform extraction scripts for OneSell Scout. Extraction scripts are isolated plugins that extract product data from e-commerce platforms. This skill ensures every new script follows the ExtractionScript interface contract and architectural principles P1, P5, P6, and P8.

## When to Use
- Implementing a new platform extraction script
- Reviewing an extraction script PR
- Debugging an extraction script that returns unexpected data
- Writing tests for extraction scripts

## Architecture Rules for Extraction Scripts

1. **P1 — No credentials**: The script runs in a BrowserView with the user already authenticated. Never capture, store, or transmit credentials, cookies, or session tokens.
2. **P5 — Graceful degradation**: If a DOM element is missing, return `null` for that field — never throw.
3. **P6 — Isolated plugin**: Each script is a self-contained module. Adding a new script requires NO changes to `ExtractionManager` or any other file except `ExtractionScriptRegistry`.
4. **P8 — Config over hardcoding**: Platform-specific selectors and patterns are constants at the top of the file, not scattered in logic.

## File Structure

```
onesell-client/src/main/extraction/scripts/[platform-id]/
  index.ts          ← implements ExtractionScript interface
```

## ExtractionScript Interface

Every script must implement:

```typescript
interface ExtractionScript {
  platformId: string;           // e.g. 'amazon-us', 'ebay-us'
  version: string;              // semver — bump on selector changes
  supportedPageTypes: string[]; // e.g. ['search-results', 'product-detail']

  detectPage(url: string, document: Document): string | null;
  // Returns page type string or null if page not recognized

  extractFromPage(pageType: string, document: Document): Record<string, unknown> | null;
  // Returns extracted data or null if extraction fails
  // MUST return null (not throw) on unrecognized pages
}
```

## Implementation Steps

1. Create `onesell-client/src/main/extraction/scripts/[platform-id]/index.ts`
2. Define URL patterns and DOM selectors as constants at the top
3. Implement `detectPage()` — match URL patterns → return page type or `null`
4. Implement `extractFromPage()` — extract data using DOM selectors → return data or `null`
5. Register in `ExtractionScriptRegistry` (import + register call only)
6. Write tests (see below)

## Test Requirements

Every extraction script needs:

1. **Valid page test** — Provide a DOM fixture matching the platform layout. Assert:
   - `detectPage()` returns the correct page type
   - `extractFromPage()` returns an object with all expected fields
   - No credential-shaped fields in output (P1 check)

2. **Unrecognized page test** — Provide a DOM fixture that does NOT match the platform. Assert:
   - `detectPage()` returns `null`
   - `extractFromPage()` returns `null` (NOT throws)

3. **Partial DOM test** — Provide a DOM fixture with some elements missing. Assert:
   - `extractFromPage()` returns a partial result or `null` (NOT throws)

Test file location: `onesell-client/tests/unit/scripts/[platform-id].test.ts`

## Common Patterns

### Safe DOM Query
```typescript
function safeText(doc: Document, selector: string): string | null {
  const el = doc.querySelector(selector);
  return el?.textContent?.trim() ?? null;
}

function safeNumber(doc: Document, selector: string): number | null {
  const text = safeText(doc, selector);
  if (!text) return null;
  const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}
```

### URL Pattern Matching
```typescript
const URL_PATTERNS: Record<string, RegExp> = {
  'search-results': /\/s\?/,
  'product-detail': /\/dp\/[A-Z0-9]{10}/,
};

function detectPage(url: string): string | null {
  for (const [pageType, pattern] of Object.entries(URL_PATTERNS)) {
    if (pattern.test(url)) return pageType;
  }
  return null;
}
```
