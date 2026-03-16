# Wizard Test Plan

> Issue: #14 — [Tester] Write test cases for Preference Wizard: all 7 markets, all 6 steps

## Overview

Tests for the 6-step Preference Wizard across all 7 markets (US, CN, UK, DE, JP, SEA, AU).

## Test Matrix: 7 Markets × 6 Steps

| Step | Component | US | CN | UK | DE | JP | SEA | AU |
|---|---|---|---|---|---|---|---|---|
| 1. Market Selection | `MarketSelection` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2. Budget | `BudgetStep` | USD $50–$500 | CNY ¥500–¥5000 | GBP £30–£400 | EUR €50–€400 | JPY ¥5000–¥50000 | USD $50–$500 | AUD A$75–A$700 |
| 3. Platform Select | `PlatformStep` | 6 platforms | 6 platforms | 5 platforms | 6 platforms | 5 platforms | 6 platforms | 5 platforms |
| 4. Product Type | `ProductTypeStep` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5. Categories | `CategoriesStep` | 10 cats | 10 cats | 10 cats | 10 cats | 10 cats | 10 cats | 10 cats |
| 6. Fulfillment | `FulfillmentStep` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Test Cases

### TC-W-01: Market Selection renders 7 tiles
- **Priority**: P0
- **Steps**: Render `MarketSelection`; count tiles
- **Expected**: 7 market tiles (US, CN, UK, DE, JP, SEA, AU) with correct flags

### TC-W-02: Selecting a market sets store state
- **Priority**: P0
- **Steps**: Click US tile; check `wizardStore.market`
- **Expected**: `market` set to `"us"`, step advances

### TC-W-03: Budget slider shows correct currency per market
- **Priority**: P0
- **Steps**: For each market, verify `BudgetStep` renders the market's currency symbol and range
- **Expected**: US=$, CN=¥, UK=£, DE=€, JP=¥, SEA=$, AU=A$

### TC-W-04: Platform step shows correct platforms per market
- **Priority**: P0
- **Steps**: For US market, verify 6 platforms: amazon-us, ebay-us, etsy, tiktok-shop-us, alibaba, google-trends
- **Expected**: All US platforms shown; non-US platforms absent

### TC-W-05: Categories step shows 10 categories per market
- **Priority**: P1
- **Steps**: For each market, render `CategoriesStep`; count category items
- **Expected**: 10 categories with correct i18n keys

### TC-W-06: Back/forward navigation between steps
- **Priority**: P0
- **Steps**: Navigate Step 1→2→3→2→3→4→5→6; verify step number at each point
- **Expected**: Step tracks correctly; no state loss on back

### TC-W-07: Default/skip behaviour
- **Priority**: P1
- **Steps**: Skip optional steps; verify wizard completes with sensible defaults
- **Expected**: Wizard reaches final step; store has valid default values

### TC-W-08: i18n renders correct language per market
- **Priority**: P0
- **Steps**: Select CN market → verify zh-CN strings; select DE → verify de strings; select JP → verify ja strings
- **Expected**: UI text in the correct locale

### TC-W-09: Store reset on market change
- **Priority**: P1
- **Steps**: Select US → configure steps → go back → select CN
- **Expected**: Previous preferences cleared; CN defaults loaded

### TC-W-10: WizardStore persistence across steps
- **Priority**: P0
- **Steps**: Set budget in Step 2 → navigate to Step 6 → navigate back to Step 2
- **Expected**: Budget value preserved

## Automated Test Coverage

| Test File | Tests | Covers |
|---|---|---|
| `wizard-store.test.ts` | 6 | Store state, step navigation, market switching |
| `market-config.test.ts` | 12 | 7 markets config, budget ranges, categories, platform lists |
| `app.test.tsx` | 2 | App renders, basic routing |
| `i18n.test.ts` | 7 | Language switching, fallback, market-driven locale |
| `contracts/market-context.contract.test.ts` | 4 | P4 immutability, payload matching |
| `contracts/config-over-hardcode.contract.test.ts` | 5 | P8 config-driven, no hardcoded IDs |

**Total: 36 automated tests covering wizard functionality**

## Traceability

- PRD Section: §4.1 Step 1 – Market Selection, §4.2 Steps 2-6
- Architecture: P4 (MarketContext immutable), P8 (config-over-hardcode)
- Security: S1 (no credentials in UI state)
