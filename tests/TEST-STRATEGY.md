# OneSell Scout — Master Test Strategy

**Version**: 1.0  
**Date**: 2026-03-15  
**Owner**: Tester Role  
**Covers**: v0.3 (Milestone M0 Foundation → M1+)  
**Reference**: `docs/ARCHITECTURE.md` v1.0, `docs/PRD-Product-Selection-Module.md`  
**GitHub Issue**: #8

---

## 1. Purpose

This document defines the master test strategy for OneSell Scout. It governs what is tested, how it is tested, in which environments, and what constitutes a pass. All feature-level test plans are derived from this strategy and must conform to its standards.

Testing is triggered exclusively by GitHub Issues (`type:test` or feature issues moving to `In Review`). No test work begins without a linked issue.

---

## 2. Test Scope Per Epic

| Epic | What Is Tested | Categories Required |
|---|---|---|
| `epic:foundation` | Repo setup, architecture artefacts, CI pipeline, test framework wiring | Contract, Security (P9 baseline) |
| `epic:wizard` | Steps 1–6 UI flows, `MarketContext` creation and immutability, preference storage | Unit, Integration, E2E, Contract (P4) |
| `epic:extraction` | `ExtractionScript` implementations per platform, `ExtractionManager`, `PayloadBuilder`, IPC handlers | Unit, Contract, Security (P1, P2, P6) |
| `epic:agent` | Planner → Executor → Synthesizer pipeline, `ToolRegistry` tools, `LLMProvider` abstraction, output validation | Unit (100% tools), Integration, Security (P3, P9) |
| `epic:results-ui` | `ProductCard` rendering, drill-down, tier-gated content, market language output | Unit, E2E, Accessibility |
| `epic:china` | CN market: Taobao/JD/1688/Pinduoduo extraction, Qwen/DeepSeek LLM provider, CN prompt, CNY currency | Unit, Integration, E2E, Contract (P4, P8) |
| `epic:security-nfr` | Credential containment, JWT integrity, RBAC, rate limiting, prompt injection, SQL injection, output sanitisation | Security (all areas — zero tolerance) |
| `epic:monetization` | Tier enforcement, rate limit counters, result depth gating, export access | Integration, Security (P9) |

---

## 3. Test Categories

### 3.1 Unit Tests — Pure Functions and Isolated Components

**Location**: `tests/unit/`  
**Tool**: Vitest  
**Coverage target**: 100% branch coverage for tool functions; ≥95% for schema validators

Applies to:
- All 7 agent tool functions (`calc_margin`, `rank_competition`, `score_trend`, `flag_beginner_risk`, `compare_products`, `estimate_cogs`, `get_platform_fees`)
- All Zod schema validators
- All `ExtractionScript.normalizeData()` implementations
- `MarketContext` immutability enforcement
- Zustand store reducers

Rules:
- No network calls; no live LLM calls; no real credentials in fixtures
- Market-specific tests use only the matching market's fixtures and context

### 3.2 Integration Tests — Component Boundaries

**Location**: `tests/integration/`  
**Tool**: Vitest + supertest (backend); Vitest + Electron test utilities (client)  
**Coverage target**: All endpoints, all defined HTTP status codes

Applies to:
- All 9 backend API endpoints (auth, analysis, user, markets)
- Agent pipeline (Planner → Executor → Synthesizer) with mocked `LLMProvider`
- Database queries via Drizzle ORM against a test PostgreSQL instance
- Redis key operations (session storage, TTL, rate limit counters)
- IPC message flows (client main ↔ renderer)
- `PayloadBuilder` producing valid `AnalysisPayload` from extraction results

### 3.3 Contract Tests — Interface Conformance

**Location**: `tests/unit/contracts/`  
**Tool**: Vitest

Applies to:
- `AnalysisPayload`: schema conformance, no credential fields
- `ExtractionScript` interface: all implementations expose correct method signatures
- `ProductRecord`: output conformance from agent pipeline
- IPC message types: all channels validated against registered Zod schemas
- `ExtractionManager`: adding a new script registration requires zero changes to `ExtractionManager` source (P6)

### 3.4 Security Tests

**Location**: `tests/security/`  
**Tool**: Vitest + custom assertions  
**Tolerance**: **Zero failures** — all must pass on every CI run

See Section 6 for the full security test matrix.

### 3.5 E2E Tests

**Location**: `tests/e2e/`  
**Tool**: Playwright  
**Trigger**: Nightly pipeline + release candidates (not per-PR)

Covers:
- Wizard flow Steps 1–6 (happy path per market: US, CN, SEA)
- Data source connection and extraction trigger
- Progress polling and results display
- Saved products list

### 3.6 Performance Tests

**Location**: `tests/e2e/performance/`  
**Tool**: Playwright + timing assertions

Targets (non-functional requirements from `docs/ARCHITECTURE.md §12`):
- App cold-start to interactive: **< 3 seconds**
- Extraction per platform: **< 30 seconds**
- Agent analysis completion: **< 60 seconds** (p95)
- Results page render: **< 500 ms** after data received

### 3.7 Accessibility Tests

**Location**: `tests/e2e/accessibility/`  
**Tool**: Playwright + axe-core  
**Standard**: WCAG 2.1 AA

Covers: Wizard, Results, Saved lists, Error states

---

## 4. Test Environments

| Environment | Purpose | Database | LLM | Extraction | Trigger |
|---|---|---|---|---|---|
| **Local** | Developer and tester dev loop | Local PostgreSQL + Redis (Docker Compose) | Mock `LLMProvider` | DOM fixture snapshots | Manual |
| **CI** | PR gate — every PR to `main` | Ephemeral PostgreSQL + Redis (GitHub Actions services) | Mock `LLMProvider` | DOM fixture snapshots | Auto on push/PR |
| **Staging** | Pre-release validation | Staging cloud DB | Real LLM (limited quota) | Live BrowserView (manual only) | Manual on release branch |
| **Production** | Post-release smoke test | Production (read-only smoke) | Real LLM | Not run | Manual post-deploy |

**Critical rules for all environments:**
- Unit and integration tests **never make live network requests**
- **No real user credentials** appear in any fixture file
- CI environment secrets are managed via GitHub Actions secrets — never committed to source

---

## 5. Entry and Exit Criteria Per Milestone

### M0 — Foundation

**Entry**: Architecture design issues (#3, #4, #5, #6) moved to `Done`  
**Exit**:
- [ ] `tests/TEST-STRATEGY.md` committed and approved (this document)
- [ ] Test framework (Vitest + Playwright) installed and producing a passing empty run in CI
- [ ] Security test scaffolding in place (`tests/security/`)
- [ ] No P0/P1 open bugs in M0

### M1 — Wizard + Extraction MVP

**Entry**: M0 exit criteria met; all M1 `role:dev` issues merged  
**Exit**:
- [ ] All M1 acceptance criteria verified
- [ ] Unit tests for `ExtractionScript` implementations (all platforms): 100% coverage of happy path + unrecognised page
- [ ] Contract test: `PayloadBuilder` output is valid `AnalysisPayload` (no credentials)
- [ ] E2E: wizard flow completes without error (US market)
- [ ] Security: P1 credential containment test passes

### M2 — Agent + Results

**Entry**: M1 exit criteria met; all M2 `role:dev` issues merged  
**Exit**:
- [ ] All 7 agent tools at 100% branch coverage
- [ ] Integration: agent pipeline end-to-end with mocked LLM (all 7 markets)
- [ ] Contract: Synthesizer output validates against `ProductCard[]` schema
- [ ] Security: full security test matrix passes (all areas, zero failures)
- [ ] E2E: results display (happy path, US and CN markets)
- [ ] Performance: agent analysis < 60s p95

### Release (vX.Y)

**Entry**: All P0/P1 `type:test` issues in milestone are `Done`; Tester sign-off posted  
**Exit**: PM confirms release gate; `release/vX.Y` branch created; GitHub Release published

---

## 6. Security Test Matrix (Zero Tolerance)

| # | Area | Test | Expected Result |
|---|---|---|---|
| S1 | Credential containment (P1) | Build `AnalysisPayload` from any platform fixture and scan all fields recursively for `password`, `token`, `cookie`, `session_id`, `auth` | Zero matching fields found |
| S2 | JWT — tampered token | Send request with modified JWT payload | 401 Unauthorized |
| S3 | JWT — expired token | Send request with expired access token | 401 Unauthorized |
| S4 | JWT — no token | Send request to protected endpoint without Authorization header | 401 Unauthorized |
| S5 | Cross-user RBAC (P9) | User A's valid JWT requests User B's session or saved products | 403 Forbidden |
| S6 | Rate limit enforcement | Exceed tier analysis quota | 429 Too Many Requests (server-side) |
| S7 | Oversized payload | Send payload > 5 MB to `POST /analysis` | 413 Payload Too Large |
| S8 | Prompt injection | Submit keyword containing `\n\nIgnore all previous instructions` | Input sanitised; no injection in prompt |
| S9 | SQL injection surface | Submit input containing `'; DROP TABLE users; --` | No error leakage; data safe via ORM parameterisation |
| S10 | LLM output schema violation (P3) | Mock Synthesizer returns output with extra numeric field not in `ProductCard` schema | Zod rejects response; error logged; not sent to client |
| S11 | Error response hygiene | Trigger a 500 error deliberately | Response uses `ErrorResponse` shape; no stack trace, no DB error, no internal path |
| S12 | IPC credential channel (P1) | Attempt to register or send `auth:credentials` IPC message type | Channel rejected; error logged |
| S13 | BrowserView sandbox | Attempt Node.js API access from BrowserView context | Access denied; sandbox enforced |

---

## 7. Bug Severity Definitions (Aligned with P0–P3 Labels)

| Label | Severity | Meaning | Resolution Requirement |
|---|---|---|---|
| `P0` | **Critical — Security** | Credential leak, LLM key exposure, SQL injection surface, broken auth, any S1–S13 security test failure | Blocks merge immediately — fix before all other work |
| `P1` | **High — Architectural violation** | Numbers generated by LLM directly (P3), mutable `MarketContext` (P4), missing Zod validation (P9), wrong tier responsibility (P2), contract breach | Fix before merge |
| `P2` | **Medium — Functional defect** | Acceptance criterion not met, wrong output, graceful degradation failure (P5), incorrect rate limit | Fix in same sprint |
| `P3` | **Low — Quality gap** | Missing coverage on non-critical path, incomplete fixture, minor UI inconsistency | Fix in next sprint |

---

## 8. CI Pipeline Gates

All of the following must pass before any PR can merge to `main`:

```
1. lint           — zero warnings (ESLint + Prettier check)
2. typecheck      — zero type errors (tsc --noEmit, strict mode)
3. unit           — all pass; tool function branch coverage = 100%
4. integration    — all pass (ephemeral DB + Redis)
5. security       — all pass (zero failures permitted)
6. build          — onesell-client and onesell-backend build successfully
```

E2E and performance tests run on the **nightly pipeline** and on **release candidates** — not on every PR.

---

## 9. Test Artefact Conventions

### Fixture Files

- DOM fixtures: `tests/fixtures/[platform-id]/[page-type]-v[version].html`  
- API response fixtures: `tests/fixtures/api/[endpoint]-[scenario].json`  
- LLM mock outputs: `tests/fixtures/llm/[agent-step]-[market]-[scenario].json`
- All fixture data is **synthetic** — no real product data, no real credentials, no real user PII

### Market Isolation in Fixtures

- US market fixtures: `tests/fixtures/[platform-id]/us/`
- CN market fixtures: `tests/fixtures/[platform-id]/cn/`
- SEA market fixtures: `tests/fixtures/[platform-id]/sea/`
- Fixtures must never be shared across markets

### Test File Naming

```
tests/unit/[module-name]/[function-name].test.ts
tests/integration/[service-name]/[endpoint].test.ts
tests/security/[area].security.test.ts
tests/e2e/[flow-name].e2e.ts
```

---

## 10. Architectural Principle → Test Mapping

| Principle | Test Location | Category | Milestone |
|---|---|---|---|
| P1 — Credentials never leave client | `tests/security/credential-containment.security.test.ts` | Security | M1 |
| P2 — Client collects; backend analyses | `tests/unit/contracts/ipc-handlers.contract.test.ts` | Contract | M1 |
| P3 — Numbers from deterministic tools only | `tests/security/llm-output-schema.security.test.ts` | Security | M2 |
| P4 — MarketContext immutable | `tests/unit/contracts/market-context.contract.test.ts` | Unit/Contract | M1 |
| P5 — Graceful degradation | `tests/unit/[component]/partial-data.test.ts` (per component) | Unit | M1+ |
| P6 — Extraction scripts isolated | `tests/unit/contracts/extraction-script-registry.contract.test.ts` | Contract | M1 |
| P7 — Extensible pipeline | `tests/integration/pipeline/product-record.contract.test.ts` | Contract | M2 |
| P8 — Config over hardcoding | CI grep scan: no hardcoded market IDs or fee values in `src/` | Static analysis | M0/CI |
| P9 — Security by default | `tests/security/` (full suite) | Security | M2 |

---

*This document is owned by the Tester role. Changes require a new version comment on issue #8 and Architect review for changes to Sections 6 or 8.*
