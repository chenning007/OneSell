# Extraction Test Plan

> Issue: #26 — [Tester] Write extraction test plan: per-platform positive, degradation, and DOM-change scenarios

## Overview

Test coverage for all US-market extraction scripts: Amazon US, Google Trends, Alibaba, eBay US, Etsy, TikTok Shop US.

## Test Categories

### 1. Positive Tests (per platform)

Each script must extract all required fields from a valid DOM fixture.

| Platform | Key Fields Verified |
|---|---|
| Amazon US | BSR, title, price, review count, seller count, category |
| eBay US | sell-through rate, price, listings count, condition, seller |
| Etsy | reviews, favorites, price, shop info, listing age |
| TikTok Shop US | GMV, units sold, trending rank, hashtag data |
| Alibaba | MOQ, unit price, shipping estimate, supplier info |
| Google Trends | 12-month interest index, related queries, breakout terms |

### 2. Degradation Tests (P5 compliance)

| Test Case | Input | Expected |
|---|---|---|
| Unrecognized DOM | HTML with no matching selectors | Returns `null` (not throws) |
| Empty page | `<html><body></body></html>` | Returns `null` |
| Partial DOM | Missing optional fields | Extracts available fields; missing = `null`/default |
| Malformed HTML | Unclosed tags | Does not throw; returns `null` or partial |

### 3. Credential/Payload Tests (S1 compliance)

| Test Case | Expected |
|---|---|
| Extracted data contains no cookies | Pass |
| Extracted data contains no session tokens | Pass |
| Extracted data contains no auth headers | Pass |
| PayloadBuilder strips credential fields | `cookie`, `token`, `sessionId`, `auth` fields removed |
| Payload under 5MB limit | Pass |
| Oversized payload rejected | PayloadBuilder returns null or throws |

### 4. DOM-Change Resilience Tests

| Test Case | Input | Expected |
|---|---|---|
| Amazon class name change | Fixture with renamed CSS class | Returns `null` (graceful) |
| eBay layout restructure | Fixture missing expected container | Returns `null` |
| Script version mismatch | Old fixture with new script | No crash; null or partial |

## Automated Test Coverage

| Test File | Tests | Platform |
|---|---|---|
| `scripts/amazon-us.test.ts` | 6 | Amazon US: positive + null for unrecognized |
| `scripts/ebay-us.test.ts` | 20 | eBay US: positive, edge cases, null paths |
| `scripts/etsy.test.ts` | 19 | Etsy: positive, reviews, null paths |
| `scripts/tiktok-shop-us.test.ts` | 23 | TikTok Shop US: GMV, trending, null paths |
| `scripts/alibaba.test.ts` | 5 | Alibaba: MOQ, pricing, null paths |
| `scripts/google-trends.test.ts` | 5 | Google Trends: interest, queries, null |
| `extraction-registry.test.ts` | 7 | Registry: register, get, getForMarket |
| `payload-builder.test.ts` | 6 | Payload normalization, skip unknown |
| `contracts/extraction-plugin-isolation.contract.test.ts` | 4 | P6: plugin isolation, interface compliance |
| `contracts/graceful-degradation.contract.test.ts` | 7 | P5: null return, empty data, skip unknown |
| `contracts/payload-schema.contract.test.ts` | 5 | Payload schema: single/multi/zero platforms |
| `security/credential-containment.security.test.ts` | 4 | S1: credential stripping, S7: size limit |

**Total: 111 automated tests covering extraction functionality**

## Traceability

- PRD Section: §4.3 Data Source Connection, §4.4 Extraction
- Architecture: P1 (credential containment), P5 (graceful degradation), P6 (plugin scripts)
- Security: S1 (no credentials in payload), S7 (payload size limit)
