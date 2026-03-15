<!-- 
  M0 FOUNDATION ISSUES — paste each block as a separate GitHub Issue.
  After running bootstrap-labels.sh:
    1. Go to https://github.com/chenning007/OneSell/issues/new
    2. Select the matching template (feature / design / test-plan)
    3. Or use GitHub CLI: gh issue create --repo chenning007/OneSell --title "..." --body-file m0-XX.md --label "role:dev,epic:foundation,P0,type:chore" --milestone "M0 — Foundation"
  
  All 8 M0 issues must be in "Ready" state before any agent starts work.
-->

---

## ISSUE M0-1 · [Architect] Define database schema — users, sessions, saved products

**Labels**: role:architect, epic:foundation, P0, type:design  
**Milestone**: M0 — Foundation  
**Assignee**: (Architect agent)

### Problem Statement
The backend requires a PostgreSQL schema before any User Service or Agent Service implementation can begin. The schema must cover user accounts, analysis sessions (ephemeral), and saved product lists.

### Options Considered
| Option | Pros | Cons |
|---|---|---|
| Single `users` table with JSONB blobs | Fast to start | Hard to query, no type safety |
| Normalized tables (chosen) | Type-safe, queryable, Drizzle-friendly | Slightly more upfront work |

### Decision
(Architect fills in when resolved)

### Output Artifacts
- [ ] `onesell-backend/src/db/schema.ts` — Drizzle ORM schema definitions
- [ ] `onesell-backend/migrations/0001_initial.sql` — initial migration
- [ ] ADR-001 committed to `docs/architecture/ADR-001-database-schema.md`
- [ ] ADR index updated
- [ ] Dependent issues #M0-3 and #M0-4 unblocked

---

## ISSUE M0-2 · [Architect] Define market config data structure and US market seed

**Labels**: role:architect, epic:foundation, P0, type:design  
**Milestone**: M0 — Foundation  
**Assignee**: (Architect agent)

### Problem Statement
Architectural Principle P8 requires markets, platforms, and fee structures to be data (config), not code. The structure of this config must be defined before any market-aware component (wizard, extraction, agent) can be implemented.

### Decision
(Architect fills in)

### Output Artifacts
- [ ] `onesell-backend/src/services/market/config/markets.ts` — typed market config structure
- [ ] `onesell-backend/src/services/market/config/us.market.ts` — US market seed data (platforms, fees, categories)
- [ ] ADR-002 committed — `docs/architecture/ADR-002-market-config-structure.md`
- [ ] Dependent issues #M0-4, #M1-wizard unblocked

---

## ISSUE M0-3 · [Dev] Implement database schema and Drizzle ORM setup

**Labels**: role:dev, epic:foundation, P0, type:chore  
**Milestone**: M0 — Foundation  
**Assignee**: (Dev agent)  
**Blocked by**: #M0-1 (schema design must be approved)

### Context
Scaffold the PostgreSQL database layer using Drizzle ORM. This must match the schema approved in ADR-001.

### Acceptance Criteria
- [ ] `onesell-backend/src/db/schema.ts` defines `users`, `user_preferences`, `analysis_sessions`, `saved_products` tables using Drizzle ORM types
- [ ] `onesell-backend/src/db/index.ts` exports a typed `db` client connected via `DATABASE_URL` env var
- [ ] `pnpm db:generate` produces a migration file with no errors
- [ ] `pnpm db:migrate` runs cleanly against the Docker Compose Postgres instance
- [ ] All queries in the db module use parameterized calls — no raw SQL string concatenation
- [ ] A `SELECT 1` health check query is used in `/healthz` endpoint to verify DB connectivity

### Architecture Reference
`docs/ARCHITECTURE.md §8` — Data Architecture

---

## ISSUE M0-4 · [Dev] Implement backend environment config and health endpoint

**Labels**: role:dev, epic:foundation, P0, type:chore  
**Milestone**: M0 — Foundation  
**Assignee**: (Dev agent)

### Context
The backend `src/env.ts` already has Zod environment validation scaffolded. This issue wires it into the Fastify app with full plugin registration, CORS, and a health endpoint used by CI.

### Acceptance Criteria
- [ ] `GET /healthz` returns `{ status: 'ok', version: string }` with HTTP 200
- [ ] `GET /healthz` returns `{ status: 'degraded', db: false }` with HTTP 503 if PostgreSQL is unreachable
- [ ] `GET /healthz` returns `{ status: 'degraded', redis: false }` with HTTP 503 if Redis is unreachable
- [ ] CORS plugin configured: only `CORS_ORIGIN` env var is allowed as origin
- [ ] All environment variables validated at startup via `src/env.ts`; invalid env causes process exit with clear error message
- [ ] An integration test covers all three /healthz response states

### Architecture Reference
`docs/ARCHITECTURE.md §5.1` — API endpoints; `§6.1` — Backend structure

---

## ISSUE M0-5 · [Dev] Implement Fastify JWT auth middleware (RS256)

**Labels**: role:dev, epic:foundation, P0, type:feature  
**Milestone**: M0 — Foundation  
**Assignee**: (Dev agent)  
**Blocked by**: #M0-3

### Context
All protected routes require JWT authentication using RS256. This issue implements the auth middleware and the `/auth/register` + `/auth/login` + `/auth/refresh` endpoints.

### Acceptance Criteria
- [ ] `POST /auth/register` creates a user record; returns `{ accessToken, refreshToken }`
- [ ] `POST /auth/login` validates credentials; returns `{ accessToken, refreshToken }`; returns HTTP 401 for invalid credentials
- [ ] `POST /auth/refresh` issues a new access token; rotates the refresh token; returns HTTP 401 for expired/invalid refresh tokens
- [ ] Access tokens: RS256 signed, 15-minute expiry
- [ ] Refresh tokens: stored in DB, 7-day expiry, single-use rotation enforced
- [ ] `auth` Fastify middleware rejects requests without valid Bearer token with HTTP 401
- [ ] Passwords hashed with bcrypt (cost factor ≥ 12) — never stored in plaintext
- [ ] Unit tests cover: valid token, expired token, wrong signature, missing token
- [ ] Integration tests cover: full register → login → refresh cycle

### Architecture Reference
`docs/ARCHITECTURE.md §5.3` — Transport security; `§9` — Security Architecture

---

## ISSUE M0-6 · [Dev] Implement Redis-backed rate limiting middleware

**Labels**: role:dev, epic:foundation, P0, type:feature  
**Milestone**: M0 — Foundation  
**Assignee**: (Dev agent)  
**Blocked by**: #M0-3

### Context
Rate limits are tier-based and enforced server-side via Redis counters. This issue implements the rate limit middleware that all API routes use.

### Acceptance Criteria
- [ ] Rate limits enforced per user (from JWT) using Redis sliding window counters
- [ ] Free tier: 1 analysis/week; Starter: 5/week; Pro/Business: unlimited
- [ ] `POST /analysis` returns HTTP 429 with `{ error: 'rate_limit_exceeded', retryAfter: number }` when limit reached
- [ ] Rate limit remaining count returned in `X-RateLimit-Remaining` response header
- [ ] Enforcement is server-authoritative — client display is informational only
- [ ] Integration test covers: under limit (200), at limit (200), over limit (429)

### Architecture Reference
`docs/ARCHITECTURE.md §5.2` — Rate limiting by tier

---

## ISSUE M0-7 · [Tester] Write test plan for M0 Foundation (auth + health + DB)

**Labels**: role:tester, epic:foundation, P0, type:test  
**Milestone**: M0 — Foundation  
**Assignee**: (Tester agent)  
**Covers**: #M0-3, #M0-4, #M0-5, #M0-6

### Scope
Test plan covering the M0 Foundation backend: database schema correctness, health endpoint, JWT auth, and rate limiting. Must be authored before M0-5 and M0-6 implementation is complete.

### Test Cases
(Tester fills in using the test plan template from .github/ISSUE_TEMPLATE/test-plan.yml)

### Architectural Principle Verification
- P9 — Security: passwords never in plaintext; tokens RS256; refresh token rotation; missing-auth returns 401
- P5 — Graceful degradation: /healthz degrades cleanly when DB/Redis unreachable

---

## ISSUE M0-8 · [PM] Create M1 sprint issues from PRD §5 (Preference Wizard)

**Labels**: role:pm, epic:wizard, P0, type:chore  
**Milestone**: M0 — Foundation  
**Assignee**: (PM agent)  
**Blocked by**: #M0-1, #M0-2 (architecture must be approved before M1 issues are created)

### Context
Once M0 architecture decisions (ADR-001, ADR-002) are human-approved, PM must translate PRD §5 (the 6-step Preference Wizard) into fully-formed M1 GitHub Issues with acceptance criteria, and move them to Ready.

### Acceptance Criteria
- [ ] All 6 wizard step features exist as `type:feature role:dev` issues in M1 milestone
- [ ] Each issue has full acceptance criteria (each criterion observable and independently testable)
- [ ] Each issue references the relevant PRD section and ARCHITECTURE.md component
- [ ] Corresponding `type:test` issues created for each wizard step feature
- [ ] All issues in `Ready` state (not Backlog)
- [ ] `needs-human-signoff` label removed after human PM reviews the issue set
