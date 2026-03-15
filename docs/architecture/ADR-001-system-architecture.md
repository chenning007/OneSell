# ADR-001: Overall System Architecture — Client, Backend, Agent Boundaries

**Status**: Accepted  
**Date**: 2026-03-15  
**Author**: Architect  
**Linked Issue**: #3  
**PRD Reference**: Section 8 (Technical Architecture)

---

## Context

OneSell Scout requires a two-phase workflow: (1) structured market data collection from authenticated e-commerce platform sessions, and (2) autonomous LLM-powered analysis producing a ranked product shortlist. These two phases have fundamentally different runtime requirements.

Data collection requires running inside an authenticated browser session with full DOM access — a capability not available to a regular web app, PWA, or server-side scraper. Analysis requires server-side LLM API access with a private key and significant compute time (30–90 seconds).

A clear architectural boundary between these two concerns is essential for security (credentials must never reach the server), maintainability (platform DOM changes affect only extraction scripts), and extensibility (new markets and platforms are added as isolated modules).

---

## Decision

The system adopts a **two-tier architecture** with strict responsibility separation:

- **Client Tier** (Electron Desktop App): Owns all data collection. Runs an embedded Chromium browser (BrowserView) inside which users authenticate to platforms. Extraction scripts read the DOM and produce a structured JSON payload. No analysis or LLM work is performed on the client.

- **Backend Tier** (Cloud — structured monolith for v1): Owns all intelligence. Receives the structured payload from the client, runs the LLM agent pipeline (Planner → Executor → Synthesizer), and returns ranked product recommendation cards. Never interacts with external platforms; never receives user credentials.

The boundary between tiers is a single HTTPS endpoint (`POST /api/v1/analysis`) authenticated via JWT. The payload type is `AnalysisPayload` — a fully validated JSON document containing structured market data and user preferences, but zero authentication state.

---

## Options Considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| **Electron Desktop App** (chosen) | Full BrowserView access to authenticated sessions; no anti-bot friction since user is genuinely present; clear credential isolation | Requires desktop install; no mobile support in v1 | ✅ Chosen for v1 |
| Browser Extension | Lighter install; no desktop requirement | Restricted cross-origin DOM access; harder to maintain authenticated session state across tabs; weaker credential isolation model | ❌ Deferred to v2 evaluation |
| Server-side scraping | No client install required | Violates platform ToS; requires credential storage server-side (critical security risk); blocked by CAPTCHAs and anti-bot measures | ❌ Rejected |
| **Structured Monolith** (chosen for backend) | Fast iteration; single deployment unit; clean internal service boundaries | Must extract to microservices if agent concurrency exceeds single-process limits | ✅ v1 — microservice extraction path planned for v2 |
| Microservices from day 1 | Scales each component independently | Over-engineering for current team size and traffic; large operational overhead | ❌ Post-v1 |

---

## Tech Stack Decisions

| Layer | Technology | Rationale |
|---|---|---|
| Client runtime | Electron 30+ (Node.js 20+) | Only cross-platform solution providing a real Chromium context with user-authenticated sessions |
| Client UI | React 18 + TypeScript (strict) | Component model; i18n-ready; team familiarity |
| Client state | Zustand | Lightweight; no boilerplate; sufficient for session + results state |
| Client build | Vite + electron-builder | Fast builds; code-signed distributable |
| Browser engine | Electron BrowserView (Chromium) | Full rendering; user is genuinely present — no headless detection issues |
| Backend runtime | Node.js 20+ TypeScript | Uniform language across stack |
| Backend framework | Fastify | Low overhead; built-in schema validation; easy plugin architecture |
| Schema validation | Zod | Type-safe; runtime; composable; used at all boundaries |
| ORM | Drizzle ORM | Type-safe SQL; explicit queries; no magic |
| Database | PostgreSQL 16 | Relational + JSONB; 99.5% SLA via managed RDS |
| Cache / session | Redis 7 (TTL-based) | Ephemeral analysis state; auto-purge via TTL |
| LLM integration | Vercel AI SDK | Unified abstraction supporting OpenAI, Qwen, DeepSeek |
| LLM provider | OpenAI GPT-4o (default) | Best multi-language reasoning quality; CN market: Qwen preferred |
| Cloud | AWS (ECS Fargate + RDS + ElastiCache) | Managed scaling; Secrets Manager for key storage |

---

## System Topology

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT TIER  (Electron Desktop)                                 │
│                                                                  │
│  Renderer Process (React)                                        │
│  → IPC Bridge (contextBridge)                                    │
│  Main Process (Node.js)                                          │
│    ExtractionManager · PayloadBuilder · BackendClient            │
│  → IPC (script injection)                                        │
│  BrowserView (Chromium — isolated)                               │
│    ExtractionScript plugins per platform                         │
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTPS TLS 1.3
                           │  POST /api/v1/analysis  {AnalysisPayload}
                           │  Authorization: Bearer <JWT>
┌──────────────────────────▼───────────────────────────────────────┐
│  BACKEND TIER  (Cloud — Structured Monolith v1)                  │
│                                                                  │
│  API Gateway  (Fastify)                                          │
│    Auth · Rate Limit · Payload Validation · Correlation ID       │
│                                                                  │
│  Agent Service                                                   │
│    PlannerAgent (LLM) → ExecutorAgent (LLM + ToolRegistry)       │
│    → SynthesizerAgent (LLM) → ProductCard[]                      │
│                                                                  │
│  User Service  (Account · Prefs · Saved Lists)                   │
│  MarketConfigService  (Platforms · Fees · Risk Rules · Prompts)  │
│  SessionService  (Redis TTL state)                               │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  DATA TIER                                                       │
│  PostgreSQL 16  (users, prefs, sessions, saved_products)         │
│  Redis 7        (live session state — 1h TTL)                    │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  EXTERNAL                                                        │
│  OpenAI GPT-4o / Qwen / DeepSeek  (via Agent Service only)      │
│  Exchange Rate API  (cached in Redis 24h)                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Full Analysis Session — Sequence Diagram

```
User          Client (Renderer)   Client (Main/BrowserView)   Backend API   Agent Service   LLM API
 │                  │                       │                      │               │              │
 │  Opens app       │                       │                      │               │              │
 │─────────────────▶│                       │                      │               │              │
 │                  │                       │                      │               │              │
 │  Completes       │                       │                      │               │              │
 │  Wizard (6 steps)│                       │                      │               │              │
 │─────────────────▶│                       │                      │               │              │
 │                  │  marketContext set     │                      │               │              │
 │                  │  (immutable for        │                      │               │              │
 │                  │   remainder of session)│                      │               │              │
 │                  │                       │                      │               │              │
 │  Clicks "Connect"│                       │                      │               │              │
 │  on platform     │                       │                      │               │              │
 │─────────────────▶│  IPC: openBrowserView │                      │               │              │
 │                  │──────────────────────▶│                      │               │              │
 │                  │                       │                      │               │              │
 │  Logs in to      │                       │ BrowserView shows    │               │              │
 │  platform ───────│───────────────────────▶ platform login page  │               │              │
 │  (credentials    │                       │ (session cookie stays│               │              │
 │   stay in        │                       │  in BrowserView only)│               │              │
 │   BrowserView)   │                       │                      │               │              │
 │                  │                       │                      │               │              │
 │  Enters keyword, │                       │                      │               │              │
 │  clicks "Start   │                       │                      │               │              │
 │  Extraction"     │                       │                      │               │              │
 │─────────────────▶│  IPC: startExtraction │                      │               │              │
 │                  │──────────────────────▶│                      │               │              │
 │                  │                       │ navigates to URLs     │               │              │
 │                  │                       │ injects extraction    │               │              │
 │                  │                       │ scripts per platform  │               │              │
 │                  │                       │ extractFromPage()     │               │              │
 │                  │                       │ normalizeData()       │               │              │
 │                  │                       │                      │               │              │
 │  Progress screen │◀──────────────────────│  IPC: progress events │               │              │
 │  shows updates   │                       │                      │               │              │
 │                  │                       │                      │               │              │
 │                  │                       │ PayloadBuilder builds │               │              │
 │                  │                       │ AnalysisPayload (no  │               │              │
 │                  │                       │ credentials in payload)              │              │
 │                  │◀──────────────────────│  IPC: extractionComplete             │              │
 │                  │                       │                      │               │              │
 │  Clicks "Analyze │                       │                      │               │              │
 │  Now"            │                       │                      │               │              │
 │─────────────────▶│  IPC: submitAnalysis  │                      │               │              │
 │                  │──────────────────────▶│                      │               │              │
 │                  │                       │  POST /api/v1/analysis│               │              │
 │                  │                       │  Bearer <JWT>        │               │              │
 │                  │                       │  body: AnalysisPayload│               │              │
 │                  │                       │─────────────────────▶│               │              │
 │                  │                       │                      │ auth·validate  │              │
 │                  │                       │                      │ rate-limit     │              │
 │                  │                       │                      │ Zod schema     │              │
 │                  │                       │                      │ 202 sessionId  │              │
 │                  │                       │                      │ async dispatch │              │
 │                  │                       │◀─────────────────────│               │              │
 │                  │                       │                      │──────────────▶│              │
 │                  │                       │                      │               │ Planner LLM  │
 │                  │                       │                      │               │─────────────▶│
 │                  │                       │                      │               │ TaskPlan     │
 │                  │                       │                      │               │◀─────────────│
 │                  │                       │                      │               │              │
 │  Agent Analysis  │                       │  GET /status polling │               │ Executor:    │
 │  progress screen │◀──────────────────────│──────────────────────│ step updates  │ tool calls   │
 │                  │                       │                      │               │ (deterministic
 │                  │                       │                      │               │  pure fns)   │
 │                  │                       │                      │               │              │
 │                  │                       │                      │               │ Synthesizer  │
 │                  │                       │                      │               │─────────────▶│
 │                  │                       │                      │               │ ProductCard[]│
 │                  │                       │                      │               │◀─────────────│
 │                  │                       │                      │               │              │
 │                  │                       │  GET /results        │ validated      │              │
 │                  │                       │──────────────────────│ ProductCard[] │              │
 │                  │                       │◀─────────────────────│               │              │
 │                  │◀──────────────────────│  IPC: results        │               │              │
 │  Results screen  │                       │                      │               │              │
 │  (5–10 cards)    │                       │                      │               │              │
```

---

## Consequences

### What This Enables
- **Privacy by design**: User credentials physically cannot reach the backend — they exist only within the BrowserView process.
- **Independent evolution**: Platform extraction scripts update without touching backend; LLM provider can be swapped without touching client.
- **Market extensibility**: Adding a market requires a config entry + extraction scripts + LLM prompt — no core code changes.
- **Clear security perimeter**: The `AnalysisPayload` boundary is the single point to audit for credential leakage.

### What This Constrains
- **Desktop-only for v1**: Mobile and tablet users cannot use the product. Addressed in v2 via browser extension evaluation.
- **Electron install friction**: Users must install a ~100 MB app. Mitigated by signed one-click installers.
- **LLM latency on backend**: 30–90s analysis time is required. Mitigated by async polling pattern and progress UI.
- **Extraction script maintenance**: Platform DOM changes require fast script updates. Mitigated by versioned plugin architecture and extraction failure monitoring.

---

## Compliance

This decision is enforced by:
1. **Code review**: Any PR that moves LLM calls to the client, or authentication to the server, is rejected.
2. **Security test** (`tests/security/credential-handling.test.ts`): Scans every built `AnalysisPayload` for credential-shaped fields.
3. **Architecture principles P1 and P2** in `docs/ARCHITECTURE.md` are the canonical reference for reviewers.
4. **CI audit**: Client binary is scanned for embedded secrets before every release build.
