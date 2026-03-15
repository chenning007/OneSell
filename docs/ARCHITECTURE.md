# OneSell Scout — System Architecture Design

**Version**: 1.0  
**Author**: Architecture Team  
**Date**: 2026-03-15  
**Status**: **AUTHORITATIVE** — All development and testing must conform to this document.  
**Reference PRD**: `docs/PRD-Product-Selection-Module.md`

> This document is the single source of truth for system topology, component contracts, architectural principles, security model, and extension patterns. Deviations require explicit architectural review and approval. Developer agents and tester agents must read this document before writing any code or tests.

---

## Table of Contents

1. [Architectural Principles](#1-architectural-principles)
2. [System Topology](#2-system-topology)
3. [Tech Stack](#3-tech-stack)
4. [Client Architecture](#4-client-architecture)
5. [Transport Layer](#5-transport-layer)
6. [Backend Architecture](#6-backend-architecture)
7. [AI Agent Architecture](#7-ai-agent-architecture)
8. [Data Architecture](#8-data-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Observability](#10-observability)
11. [Extension Architecture](#11-extension-architecture)
12. [Non-Functional Targets](#12-non-functional-targets)
13. [Deployment Architecture](#13-deployment-architecture)

---

## 1. Architectural Principles

These are **non-negotiable constraints** that govern every design and implementation decision. They are not guidelines — they are the law.

### P1 — Privacy-First, Client-Local Credentials

User authentication credentials, session cookies, and platform login state **must never leave the user's machine**. The backend must never receive, store, process, or log any form of user credential or session token. Any code path that transmits credentials to the backend is a **critical security violation** and must be rejected in code review.

### P2 — Strict Separation: Data Collection vs Intelligence

The **client** is solely responsible for data collection (DOM extraction from authenticated browser sessions). The **backend** is solely responsible for analysis and intelligence. These responsibilities must never cross boundaries:
- The client does **not** perform analysis, scoring, or ranking.
- The backend does **not** perform data collection, scraping, or authentication.
- This boundary enables each tier to evolve independently without affecting the other.

### P3 — Deterministic Numbers, LLM Reasoning Only

All quantitative outputs — prices, margins, fees, scores, review counts, search indices — are computed by **deterministic, pure tool functions**. LLMs must never generate numerical claims directly. The LLM writes reasoning *around* verified numbers produced by tools. An LLM that produces a margin percentage independently is a defect, not a feature.

### P4 — Market as a First-Class, Immutable Session Parameter

Every analysis session is scoped to exactly one market. `MarketContext` flows as an immutable, typed parameter through every component, prompt, tool call, UI element, and output within that session. No component may assume a default market, infer market from other signals, or allow market context to change mid-session. Market switching resets the session.

### P5 — Graceful Degradation Over Strict Requirement

The system must function with partial data. If a platform extraction fails or a user connects fewer data sources, the agent adjusts its analysis scope and proceeds. Every component consuming extraction data must handle missing or partial platform data without crashing. Partial results are preferable to no results.

### P6 — Extraction Scripts as Isolated, Versioned Plugins

Each platform's extraction logic lives in a self-contained, versioned module conforming to the `ExtractionScript` interface. A DOM change on any platform requires updating only that platform's extraction script module — not any upstream or downstream component. Core logic must never encode platform-specific logic directly.

### P7 — Extensible Module Pipeline

OneSell is designed as a pipeline of modules: **Scout → Sourcing → Listing → Campaigns**. Each module consumes and produces the standard `ProductRecord` schema. New pipeline modules integrate by implementing this contract. They must never modify the Scout module's internals.

### P8 — Configuration Over Hardcoding

Markets, platforms, fee structures, risk rules, and LLM provider preferences are **data in configuration**, not hardcoded in logic. Adding a new market or updating a fee table requires a configuration change, not a code deployment.

### P9 — Security by Default

Every layer implements security controls: TLS enforcement, JWT authentication, strict input validation, parameterized database queries, LLM output sanitization, and secrets management. Security is part of the definition of done for every feature — not a post-launch concern.

---

## 2. System Topology

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CLIENT TIER — Electron Desktop Application                                │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │  Renderer Process  (React + Zustand)                              │     │
│  │  WizardModule · DataSourceModule · ProgressModule · ResultsModule │     │
│  └─────────────────────────────┬─────────────────────────────────────┘     │
│                                │ Electron IPC (contextBridge)              │
│  ┌─────────────────────────────▼─────────────────────────────────────┐     │
│  │  Main Process  (Node.js)                                          │     │
│  │  ExtractionManager · PayloadBuilder · BackendClient               │     │
│  │  SessionStore · AppUpdater                                        │     │
│  └─────────────────────────────┬─────────────────────────────────────┘     │
│                                │ BrowserView IPC (script injection)        │
│  ┌─────────────────────────────▼─────────────────────────────────────┐     │
│  │  BrowserView  (Chromium — isolated process)                       │     │
│  │  ExtractionScriptRegistry                                         │     │
│  │  [amazon-us] [taobao] [jd] [shopee] [alibaba] [google-trends] …  │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────┘
                                │
                        HTTPS / TLS 1.3
                        Authorization: Bearer <JWT>
                        POST /api/v1/analysis
                                │
┌────────────────────────────────▼───────────────────────────────────────────┐
│  BACKEND TIER — Cloud Services (Structured Monolith for v1)                │
│                                                                            │
│  ┌────────────────────────┐   ┌──────────────────────────────────────┐     │
│  │  API Gateway           │──▶│  Agent Service                       │     │
│  │  Auth · Rate · Validate│   │  Planner → Executor → Synthesizer    │     │
│  └────────────────────────┘   │  ToolRegistry · MarketPromptStore    │     │
│                               │  LLMProvider (abstraction layer)     │     │
│  ┌──────────────────────┐     └──────────────────────────────────────┘     │
│  │  User Service        │   ┌──────────────────────────────────────┐       │
│  │  Account · Prefs     │   │  Market Config Service               │       │
│  │  Lists · Sessions    │   │  Platforms · Fees · Categories       │       │
│  └──────────────────────┘   │  Prompts · Risk Rules                │       │
│                             └──────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────────┘
                                │
┌────────────────────────────────▼───────────────────────────────────────────┐
│  DATA TIER                                                                 │
│  PostgreSQL (users, preferences, sessions, saved_products)                 │
│  Redis      (live session payloads and results — TTL 1 hour)               │
└────────────────────────────────────────────────────────────────────────────┘
                                │
┌────────────────────────────────▼───────────────────────────────────────────┐
│  EXTERNAL SERVICES                                                         │
│  LLM API: OpenAI GPT-4o (default) / Qwen (CN market) / DeepSeek (CN alt)  │
│  All calls made exclusively from Agent Service — key never in client       │
│  Exchange Rate API — cached in Redis, used by calc_margin tool             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Client UI | React 18 + TypeScript (strict) | Component model, market i18n support |
| Client state | Zustand | Lightweight, no boilerplate for session/results state |
| Client runtime | Electron 30+ (Node.js 20+) | Required for BrowserView authenticated sessions |
| Browser engine | Electron BrowserView (Chromium) | Full browser rendering; user is genuinely present — not a bot |
| Client build | Vite + electron-builder | Fast builds, signed distributables |
| Backend runtime | Node.js 20+ with TypeScript (strict) | Consistent language across stack |
| Backend framework | Fastify | Low overhead, built-in schema validation |
| Schema validation | Zod (runtime) | Type-safe, composable, used at every API boundary |
| ORM | Drizzle ORM | Type-safe SQL, lightwright, explicit queries |
| Database | PostgreSQL 16 | Relational, JSON support (JSONB for card data) |
| Cache / session | Redis 7 (TTL-based) | Ephemeral analysis session storage |
| LLM integration | Vercel AI SDK | Unified abstraction over OpenAI / Qwen / DeepSeek |
| Testing | Vitest + Testing Library + Playwright | Fast unit/integration + E2E |
| CI/CD | GitHub Actions | Lint → Type check → Unit tests → Integration tests → Build |
| Container | Docker | Reproducible builds, easy cloud deployment |
| Secrets | AWS Secrets Manager (prod) / `.env` (dev) | LLM keys, DB credentials — never in source |
| Monitoring | Pino (logging) + Sentry (errors) | Structured logs with correlation IDs |

---

## 4. Client Architecture

### 4.1 Process Model

The Electron app runs three processes with strict isolation:

| Process | Technology | Responsibilities | Can Access |
|---|---|---|---|
| **Renderer** | React (browser-like environment) | All UI, user interactions, application state | IPC Bridge only |
| **Main Process** | Node.js | ExtractionManager, PayloadBuilder, BackendClient, SessionStore | All Node.js APIs, BrowserView IPC |
| **BrowserView** | Chromium (isolated) | Platform authentication, extraction script execution | Page DOM in current tab only |

**Critical IPC Rule**: The Renderer process has no direct Node.js access. All system operations (extraction, backend calls, local storage) go through the contextBridge IPC boundary.

### 4.2 Directory Structure

```
onesell-client/
├── src/
│   ├── main/                     # Electron Main Process
│   │   ├── extraction/
│   │   │   ├── ExtractionManager.ts
│   │   │   ├── ExtractionScriptRegistry.ts
│   │   │   ├── PayloadBuilder.ts
│   │   │   └── scripts/          # Platform extraction scripts (plugins)
│   │   │       ├── amazon-us/
│   │   │       ├── taobao/
│   │   │       ├── jd/
│   │   │       ├── shopee/
│   │   │       ├── alibaba/
│   │   │       ├── google-trends/
│   │   │       └── [platform-id]/    # New platforms added here only
│   │   ├── backend/
│   │   │   └── BackendClient.ts
│   │   ├── session/
│   │   │   └── SessionStore.ts
│   │   └── ipc/
│   │       └── handlers.ts       # IPC handler registry
│   ├── renderer/                 # React UI
│   │   ├── modules/
│   │   │   ├── wizard/           # Steps 1–6 preference wizard
│   │   │   ├── data-sources/     # Platform connect + extraction trigger
│   │   │   ├── progress/         # Extraction + analysis progress screens
│   │   │   └── results/          # Product cards + drill-down
│   │   ├── store/                # Zustand stores
│   │   │   ├── sessionSlice.ts
│   │   │   └── resultsSlice.ts
│   │   ├── i18n/                 # Localization strings per market
│   │   │   ├── us.ts
│   │   │   ├── cn.ts
│   │   │   ├── sea.ts
│   │   │   └── [market-id].ts
│   │   └── components/           # Shared components
│   └── shared/                   # Types shared across main + renderer
│       ├── types/
│       │   ├── AnalysisPayload.ts
│       │   ├── MarketContext.ts
│       │   ├── ProductCard.ts
│       │   └── ProductRecord.ts  # Inter-module pipeline contract
│       └── schemas/              # Zod validation schemas
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### 4.3 Core Interface Contracts

#### MarketContext (immutable session parameter)

```typescript
interface MarketContext {
  readonly marketId: 'us' | 'cn' | 'uk' | 'de' | 'jp' | 'sea' | 'au';
  readonly language: string;     // BCP-47 language tag
  readonly currency: string;     // ISO 4217 currency code
  readonly platforms: string[];  // Available platform IDs for this market
}
```

A `MarketContext` object, once created at wizard Step 1, is **never mutated**. All downstream components receive it as a read-only parameter.

#### ExtractionScript Interface (platform plugin contract)

```typescript
interface ExtractionScript {
  readonly platformId: string;     // Unique platform identifier, e.g., 'amazon-us'
  readonly marketId: string;       // Market this script belongs to
  readonly version: string;        // Semver — increment on any DOM structure change
  readonly requiresAuth: boolean;

  /**
   * Returns the sequence of URLs the BrowserView should navigate to
   * for a given keyword and market. Called in Main Process.
   */
  getNavigationTargets(keyword: string, market: MarketContext): string[];

  /**
   * Runs in BrowserView page context. Extracts structured data from the
   * current page DOM. Must be a pure function — no state mutation.
   * Returns null if page structure is unrecognized (not an error — graceful).
   */
  extractFromPage(document: Document, url: string): RawPlatformData | null;

  /**
   * Runs in Main Process. Normalizes array of raw page data snapshots
   * into canonical NormalizedPlatformData schema.
   */
  normalizeData(raw: RawPlatformData[]): NormalizedPlatformData;
}
```

**Adding a new platform** = implementing this interface and registering with `ExtractionScriptRegistry`. No other file changes are required.

#### AnalysisPayload (client → backend contract)

```typescript
interface AnalysisPayload {
  readonly sessionId: string;
  readonly market: MarketContext;
  readonly userPreferences: UserPreferences;
  readonly platformData: Readonly<Record<string, NormalizedPlatformData>>;
  readonly extractionMetadata: {
    readonly platforms: string[];
    readonly extractedAt: string;            // ISO 8601
    readonly scriptVersions: Record<string, string>;
  };
}
```

This payload is the single unit of data crossing the client-to-backend boundary. **No credential or session data is permitted in any field of this payload.**

#### ProductRecord (inter-module pipeline contract)

```typescript
interface ProductRecord {
  // Produced by Scout, consumed by Sourcing / Listing / Campaigns
  readonly productName: string;
  readonly market: MarketContext;
  readonly category: string;
  readonly overallScore: number;
  readonly estimatedCogs: MoneyAmount;
  readonly estimatedSellPrice: MoneyAmount;
  readonly estimatedMargin: number;          // 0.0–1.0
  readonly primaryPlatform: string;
  readonly supplierSearchTerms: string[];
  readonly riskFlags: RiskFlag[];
  readonly agentJustification: string;
  readonly rawScores: ScoreBreakdown;
}
```

Future modules (Sourcing, Listing) consume `ProductRecord[]` and extend it. They never modify the Scout module's internals.

### 4.4 Client Security Constraints

1. **No credential storage** — IPC message type `auth:credentials` must never exist. Credentials produced by the BrowserView must not be captured, stored, logged, or transmitted.
2. **CSP enforcement** — Renderer uses `Content-Security-Policy: default-src 'self'; script-src 'self'`. No `eval()`, no inline scripts.
3. **IPC validation** — Every IPC handler validates incoming message payload against a Zod schema before processing. Unknown message shapes are rejected.
4. **BrowserView sandboxing** — BrowserView is configured with `sandbox: true`. It cannot access the Main Process filesystem or execute Node.js APIs. Only DOM-level extraction scripts are injected.
5. **Auto-update integrity** — `electron-updater` uses code-signing verification. Updates from unsigned sources are rejected.

---

## 5. Transport Layer

### 5.1 API Contract

**Base URL (production)**: `https://api.onesell.app/api/v1`

| Endpoint | Method | Auth | Rate Limit | Description |
|---|---|---|---|---|
| `/auth/register` | POST | None | 10/IP/hr | Create user account |
| `/auth/login` | POST | None | 20/IP/hr | Authenticate, receive JWT pair |
| `/auth/refresh` | POST | Refresh JWT | 60/user/hr | Rotate access token |
| `/analysis` | POST | Bearer JWT | Per tier | Submit `AnalysisPayload` |
| `/analysis/:sessionId/status` | GET | Bearer JWT | 60/user/min | Poll analysis progress |
| `/analysis/:sessionId/results` | GET | Bearer JWT | 60/user/min | Retrieve `ProductCard[]` |
| `/user/preferences` | GET/PUT | Bearer JWT | 30/user/min | User wizard preferences |
| `/user/saved-lists` | GET/POST | Bearer JWT | 60/user/min | Manage saved products |
| `/markets` | GET | None | 200/IP/hr | Cached market config (public) |

### 5.2 Rate Limiting by Tier

| Tier | Daily analyses | Results depth | Export |
|---|---|---|---|
| Free | 1/week | Top 3 cards only | No |
| Starter | 5/week | Full 10 cards | No |
| Pro | Unlimited | Full + drill-down | CSV + PDF |
| Business | Unlimited | Full + API access | All formats |

Rate limits are enforced **server-side** via Redis counters. The client displays remaining quota but enforcement is always backend-authoritative.

### 5.3 Transport Security

- TLS 1.3 minimum — TLS 1.2 and below are rejected at the load balancer
- HSTS with `max-age=31536000; includeSubDomains; preload`
- JWT: RS256 signed, access token 15-minute expiry, refresh token 7-day expiry with rotation
- Payload size limit: 5 MB maximum (protects against oversized extraction payloads)
- Request signing: HMAC-SHA256 `X-OneSell-Signature` header on analysis submissions (verified server-side)

---

## 6. Backend Architecture

### 6.1 Structure

The v1 backend is a **structured monolith**: logically separate service modules within a single deployable process. This enables fast iteration while preserving a clean path to microservice extraction if load demands it.

```
onesell-backend/
├── src/
│   ├── api/                      # API Gateway (Fastify routes + middleware)
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT validation
│   │   │   ├── rateLimit.ts      # Redis-backed rate limiting
│   │   │   └── validate.ts       # Zod request validation
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── analysis.routes.ts
│   │       └── user.routes.ts
│   ├── services/
│   │   ├── agent/                # Plan → Execute → Synthesize pipeline
│   │   │   ├── AgentService.ts
│   │   │   ├── PlannerAgent.ts
│   │   │   ├── ExecutorAgent.ts
│   │   │   ├── SynthesizerAgent.ts
│   │   │   ├── ToolRegistry.ts
│   │   │   ├── tools/            # Deterministic tool functions
│   │   │   │   ├── calc-margin.ts
│   │   │   │   ├── rank-competition.ts
│   │   │   │   ├── score-trend.ts
│   │   │   │   ├── flag-beginner-risk.ts
│   │   │   │   ├── compare-products.ts
│   │   │   │   ├── estimate-cogs.ts
│   │   │   │   └── get-platform-fees.ts
│   │   │   ├── prompts/          # Market-specific system prompts
│   │   │   │   ├── us.prompt.ts
│   │   │   │   ├── cn.prompt.ts
│   │   │   │   └── [market].prompt.ts
│   │   │   └── LLMProvider.ts    # Abstraction: OpenAI / Qwen / DeepSeek
│   │   ├── user/
│   │   │   ├── UserService.ts
│   │   │   └── UserRepository.ts
│   │   ├── market-config/
│   │   │   └── MarketConfigService.ts
│   │   └── session/
│   │       └── SessionService.ts
│   ├── db/
│   │   ├── schema.ts             # Drizzle ORM schema definitions
│   │   └── client.ts
│   └── shared/
│       └── types/                # Shared type definitions
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

### 6.2 API Gateway Middleware Stack

Applied in this precise order to every request:

1. **TLS termination** — Enforced at Cloudflare / load balancer level
2. **CORS** — Allowlist: Electron app origin + optional web dashboard origin
3. **Rate limiting** — Redis sliding window keyed by `userId + endpoint + window`
4. **JWT validation** — RS256 signature verification, expiry check, `userId` + `tier` extraction
5. **Payload size check** — Reject requests exceeding 5 MB
6. **Zod schema validation** — Per-endpoint schema; 400 on schema mismatch
7. **Correlation ID injection** — `X-Correlation-Id` header attached for tracing
8. **Route dispatch** — Pass validated, typed request to service layer

### 6.3 LLM Provider Abstraction

```typescript
interface LLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
  completeWithTools(request: LLMToolRequest): Promise<LLMToolResponse>;
}

// Implementations:
class OpenAIProvider implements LLMProvider { ... }   // Default — all markets
class QwenProvider implements LLMProvider { ... }     // China market preferred
class DeepSeekProvider implements LLMProvider { ... } // China market alternative
```

The `MarketConfigService` specifies the preferred LLM provider per market. The `AgentService` resolves the correct provider at runtime — no hardcoded provider selection in agent logic.

---

## 7. AI Agent Architecture

### 7.1 Plan → Execute → Synthesize Loop

```
INPUT: AnalysisPayload + UserPreferences + MarketContext
                    │
                    ▼
          ┌─────────────────┐
          │    PLANNER      │  ← Market-specific system prompt injected
          │    (LLM)        │  ← Produces: TaskPlan (ordered task list)
          └────────┬────────┘  ← Never produces numbers
                   │ TaskPlan
                   ▼
          ┌─────────────────┐
          │    EXECUTOR     │  ← Runs each task via ToolRegistry
          │  (LLM + Tools)  │  ← Tool calls are deterministic pure functions
          └────────┬────────┘  ← Produces: TaskResults with verified data
                   │ TaskResults
                   ▼
          ┌─────────────────┐
          │  SYNTHESIZER    │  ← Writes in market language
          │    (LLM)        │  ← References only tool-verified data
          └────────┬────────┘  ← Never invents numbers or facts
                   │
                   ▼
OUTPUT: ProductCard[] — ranked, plain-language, market-native
```

### 7.2 Tool Registry Contracts

All tools are **pure functions** with no side effects and no LLM involvement. They are the only source of quantitative data in the system.

```typescript
interface Tool<TInput, TOutput> {
  readonly name: string;
  readonly description: string;    // Used in LLM function-calling schema
  execute(input: TInput): TOutput; // Pure function — no async, no side effects
}
```

**Registered Tools (v1):**

| Tool Name | Input | Output | Market-Sensitive |
|---|---|---|---|
| `calc_margin` | sell price, COGS, platform fees, shipping, market | `MarginResult` (gross %, net %, local currency) | Yes — fee tables vary by market |
| `rank_competition` | listing array (reviews, ages, sales), market | `CompetitionResult` (score 0–100, narrative) | Yes — thresholds differ by market |
| `score_trend` | search index time series (Google Trends or Baidu Index), market | `TrendResult` (direction, growth %, seasonality) | Yes — index normalization differs |
| `flag_beginner_risk` | product category, attributes, market | `RiskFlagResult[]` (SAFE/WARNING/FLAGGED) | Yes — regulatory rules differ by market |
| `compare_products` | scored product list | `ComparisonResult` (ranked list, rationale) | No |
| `estimate_cogs` | supplier price range (Alibaba/1688/local), market | `CogsEstimate` (low, mid, high in local currency) | Yes — logistics costs differ |
| `get_platform_fees` | platform, product category, market | `FeeStructure` (listing fee, commission %, fulfillment) | Yes — fees differ by platform/market |

**Tool Coverage Requirement**: Every tool must have 100% unit test coverage. Tools are pure functions — this is non-negotiable. See `docs/guides/TESTER-GUIDE.md`.

### 7.3 Market-Specific Prompt Architecture

Each market has a versioned system prompt authored by a domain expert. Prompts are stored in `services/agent/prompts/` and loaded by `MarketPromptStore`.

```typescript
interface MarketSystemPrompt {
  readonly marketId: string;
  readonly version: string;          // Semver — tracked for rollback
  readonly language: string;         // Output language for Synthesizer
  readonly systemPrompt: string;     // Full system prompt text
  readonly toolCallGuide: string;    // Market-specific tool usage instructions
}
```

**Prompt Security Rules:**
- User-provided input (keywords, categories) is **never directly interpolated** into system prompts.
- User inputs are injected only into designated, sandboxed `[USER_INPUT]` slots in prompt templates.
- All user inputs are sanitized (HTML entities escaped, control characters stripped) before any prompt interpolation.

### 7.4 Output Validation

The Synthesizer's LLM output is **never passed raw to the client**. Before dispatch:

1. Output is parsed against the `ProductCard[]` Zod schema.
2. All numerical fields in cards are cross-validated against tool results (LLM-written numbers not permitted).
3. Risk flags are validated against the known `RiskFlag` enum — no free-text risk categories.
4. Malformed output triggers a re-attempt (one retry) then a graceful error — never a raw LLM error message to the user.

---

## 8. Data Architecture

### 8.1 PostgreSQL Schema

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,   -- bcrypt cost factor >= 12
  tier          VARCHAR(20) NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_preferences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market             VARCHAR(10) NOT NULL,
  budget_local       NUMERIC(12, 2),
  preferred_platforms TEXT[] NOT NULL DEFAULT '{}',
  product_type       VARCHAR(20),
  categories         TEXT[] NOT NULL DEFAULT '{}',
  time_availability  VARCHAR(20),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, market)
);

CREATE TABLE analysis_sessions (
  id             UUID PRIMARY KEY,   -- Client-generated session UUID
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market         VARCHAR(10) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  platforms_used TEXT[] NOT NULL DEFAULT '{}',
  result_count   INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- Only explicitly saved products are persisted; raw analysis data lives in Redis
CREATE TABLE saved_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES analysis_sessions(id),
  market        VARCHAR(10) NOT NULL,
  product_name  VARCHAR(500) NOT NULL,
  overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  card_data     JSONB NOT NULL,     -- Full serialized ProductCard
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_products_user ON saved_products (user_id, created_at DESC);
CREATE INDEX idx_analysis_sessions_user ON analysis_sessions (user_id, created_at DESC);
```

### 8.2 Redis Key Schema

| Key Pattern | Type | TTL | Content |
|---|---|---|---|
| `session:{id}:payload` | String (JSON) | **1 hour** | Raw `AnalysisPayload` from client |
| `session:{id}:status` | Hash | **2 hours** | Analysis status + step-by-step progress |
| `session:{id}:results` | String (JSON) | **1 hour** | Completed `ProductCard[]` |
| `ratelimit:{userId}:{weekISO}` | Counter | Auto-expire at week boundary | Weekly analysis count |
| `market:fees:{market}:{platform}` | Hash | 24 hours | Cached fee structure |
| `market:config:{market}` | String (JSON) | 6 hours | Cached full market config |
| `exchange-rate:{from}:{to}:{date}` | String | 24 hours | Cached exchange rate |

### 8.3 Data Retention Policy

| Data | Retention | Mechanism |
|---|---|---|
| Raw `AnalysisPayload` (extraction data) | **≤ 1 hour** | Redis TTL — auto-purged |
| Analysis results in Redis | **≤ 1 hour** | Redis TTL — auto-purged |
| Analysis session metadata (PostgreSQL) | 2 years | Soft delete on account closure |
| Explicitly saved products | Until user deletes | User-controlled |
| Aggregated analytics (anonymized) | Indefinite | No PII — for product improvement only |
| User credentials (hashed) | Until account deleted | bcrypt hash only; plaintext never stored |

**Raw platform extraction data from user sessions is never stored in PostgreSQL.** Any feature proposal that stores raw extraction data permanently must be reviewed by architecture.

---

## 9. Security Architecture

### 9.1 Authentication & Authorization

- **Password hashing**: bcrypt with cost factor ≥ 12 — never MD5, SHA-1, or SHA-256 alone.
- **JWT structure**: Access token (15 min, RS256) + Refresh token (7 days, RS256, rotated on use).
- **Authorization enforcement**: Every data query includes `WHERE user_id = :userId` from the authenticated JWT claim. No user can access another user's sessions, preferences, or saved products.
- **Tier enforcement**: Analysis count limits and feature gates are enforced **server-side** based on the `tier` claim in the JWT — never on the client.

### 9.2 Injection Prevention

| Vector | Control |
|---|---|
| SQL injection | Drizzle ORM parameterized queries exclusively — no raw string concatenation |
| Prompt injection | User inputs sanitized before prompt interpolation; placed only in sandboxed template slots; never in system prompt |
| XSS (Renderer) | CSP header, React's built-in escaping, no `dangerouslySetInnerHTML` |
| XSS (API responses) | LLM output sanitized through Zod schema validation before sending to client |
| Command injection | No shell execution in the codebase — Node.js child_process usage is banned |

### 9.3 Secrets Management

| Secret | Storage | Never in |
|---|---|---|
| LLM API key | AWS Secrets Manager (prod) / `.env` local | Source code, client binary, logs |
| Database credentials | AWS Secrets Manager | Source code, container images |
| JWT signing keys (RS256) | AWS Secrets Manager | Source code |
| Platform API keys (future) | AWS Secrets Manager | Client, source code |

The client binary must be audited for embedded secrets before every release. Any `grep -r 'sk-' .` equivalent finding in the client bundle is a release blocker.

### 9.4 LLM Security Invariants

1. The LLM API key is **exclusively in the Agent Service** — never referenced in client code.
2. All LLM calls are made from the Agent Service over the server's outbound internet connection — never proxied through or initiated by the client.
3. LLM responses are schema-validated before use — a malformed LLM response triggers error handling, not raw passthrough.
4. LLM token budget limits are enforced per request to prevent cost attacks via oversized payloads.

---

## 10. Observability

| Concern | Tool | What is Tracked |
|---|---|---|
| Structured logging | Pino | Every request with `correlationId`, `userId`, `market`, `sessionId`, duration |
| Error tracking | Sentry | Client JS errors, backend exceptions, LLM failures, extraction script errors |
| Extraction health | Custom metrics | Success rate per `platformId + scriptVersion` — spikes indicate DOM changes |
| Agent performance | Pino + Sentry | P50/P95 latency per market, LLM token usage per session |
| Cost monitoring | LLM token metrics | Cost per analysis by market and tier — alerts at threshold |
| Auth events | Audit log | Login, JWT refresh, failed auth attempts — stored for 90 days |

**Extraction Script Monitoring**: Any extraction script with > 5% failure rate over a 1-hour window triggers an alert. This is the primary signal for platform DOM changes. The `scriptVersion` field in the extraction metadata enables rapid correlation between script versions and failure spikes.

---

## 11. Extension Architecture

### 11.1 Adding a New Market

To add a new market (e.g., Brazil — `br`), the following steps are required. **No changes to any existing core module** should be necessary:

1. **MarketConfig record**: Add `marketId: 'br'`, language, currency, platform list, risk rules, preferred LLM provider.
2. **Platform fee structures**: Add fee data for each platform in the new market's list.
3. **Extraction scripts**: Implement `ExtractionScript` interface for any platforms not already covered.
4. **System prompt**: Author market-specific system prompt in `services/agent/prompts/br.prompt.ts`.
5. **UI locale**: Add `src/renderer/i18n/br.ts` with all translated strings.
6. **Test fixtures**: Add market-specific DOM fixtures and test suite in `tests/fixtures/br/`.
7. **Market config service**: Add `br` to the `MarketConfigService` registry.

### 11.2 Adding a New Platform to an Existing Market

1. Create `src/main/extraction/scripts/[platform-id]/` directory.
2. Implement `ExtractionScript` interface: `getNavigationTargets()`, `extractFromPage()`, `normalizeData()`.
3. Write unit tests using a DOM fixture snapshot (see `docs/guides/TESTER-GUIDE.md` Section 5).
4. Register in `ExtractionScriptRegistry`.
5. Add platform entry to the relevant market's config in `MarketConfigService`.
6. If the platform has fees, add to the fee table.
7. **No changes to ExtractionManager, PayloadBuilder, or Agent Service are required.**

### 11.3 Adding a New Agent Tool

1. Create `src/services/agent/tools/[tool-name].ts`.
2. Implement `Tool<TInput, TOutput>` interface with a pure `execute()` function.
3. Write unit tests achieving **100% branch coverage** (pure function = fully testable).
4. Register in `ToolRegistry`.
5. Add the tool's function-calling schema to the Executor's LLM prompt configuration.
6. Document in this file (Section 7.2) — architecture document is the canonical tool registry.
7. **No changes to Planner or Synthesizer are required.**

### 11.4 Future Pipeline Modules

**Sourcing Module** (Phase 2): Receives `ProductRecord[]` from Scout. Queries 1688.com / Alibaba supplier listings. Produces `SupplierQuote[]` attached to each `ProductRecord`.

**Listing Module** (Phase 2): Receives `ProductRecord[]` with `SupplierQuote[]`. Uses LLM to generate platform-optimized product listings. Produces `ListingDraft[]`.

**Campaign Module** (Phase 3): Receives `ProductRecord[]` with live listings. Generates ad strategy recommendations.

**Integration Rule**: Future modules must never import from `services/agent/` internals. They consume only the `ProductRecord` schema from `shared/types/`. The Scout module has no knowledge of downstream modules.

### 11.5 Browser Extension Path (v2)

If a browser extension variant is pursued (Electron → Chrome Extension), the architectural isolation of the Extraction Layer enables this migration:
- `ExtractionScript.extractFromPage()` contracts remain identical (both run in a page context).
- `ExtractionScript.normalizeData()` moves to service worker (extension background script).
- The `AnalysisPayload` contract to the backend is unchanged.
- The React Renderer can be reused as the extension popup/sidebar UI with minimal adaptation.

---

## 12. Non-Functional Targets

| Requirement | Target | Enforcement |
|---|---|---|
| Extraction time (all platforms) | < 3 min per session | Client-side per-platform timeout (45 sec), user can skip |
| Agent analysis latency (P95) | < 90 seconds | Backend SLA, Redis state caching |
| Client startup time | < 5 seconds | Bundle size budget, lazy module loading |
| Backend availability | 99.5% monthly uptime | Health checks, auto-restart, multi-AZ DB |
| Raw data retention | ≤ 1 hour from session end | Redis TTL + scheduled cleanup job |
| Extraction script failure rate | < 5% per platform | Monitoring alerts, fast patch SLA (24 hr) |
| JWT access token lifetime | 15 minutes | Configured in auth service |
| API response time (P95) | < 500 ms (excluding analysis) | Load testing gates in CI |
| LLM cost per analysis | < $0.05 target | Token budget enforcement, prompt optimization |
| Client binary size | < 150 MB installed | Bundle analysis in CI |

---

## 13. Deployment Architecture

### v1 Target Infrastructure

```
Client Distribution:
  Signed .exe (Windows 10+) and .dmg (macOS 12+) via GitHub Releases
  electron-updater: delta updates, signature verification, stable/beta channels

Backend:
  Container: Docker (Node.js 20 Alpine)
  Hosting:   AWS ECS Fargate (auto-scaling, no server management)
  Database:  AWS RDS PostgreSQL 16, Multi-AZ (99.5% SLA)
  Cache:     AWS ElastiCache Redis 7 (single-AZ for v1, upgrade on growth)
  CDN/TLS:   Cloudflare (TLS 1.3 termination, DDoS, rate limiting Layer 1)
  Secrets:   AWS Secrets Manager
  Logging:   CloudWatch Logs + Sentry
  
CI/CD Pipeline (GitHub Actions):
  PR:      Lint → TypeCheck → Unit Tests → Integration Tests → Build
  Merge:   Build Docker image → Push to ECR → Deploy to staging → Smoke tests
  Release: Tag → Promote staging → Deploy to production → E2E smoke → Monitor 15 min
```

### v2 Scaling Considerations

- **Agent Service** extracted to a standalone container if analysis concurrency exceeds ECS task limits.
- **China region deployment**: Separate AWS region (or Aliyun) with Qwen LLM provider for <300 ms LLM latency from CN.
- **MarketConfigService**: Extracted to a CDN-edge config endpoint as read traffic grows.
- **PostgreSQL read replicas**: Added when analytics query load separates from write load.

---

*Document owner: Architecture Team. All changes require PR review with `architecture` label. Last updated: 2026-03-15.*
