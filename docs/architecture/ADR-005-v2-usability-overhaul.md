# ADR-005: PRD v2 Usability Overhaul — Client-Only Architecture

**Status**: Proposed — `needs-human-signoff`  
**Date**: 2026-03-18  
**Author**: Architect  
**Linked Issue**: #204 (PRD v2 Approval)  
**PRD Source**: `docs/PRD-v2-Usability.md` v2.0

---

## Context

User testing of v1 revealed five critical UX failures: (1) a 6-step wizard that loses users at step 4; (2) invisible, confusing data extraction; (3) no session memory for returning users; (4) asking beginners what to search for (which defeats the product's value); (5) Docker/Node.js install prerequisites that beginners cannot handle; (6) a backend dependency that adds complexity without early-stage value.

PRD v2 mandates a complete UX overhaul that reduces the wizard to 1 step (market selection), makes extraction fully autonomous with a narrated dashboard, introduces saved profiles for returning users, redesigns results as categorized candidates with per-product reasoning, removes the backend dependency for the early release, and ships as a one-click installer.

This ADR defines the architectural changes needed to implement PRD v2 while preserving all 9 architectural principles (P1–P9) and maintaining the existing backend codebase for future Pro+ features.

### Constraints

- All 9 architectural principles (P1–P9) remain non-negotiable
- The existing `onesell-backend/` codebase is preserved but not required at runtime
- The agent code (`Planner → Executor → Synthesizer` + tool functions) moves to the client main process
- No user accounts or server-side tier enforcement in v2.0
- The user provides their own OpenAI API key (stored via `safeStorage`)

---

## Decision

We adopt a **client-only architecture** for the v2.0 early release, restructuring the Electron app into a self-contained product that performs extraction, agent analysis, and result presentation without any backend server. The six key design decisions are detailed below.

---

## D1: 1-Step Wizard Replaces 6-Step Wizard

### What Changes

| v1 Component | v2 Status | Rationale |
|---|---|---|
| `MarketSelection` (Step 1) | **Kept** — now the only wizard step | Market is the only required input |
| `BudgetStep` (Step 2) | **Moved** to `AdvancedPreferencesDrawer` | Optional; defaults apply |
| `PlatformStep` (Step 3) | **Removed entirely** | Platforms auto-selected from `MARKET_CONFIGS[marketId]` |
| `ProductTypeStep` (Step 4) | **Moved** to `AdvancedPreferencesDrawer` | Optional; defaults apply |
| `CategoriesStep` (Step 5) | **Moved** to `AdvancedPreferencesDrawer` | Agent explores all categories autonomously |
| `FulfillmentStep` (Step 6) | **Moved** to `AdvancedPreferencesDrawer` | Optional; defaults apply |
| `Wizard.tsx` (step container) | **Removed** | Only 1 step; no container needed |
| `WizardLayout.tsx` (progress bar + nav) | **Removed** | No multi-step navigation |

### New Components

| Component | Location | Purpose |
|---|---|---|
| `QuickStartScreen` | `renderer/modules/wizard/QuickStartScreen.tsx` | Returning-user 1-click re-launch |
| `AdvancedPreferencesDrawer` | `renderer/modules/preferences/AdvancedPreferencesDrawer.tsx` | Slide-out drawer consolidating Budget, ProductType, Fulfillment |

### Step Renumbering

| v2 `currentStep` | Screen | v1 Equivalent |
|---|---|---|
| 0 | Quick Start (returning users) | New |
| 1 | Market Selection | Step 1 (unchanged) |
| 2 | Extraction Dashboard | Steps 7+8 merged |
| 3 | Agent Analysis | Step 9 |
| 4 | Results Dashboard | Step 10 (redesigned) |
| 5 | Product Detail | Step 11 |

### Architectural Impact

- `App.tsx` routing changes from 11 steps → 6 screens (0–5)
- `wizardStore` simplified: remove `selectedPlatforms`; platforms derived from `market.platforms`
- `UserPreferences` interface updated: remove `targetPlatforms`, `categories` (agent handles both); add optional `productType`, `fulfillmentTime` fields with sensible defaults

### Principle Compliance

- **P4 (Market First-Class)**: Market selection remains the only required step. `MarketContext` still flows immutably. ✅
- **P8 (Config Over Hardcoding)**: Platform auto-selection reads from `MARKET_CONFIGS`. ✅

---

## D2: Extraction Dashboard Architecture

### Core Design

The Extraction Dashboard replaces three v1 screens (`DataSourceConnect`, `ProgressScreen`, and implicitly the "waiting for extraction" state) with a single unified screen comprising two visual regions:

```
┌─────────────────────────────────────────┐
│  Header: Market badge + Preferences ⚙   │
├─────────────────────────────────────────┤
│  TASK PIPELINE (scrollable list)         │
│  Row per platform: icon + status + text  │
│  Overall progress summary               │
├─────────────────────────────────────────┤
│  PLATFORM TABS (collapsible panel)       │
│  Tab bar: one tab per platform           │
│  Tab content: BrowserView or status card │
└─────────────────────────────────────────┘
│  Footer: Cancel / Analyze Now            │
└─────────────────────────────────────────┘
```

### New Components

| Component | Location | Purpose |
|---|---|---|
| `ExtractionDashboard` | `renderer/modules/extraction/ExtractionDashboard.tsx` | Container: header + pipeline + tabs + footer |
| `TaskPipeline` | `renderer/modules/extraction/TaskPipeline.tsx` | Narrated progress rows per platform |
| `TaskPipelineRow` | `renderer/modules/extraction/TaskPipelineRow.tsx` | Individual platform status row with toggle |
| `PlatformTabPanel` | `renderer/modules/extraction/PlatformTabPanel.tsx` | Tab bar + tab content area |
| `PlatformTab` | `renderer/modules/extraction/PlatformTab.tsx` | Single tab: webview, login prompt, or summary |
| `ExtractionLog` | `renderer/modules/extraction/ExtractionLog.tsx` | Mini-log of fields being extracted (per platform) |

### Removed Components

| Component | Reason |
|---|---|
| `DataSourceConnect` | Replaced by `ExtractionDashboard` |
| `ProgressScreen` | Merged into `ExtractionDashboard` |
| `useExtractionRunner` | Replaced by new `useAutonomousExtraction` hook |

### Pipeline State Model

The `extractionStore` is redesigned to support the richer Task Pipeline:

```typescript
type PipelineStatus = 'queued' | 'active' | 'done' | 'needs-login' | 'skipped' | 'error' | 'disabled';

interface PipelineTask {
  platformId: string;
  status: PipelineStatus;
  label: string;          // "Will scan hot sellers and trending searches"
  doneLabel: string;      // "Scanned hot sellers — 52 products found"
  productCount: number;
  enabled: boolean;       // toggle switch state
  requiresAuth: boolean;
  progressEvents: ExtractionProgressEvent[];
}

interface ExtractionDashboardState {
  tasks: PipelineTask[];
  activeTab: string | null;       // currently selected platform tab
  overallProgress: { done: number; total: number; estimatedMinutes: number };
  canAnalyze: boolean;            // true when ≥1 platform is done
}
```

### BrowserView Management (v2)

In v1, `ExtractionManager` opens one BrowserView at a time overlaid on the window. In v2, BrowserViews are mapped to tabs:

- Each platform tab has an associated BrowserView (created lazily when the tab is first selected)
- Only the **active tab's** BrowserView is visible (attached to the tab content area)
- When the user switches tabs, the previous BrowserView is hidden (not destroyed — preserves session)
- The `ExtractionManager` is extended with `attachToRegion(platformId, bounds)` to position views within the tab panel area instead of overlaying the full window

### Autonomous Extraction Flow

```
1. ExtractionDashboard mounts → reads MARKET_CONFIGS[marketId].platforms
2. Creates PipelineTask[] — public platforms start as "queued", auth-required as "needs-login"
3. Public platforms → ExtractionManager auto-navigates to getAutoDiscoveryUrls()
4. Auth-required platforms → tab shows login page; user authenticates
5. On login detected → status changes to "queued", joins extraction queue
6. Sequential extraction: one platform at a time (avoids resource contention)
7. Each platform emits ExtractionProgressEvent[] → updates ExtractionLog
8. When all done (or user clicks "Analyze Now") → auto-transition to step 3
```

### Principle Compliance

- **P1 (Privacy-First)**: BrowserView sessions remain isolated per platform. Credentials never leave the view. ✅
- **P5 (Graceful Degradation)**: Platforms can be skipped; analysis proceeds with partial data. ✅
- **P6 (Isolated Plugins)**: Extraction scripts remain self-contained. New `getAutoDiscoveryUrls()` method added to interface. ✅

---

## D3: Results Dashboard — Categorized Candidates with Reasoning

### What Changes

v1 `ResultsDashboard` shows a flat ranked list of 5–10 `ProductCard` objects sorted by `overallScore`. v2 introduces **category groups** — agent-determined groupings of products by opportunity type.

### New Data Types

```typescript
/** Extends ProductCard with per-product reasoning (v2) */
interface ProductCandidate extends ProductCard {
  readonly oneLineReason: string;     // ≤120 chars, shown in collapsed row
  readonly whyBullets: string[];      // 3–5 plain-English bullets for detail view
  readonly sourcePlatforms: Array<{   // which extracted platforms support this
    platformId: string;
    dataPoint: string;                // e.g. "BSR #342 in Kitchen"
  }>;
}

/** A group of candidates under a common opportunity theme */
interface CandidateCategory {
  readonly categoryName: string;       // e.g. "Trending Home & Kitchen"
  readonly categoryType: 'trending' | 'seasonal' | 'high-margin' | 'platform-hot' | 'emerging' | 'budget-friendly';
  readonly candidates: ProductCandidate[];
}

/** Agent analysis output (v2) */
interface AnalysisResult {
  readonly sessionId: string;
  readonly market: MarketContext;
  readonly categories: CandidateCategory[];
  readonly generatedAt: string;        // ISO 8601
}
```

### New Components

| Component | Location | Purpose |
|---|---|---|
| `ResultsDashboardV2` | `renderer/modules/results/ResultsDashboardV2.tsx` | Container: category groups + actions bar |
| `CategoryGroup` | `renderer/modules/results/CategoryGroup.tsx` | Collapsible group header + candidate list |
| `CandidateRow` | `renderer/modules/results/CandidateRow.tsx` | Collapsed candidate: rank, name, score, one-line reason |
| `CandidateDetail` | `renderer/modules/results/CandidateDetail.tsx` | Expanded: "Why this product?" bullets, score breakdown, source platforms |

### Modified Components

- `analysisStore`: add `categories: CandidateCategory[]` field; update `setResults` to accept `AnalysisResult`
- `ProductDetail`: updated to receive `ProductCandidate` and render `whyBullets` + `sourcePlatforms`

### Principle Compliance

- **P3 (Deterministic Numbers)**: Score breakdown values still come from deterministic tools. Agent only writes reasoning text. ✅
- **P7 (Extensible Pipeline)**: `ProductCandidate extends ProductCard extends ProductRecord` — pipeline contract preserved. ✅

---

## D4: Client-Only Architecture — Agent Moved to Main Process

### Core Change

The agent service (`PlannerAgent`, `ExecutorAgent`, `SynthesizerAgent`, `ToolRegistry`, tool functions, market prompts) moves from `onesell-backend/src/services/agent/` to `onesell-client/src/main/agent/`.

### New Directory Structure (Main Process)

```
onesell-client/src/main/
├── agent/                        # NEW — relocated from backend
│   ├── AgentService.ts           # Orchestrates Plan → Execute → Synthesize
│   ├── PlannerAgent.ts
│   ├── ExecutorAgent.ts
│   ├── SynthesizerAgent.ts
│   ├── ToolRegistry.ts
│   ├── LLMProvider.ts            # Direct OpenAI API calls (user's key)
│   ├── tools/                    # Pure deterministic tool functions
│   │   ├── calc-margin.ts
│   │   ├── rank-competition.ts
│   │   ├── score-trend.ts
│   │   ├── flag-beginner-risk.ts
│   │   ├── compare-products.ts
│   │   ├── estimate-cogs.ts
│   │   └── get-platform-fees.ts
│   └── prompts/                  # Market-specific system prompts
│       ├── us.prompt.ts
│       ├── cn.prompt.ts
│       └── [market].prompt.ts
├── store/                        # NEW — electron-store wrapper
│   └── LocalStore.ts             # electron-store for preferences, profiles, history
├── security/                     # NEW — API key management
│   └── ApiKeyManager.ts          # safeStorage encrypt/decrypt for OpenAI key
├── extraction/                   # Existing — enhanced for v2
│   ├── ExtractionManager.ts      # Extended: attachToRegion(), auto-navigation
│   ├── ExtractionScriptRegistry.ts
│   ├── PayloadBuilder.ts
│   └── scripts/                  # Existing platform scripts
├── ipc/
│   └── handlers.ts               # Extended with new v2 IPC channels
├── backend-client.ts             # Preserved but unused in v2.0
└── index.ts                      # App bootstrap (no backend dependency)
```

### LLM Provider Changes

v1: `LLMProvider` calls OpenAI from the backend using server-held API key.  
v2: `LLMProvider` calls OpenAI from the main process using user's API key from `safeStorage`.

```typescript
// v2 LLMProvider — main process
class ClientLLMProvider implements LLMProvider {
  constructor(private apiKeyManager: ApiKeyManager) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = await this.apiKeyManager.getKey();
    // Direct HTTPS call to OpenAI API — key never reaches renderer
    return openaiComplete(apiKey, request);
  }
}
```

### Local Data Storage

| v1 (Backend) | v2 (Client) | Interface |
|---|---|---|
| PostgreSQL `user_preferences` | `electron-store` → `preferences.json` | `LocalStore.getPreferences() / setPreferences()` |
| PostgreSQL `saved_products` | `electron-store` → `saved-products.json` | `LocalStore.saveProducts() / getSavedProducts()` |
| Redis session cache | In-memory `Map` in main process | Ephemeral — cleared on app close |
| JWT auth | None — local user only | No auth required |

### IPC Channel Contract (v2)

All new IPC channels are Zod-validated at the handler boundary (P9):

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| `extraction:start-pipeline` | R→M | `{ marketId }` | Start autonomous extraction for all market platforms |
| `extraction:pipeline-update` | M→R | `PipelineTask[]` | Push pipeline state updates to renderer |
| `extraction:progress-event` | M→R | `ExtractionProgressEvent` | Granular per-field extraction progress |
| `extraction:attach-view` | R→M | `{ platformId, bounds }` | Position BrowserView in tab panel area |
| `extraction:toggle-platform` | R→M | `{ platformId, enabled }` | User enables/disables a platform |
| `agent:run-analysis` | R→M | `{ extractionData, preferences }` | Trigger agent analysis |
| `agent:analysis-status` | M→R | `{ status, step, message }` | Push agent progress to renderer |
| `agent:analysis-result` | M→R | `AnalysisResult` | Push final results |
| `store:get-profile` | R→M | `void` | Read saved user profile |
| `store:save-profile` | R→M | `UserProfile` | Persist profile |
| `store:clear-profile` | R→M | `void` | Delete saved profile |
| `apikey:get-status` | R→M | `void` | Check if API key is configured |
| `apikey:save` | R→M | `{ key }` | Store API key via safeStorage |
| `apikey:clear` | R→M | `void` | Remove stored API key |
| `preferences:get` | R→M | `void` | Read advanced preferences |
| `preferences:save` | R→M | `AdvancedPreferences` | Persist preferences |

### Principle Compliance

- **P1 (Privacy-First)**: API key stored via OS-level `safeStorage`, never in renderer process. ✅
- **P2 (Strict Separation)**: Client collects data (renderer/BrowserView) AND analyses (main process). **P2 is relaxed for v2.0** — both responsibilities live in the client but in separate processes (renderer vs main). The data-collection/intelligence boundary is preserved at the IPC level. ✅ (with documented exception)
- **P3 (Deterministic Numbers)**: Tool functions are the same pure functions — just relocated. ✅
- **P9 (Security by Default)**: All IPC channels Zod-validated. API key encrypted. No eval(). ✅

### P2 Relaxation Note

P2 ("Client collects; backend analyses") is the only principle that changes in v2. The separation remains **logical** (extraction in BrowserView/renderer; analysis in main process via IPC) but not **physical** (no separate server process). This is documented as an explicit, reversible trade-off. When backend features are re-introduced for Pro+, the agent service can move back to the server with minimal refactoring because tool functions are pure and prompts are portable.

---

## D5: One-Click Installer via electron-builder

### Build Targets

| Platform | Format | Config Key |
|---|---|---|
| Windows 10+ | NSIS installer (.exe) | `electron-builder.yml → nsis` |
| macOS 12+ | DMG + drag-to-Applications | `electron-builder.yml → dmg` |
| Linux (stretch) | AppImage | `electron-builder.yml → appImage` |

### What the Installer Bundles

- Electron runtime (Chromium + Node.js)
- All renderer + main process code (pre-bundled via Vite)
- All extraction scripts (compiled TypeScript)
- Agent service + tool functions + market prompts
- Market configs, i18n strings, fee tables
- **No Docker, No PostgreSQL, No Redis, No Node.js runtime**

### Build System Changes

| Change | Details |
|---|---|
| New npm scripts | `pnpm dist:win`, `pnpm dist:mac`, `pnpm dist:linux` |
| `electron-builder.yml` | Updated with app name, icons, NSIS config, code signing placeholders |
| `pnpm dev` (client) | No longer requires `docker compose up` or backend running |
| CI/CD | New workflow: on git tag `v*` → build installers → attach to GitHub Release |

### No Auto-Update (v2.0)

Auto-update via `electron-updater` is deferred to Phase P2. Users update by downloading a new installer.

---

## D6: Saved User Profiles via electron-store

### Data Model

```typescript
interface UserProfile {
  marketId: string;
  lastSessionAt: string;       // ISO 8601
  advancedPreferences?: {
    budget?: { min: number; max: number; currency: string };
    productType?: 'physical' | 'digital';
    fulfillmentTime?: 'lt5h' | '5to15h' | 'gt15h';
  };
}
```

### Storage

- File: `electron-store` config file at `<userData>/config.json`
- Encrypted fields: API key via `safeStorage` (separate from electron-store)
- Non-encrypted fields: profile, preferences, session history (local JSON)

### Behaviour

- Profile saved **after** user starts extraction (confirmed intent)
- Profile persists indefinitely — cleared only by user action or uninstall
- Profile never sent to any server

---

## Options Considered

### Option A (Chosen): Full Client-Only with Agent in Main Process

Move the entire agent service to Electron main process. User provides own API key. All data local.

**Pros**: Zero installation complexity. Fastest time-to-ship. Full privacy. Validates product before infrastructure investment.  
**Cons**: User must obtain OpenAI API key. No usage tracking. No server-side tier enforcement.

### Option B: Thin Backend Proxy for LLM Only

Keep a lightweight backend that proxies LLM calls only (no database, no auth). Client sends extraction data, backend returns analysis.

**Pros**: User doesn't need their own API key. Some usage tracking possible.  
**Cons**: Still requires deployment infrastructure. Backend becomes a single point of failure. Adds latency. Increases shipping complexity.

### Option C: Keep Full Backend

Simplify installation with Docker Compose auto-start from Electron.

**Pros**: No architecture change needed.  
**Cons**: Docker Desktop is a 2GB install. Beginners can't troubleshoot container issues. Doesn't solve the core UX problem.

---

## Consequences

### What Becomes Easier

- Installation: 1 file download, 1 double-click
- Iteration: change agent prompts or tools without backend deployment
- Privacy: all data stays on user's machine by default
- Testing: client-only tests cover the full flow; no integration environment needed

### What Becomes Harder

- Usage tracking: no server-side analytics until Pro+ tier
- Abuse prevention: client-side "honor system" for free tier limits
- Team features: collaboration and sharing require future backend work
- Multi-device: no cloud sync until backend features are re-introduced

### Architectural Constraints Imposed

1. Agent tool functions MUST remain pure (no database queries, no Redis lookups) — they already are
2. `LLMProvider` abstraction MUST support both client-side (direct API) and server-side (proxied) mode
3. `electron-store` data schema must be versioned for future migration to server-side storage
4. All IPC channels must be Zod-validated (same standard as the HTTP API boundary)

---

## Compliance

### How This Decision Is Verified

| Check | Mechanism |
|---|---|
| Agent tools remain pure functions | Unit tests with deterministic inputs — no async, no side effects |
| API key never reaches renderer | Review: `safeStorage` calls only in main process; IPC channel returns status only |
| No backend required at startup | CI: `pnpm dev` starts client without `docker compose up` |
| BrowserView isolation maintained | Review: BrowserView configured with `contextIsolation: true` |
| IPC channels Zod-validated | Review + unit tests: every handler calls schema.parse() before logic |
| electron-store data never contains credentials | Unit test: strip-credentials function applied to all stored data |
| Installer produces working binary | CI: `pnpm dist:win` / `pnpm dist:mac` run on tagged releases |

### What Breaks If Violated

- If API key leaks to renderer → security vulnerability (P1 violation)
- If agent tool functions become impure → non-deterministic analysis (P3 violation)
- If extraction scripts depend on agent internals → coupling violation (P6/P7)
- If IPC channels skip validation → injection risk (P9 violation)

---

*This ADR requires human sign-off before any implementation begins. Label `needs-human-signoff` will be applied to the tracking issue.*
