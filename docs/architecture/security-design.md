# OneSell Scout — Security Design Document

**Version**: 1.0
**Author**: Architecture Team
**Date**: 2026-03-17
**Status**: AUTHORITATIVE — All implementation and testing must conform to this document.
**References**: `docs/ARCHITECTURE.md` §9, `docs/PRD-Product-Selection-Module.md`
**Issue**: Closes #56

---

## Table of Contents

1. [Threat Model (STRIDE Analysis)](#1-threat-model-stride-analysis)
2. [Credential Containment (P1)](#2-credential-containment-p1)
3. [TLS 1.3 Enforcement](#3-tls-13-enforcement)
4. [LLM API Key Isolation](#4-llm-api-key-isolation)
5. [Data Retention & TTL Enforcement](#5-data-retention--ttl-enforcement)
6. [Input Validation (Zod at Every Boundary)](#6-input-validation-zod-at-every-boundary)
7. [Injection Prevention](#7-injection-prevention)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Existing Security Tests](#9-existing-security-tests)
10. [Residual Risks & Mitigations](#10-residual-risks--mitigations)

---

## 1. Threat Model (STRIDE Analysis)

### 1.1 System Boundaries

```
┌──────────────────────────────────────────────────────────┐
│  CLIENT (Electron)                                       │
│  ┌──────────┐  IPC  ┌───────────┐  IPC  ┌────────────┐  │
│  │ Renderer │◄─────►│   Main    │◄─────►│ BrowserView│  │
│  │ (React)  │       │ (Node.js) │       │ (Chromium)  │  │
│  └──────────┘       └─────┬─────┘       └────────────┘  │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │ HTTPS / TLS 1.3
                            │ Bearer JWT
┌───────────────────────────▼──────────────────────────────┐
│  BACKEND (Fastify)                                       │
│  API Gateway → Agent Service → LLM Provider              │
│       ↕              ↕                                   │
│  PostgreSQL        Redis                                 │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼ Outbound HTTPS
                    External LLM APIs
                    (OpenAI, Qwen, DeepSeek)
```

### 1.2 Trust Boundaries

| Boundary | ID | What Crosses |
|---|---|---|
| Renderer ↔ Main Process | TB-1 | IPC messages (Zod-validated) |
| Main Process ↔ BrowserView | TB-2 | Extraction script injection, DOM data return |
| Client ↔ Backend | TB-3 | `AnalysisPayload` (credential-stripped), JWT |
| Backend ↔ PostgreSQL | TB-4 | Parameterized SQL via Drizzle ORM |
| Backend ↔ Redis | TB-5 | Ephemeral session JSON (TTL-bound) |
| Backend ↔ LLM APIs | TB-6 | Sanitized prompts, raw LLM responses (schema-validated before use) |

### 1.3 STRIDE Threat Matrix

| Category | Threat | Target | Severity | Mitigation | Status |
|---|---|---|---|---|---|
| **Spoofing** | Attacker forges JWT to impersonate a user | TB-3 | Critical | RS256 asymmetric signing; public key verification only. Private key in AWS Secrets Manager (prod) / env (dev). 15-min access token expiry limits replay window. | ✅ Implemented — [auth.ts](../../onesell-backend/src/api/middleware/auth.ts) |
| **Spoofing** | Attacker reuses stolen refresh token | TB-3 | High | 7-day refresh tokens with rotation-on-use. Revoked tokens rejected. | ✅ Implemented — [auth.ts](../../onesell-backend/src/api/middleware/auth.ts) |
| **Spoofing** | Attacker manipulates IPC messages from a compromised renderer | TB-1 | High | All IPC channels Zod-validated in main process before processing. contextBridge exposes a fixed API surface — no arbitrary IPC. | ✅ Implemented — [handlers.ts](../../onesell-client/src/main/ipc/handlers.ts), [preload.ts](../../onesell-client/src/main/preload.ts) |
| **Tampering** | Attacker modifies `AnalysisPayload` in transit | TB-3 | High | TLS 1.3 encryption in transit. HMAC-SHA256 `X-OneSell-Signature` request signing (ARCHITECTURE §5.3). Zod validation server-side. | ✅ TLS + Zod implemented; HMAC signing planned |
| **Tampering** | Attacker modifies LLM response to inject false data | TB-6 | High | All LLM output parsed against `ProductCard[]` Zod schema. Numerical fields cross-validated against deterministic tool results (P3). Malformed output triggers retry → error, never raw passthrough. | ✅ Implemented — Agent pipeline output validation |
| **Tampering** | SQL injection via malicious input | TB-4 | Critical | Drizzle ORM parameterized queries exclusively. No raw SQL concatenation. Lint rule bans `sql.raw()`. | ✅ Implemented — [schema.ts](../../onesell-backend/src/db/schema.ts) |
| **Repudiation** | User denies performing an analysis | TB-3 | Low | All requests carry `x-correlation-id` (UUID v4). Auth events logged (login, refresh, failed attempts). Session metadata persisted to PostgreSQL. | ✅ Implemented — [validation.ts](../../onesell-backend/src/api/middleware/validation.ts) |
| **Information Disclosure** | Platform credentials leak to backend | TB-3 | Critical | `stripCredentials()` recursively removes 7 credential-pattern keys from payload before transmission. BrowserView sandboxed (`sandbox: true`). Preload exposes zero credential APIs. | ✅ Implemented — [PayloadBuilder.ts](../../onesell-client/src/main/extraction/PayloadBuilder.ts) |
| **Information Disclosure** | LLM API key embedded in client binary | Client binary | Critical | `OPENAI_API_KEY` env var validated only in backend [env.ts](../../onesell-backend/src/env.ts). Client has no reference to LLM keys. CSP blocks client-side LLM calls. Pre-release binary audit required. | ✅ Implemented |
| **Information Disclosure** | Redis data persists beyond retention window | TB-5 | Medium | TTL enforced on every `SET`: payload=1h, results=1h, status=2h. No `PERSIST` calls in codebase. Purge cron as defense-in-depth. | ✅ Implemented — [redis.ts](../../onesell-backend/src/services/redis.ts) |
| **Information Disclosure** | Cross-user data access | TB-4 | Critical | Every PostgreSQL query for user-owned resources enforces `WHERE user_id = :userId` from JWT claim. | ✅ Implemented — schema + repository pattern |
| **Denial of Service** | Volumetric request flood | TB-3 | High | Redis sliding-window rate limiting — tier-based (free=10, starter=30, pro=60, business=120/min). 1MB payload size guard. 5MB max at transport. | ✅ Implemented — [rate-limit.ts](../../onesell-backend/src/api/middleware/rate-limit.ts), [validation.ts](../../onesell-backend/src/api/middleware/validation.ts) |
| **Denial of Service** | Oversized payload / extraction data bomb | TB-3 | Medium | Client PayloadBuilder enforces 5MB limit before send. Server `bodySizeHook` rejects >1MB. | ✅ Implemented |
| **Denial of Service** | LLM cost attack via large prompts | TB-6 | Medium | LLM token budget limit enforced per request in Agent Service. Rate limiting bounds total requests. | ✅ Architecture §9.4 |
| **Elevation of Privilege** | JWT `tier` claim manipulation | TB-3 | High | `tier` claim is set server-side during token generation. JWTs signed with RS256 private key. Tier checked server-side for every gated operation. | ✅ Implemented — [auth.ts](../../onesell-backend/src/api/middleware/auth.ts) |
| **Elevation of Privilege** | Prompt injection via user input | TB-6 | High | `sanitizeUserInput()` strips 10 known injection patterns. User inputs placed only in sandboxed `[USER_INPUT]` slots — never in system prompt body. | ✅ Implemented — [prompt-loader.ts](../../onesell-backend/src/services/agent/prompt-loader.ts) |

---

## 2. Credential Containment (P1)

**Invariant**: User platform credentials (passwords, tokens, cookies, session IDs) must **never** leave the client machine.

### 2.1 Enforcement Points

```
BrowserView (Chromium sandbox)
       │ DOM data only (no credentials in ExtractionScript output)
       ▼
Main Process — ExtractionManager
       │ Raw extraction data
       ▼
PayloadBuilder.stripCredentials()      ← Defense-in-depth: recursive key stripping
       │ Clean AnalysisPayload
       ▼
IPC Validation (Zod schemas)           ← Schema rejects unexpected fields
       │
       ▼
BackendClient → HTTPS POST             ← Only AnalysisPayload crosses the wire
```

### 2.2 Layer-by-Layer Controls

| Layer | Control | Implementation |
|---|---|---|
| **BrowserView** | `sandbox: true` — no Node.js APIs, no filesystem, no network access outside page context. Extraction scripts are pure DOM readers. | Electron BrowserView config |
| **ExtractionScript interface** | `extractFromPage()` returns `RawPlatformData \| null` — a typed contract with no credential fields. Scripts that access `document.cookie` or similar are rejected in code review. | [ExtractionScript interface](../../docs/ARCHITECTURE.md) §4.3 |
| **PayloadBuilder.stripCredentials()** | Recursively walks the entire payload object tree. Any key matching `password`, `token`, `cookie`, `credential`, `secret`, `auth`, or `session` (case-insensitive) is dropped. | [PayloadBuilder.ts](../../onesell-client/src/main/extraction/PayloadBuilder.ts) — `CREDENTIAL_KEYS` set |
| **PayloadBuilder.build()** | Calls `stripCredentials()` on the assembled payload before size check. Returns only the cleaned copy. | [PayloadBuilder.ts](../../onesell-client/src/main/extraction/PayloadBuilder.ts) |
| **IPC validation** | All IPC handlers validate incoming args against Zod schemas. The `analysisSubmitSchema` defines exactly which fields are accepted — credential fields have no slot. | [handlers.ts](../../onesell-client/src/main/ipc/handlers.ts) |
| **Preload (contextBridge)** | Exposes a fixed, narrow API surface: `extraction.*`, `payload.*`, `analysis.*`. No credential-reading or credential-forwarding APIs exist. | [preload.ts](../../onesell-client/src/main/preload.ts) |
| **CSP (Renderer)** | `Content-Security-Policy: default-src 'self'; script-src 'self'` — prevents loaded pages from exfiltrating data via injected scripts. | Electron webPreferences |
| **AnalysisPayload type** | The TypeScript interface has no optional credential fields. Type-checking catches accidental additions at compile time. | `onesell-client/src/shared/types/AnalysisPayload.ts` |

### 2.3 Verification

- **Security test S1**: Strips credential-shaped keys at top level and nested levels — [credential-containment.security.test.ts](../../onesell-client/tests/security/credential-containment.security.test.ts)
- **Security test S7**: Rejects payloads exceeding 5MB size limit
- **Code review gate**: Any PR touching `PayloadBuilder`, `preload.ts`, or IPC handlers requires Architect sign-off

---

## 3. TLS 1.3 Enforcement

### 3.1 Enforcement Plan

| Component | TLS Configuration | Responsible Layer |
|---|---|---|
| **Client → Backend** | TLS 1.3 minimum. TLS 1.2 and below rejected. | Load balancer / reverse proxy (Cloudflare, AWS ALB, or nginx) |
| **Backend → PostgreSQL** | TLS required (`sslmode=require` in connection string) | `DATABASE_URL` env var config |
| **Backend → Redis** | TLS if Redis is remote (`rediss://` URI scheme) | `REDIS_URL` env var config |
| **Backend → LLM APIs** | TLS enforced by provider (OpenAI, Qwen, DeepSeek all require HTTPS) | LLM provider SDK default |

### 3.2 HSTS Configuration

Applied at the load balancer or reverse proxy:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age=31536000` — browsers remember HTTPS-only for 1 year
- `includeSubDomains` — covers `api.onesell.app` and any future subdomains
- `preload` — eligible for browser HSTS preload lists

### 3.3 Fastify HTTPS (Direct Deployment Option)

If Fastify terminates TLS directly (dev/self-hosted), configure:

```typescript
import Fastify from 'fastify';
import { readFileSync } from 'node:fs';

const fastify = Fastify({
  https: {
    key: readFileSync('/path/to/private.key'),
    cert: readFileSync('/path/to/certificate.crt'),
    minVersion: 'TLSv1.3',        // Reject TLS 1.2 and below
    ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256',
  },
});
```

### 3.4 Electron Client TLS

The Electron app's `BackendClient` uses `fetch()` / `net.request()` which inherits Chromium's TLS stack. Chromium enforces TLS 1.2+ by default. Combined with server-side TLS 1.3 minimum enforcement, the connection is TLS 1.3.

**Certificate pinning** is recommended for production builds to prevent MITM via compromised CAs. Implementation via Electron's `session.setCertificateVerifyProc()`.

---

## 4. LLM API Key Isolation

### 4.1 Architecture

```
CLIENT (Electron)                     BACKEND (Fastify)
┌─────────────────┐                  ┌──────────────────────┐
│ No LLM keys     │   AnalysisPayload│  OPENAI_API_KEY      │
│ No LLM SDK      │ ────────────────►│  (env.ts only)       │
│ No LLM calls    │   JWT auth       │        ↓             │
│                 │                  │  AgentService        │
│ CSP blocks      │                  │  → LLMProvider       │
│ external API    │                  │  → OpenAI/Qwen API   │
│ calls           │                  └──────────────────────┘
└─────────────────┘
```

### 4.2 Enforcement Points

| Control | How | Verification |
|---|---|---|
| **Backend-only env var** | `OPENAI_API_KEY` defined in `envSchema` in [env.ts](../../onesell-backend/src/env.ts). Process exits if missing. Client package has no such env var. | `grep -r 'OPENAI_API_KEY' onesell-client/` must return zero results |
| **No LLM SDK in client** | `onesell-client/package.json` must not list `openai`, `@ai-sdk/*`, or any LLM SDK as a dependency. | Package audit in CI |
| **CSP in Renderer** | `default-src 'self'` prevents the renderer from making any external HTTP requests, including to `api.openai.com`. | CSP header enforcement |
| **Client binary audit** | Pre-release: `grep -r 'sk-' dist/` must return zero results. Any match is a release blocker. | Release checklist item (ARCHITECTURE §9.3) |
| **LLMProvider abstraction** | All LLM calls go through [LLMProvider](../../onesell-backend/src/services/agent/) interface in the backend Agent Service. No alternative call path exists. | Architecture review |

### 4.3 Key Rotation

- Production: LLM API key stored in AWS Secrets Manager with automatic rotation
- The backend reads the key at startup via `env.ts`; redeployment picks up rotated keys
- Key rotation does not require client updates (client never has the key)

---

## 5. Data Retention & TTL Enforcement

### 5.1 Redis TTL Enforcement Points

All TTLs are set atomically with the `SET ... EX` command — there is no window where data exists without a TTL.

| Data | Redis Key Pattern | TTL | Set In | Purpose |
|---|---|---|---|---|
| Analysis payload | `session:{id}:payload` | **3600s (1h)** | `storePayload()` | Raw extraction data — most sensitive, shortest life |
| Analysis results | `session:{id}:results` | **3600s (1h)** | `storeResults()` | Computed `ProductCard[]` — ephemeral |
| Session status | `session:{id}:status` | **7200s (2h)** | `setStatus()` | Progress tracking — slightly longer for polling |
| Market config cache | `market:config:{market}` | 21600s (6h) | `cacheMarketConfig()` | Public config — no PII |
| Fee cache | `market:fees:{market}:{platform}` | 86400s (24h) | `cacheFeeStructure()` | Public fee data — no PII |
| Exchange rate cache | `exchange-rate:{from}:{to}:{date}` | 86400s (24h) | `cacheExchangeRate()` | Public data — no PII |
| Rate limit counter | `ratelimit:{userId}:{weekISO}` | **604800s (7d)** | `incrementRateLimit()` | Auto-expires at week boundary |
| Sliding window rate limit | `ratelimit:sliding:{userId}:{endpoint}` | **60s** | `checkRateLimit()` | Per-minute window cleanup |

Source: [redis.ts](../../onesell-backend/src/services/redis.ts), [rate-limit.ts](../../onesell-backend/src/api/middleware/rate-limit.ts)

### 5.2 No-PERSIST Rule

The codebase must **never** call `redis.persist()` on session keys. This would remove the TTL and cause data to live indefinitely. This is enforced by:

1. **Code review**: Any `persist()` call is a rejection in PR review
2. **Grep check in CI**: `grep -r 'persist' onesell-backend/src/services/redis.ts` must not match `redis.persist()`

### 5.3 Defense-in-Depth: Purge Job

A scheduled purge job runs every 6 hours to sweep up any keys that may have lost their TTL due to Redis bugs or operational errors:

```
Schedule: every 6 hours
Action:   SCAN for session:*:payload, session:*:results, session:*:status
          Delete any key with TTL = -1 (no expiry) or age > 4 hours
Log:      "[PurgeJob] Deleted N orphaned session keys"
```

This job is defense-in-depth — under normal operation, TTLs handle all expiry.

### 5.4 PostgreSQL Retention

| Data | Retention | Mechanism |
|---|---|---|
| User account | Until deletion | Cascading delete removes all child records |
| User preferences | Until deletion | `ON DELETE CASCADE` from users |
| Session metadata | 2 years | Soft delete on account closure |
| Saved products | Until user deletes | User-controlled |
| Raw extraction data | **Never stored** | Only in Redis (1h TTL) — never written to PostgreSQL |

**Invariant**: Raw platform extraction data from user sessions is never persisted to PostgreSQL. Any feature proposal that stores raw extraction data permanently requires architecture review.

---

## 6. Input Validation (Zod at Every Boundary)

### 6.1 Validation Boundary Map

```
User Input (keyboard, wizard)
       │
       ▼
[TB-1] IPC Boundary ← Zod validation in handlers.ts
       │
       ▼
[TB-3] API Boundary ← Zod validation via validateBody() middleware
       │
       ▼
[TB-4] Database ← Drizzle ORM typed schemas (no raw SQL)
       │
[TB-6] LLM Output ← Zod schema validation before dispatch to client
```

### 6.2 Boundary Details

| Boundary | Validation | Schema Location | Rejection |
|---|---|---|---|
| **IPC (Renderer → Main)** | Every `ipcMain.handle()` parses args with Zod before processing | [handlers.ts](../../onesell-client/src/main/ipc/handlers.ts) — `platformIdSchema`, `payloadBuildArgsSchema`, `analysisSubmitSchema`, `analysisIdSchema` | Exception thrown → IPC error returned to renderer |
| **API (Client → Backend)** | `validateBody(schema)` pre-handler on every POST/PUT route | [validation.ts](../../onesell-backend/src/api/middleware/validation.ts) — per-route schemas | HTTP 400 with `{ error: 'Validation failed', details: [...] }` |
| **Payload size** | `bodySizeHook` rejects `Content-Length > 1MB` | [validation.ts](../../onesell-backend/src/api/middleware/validation.ts) | HTTP 413 `Payload too large` |
| **Client-side payload** | `PayloadBuilder.build()` enforces 5MB limit | [PayloadBuilder.ts](../../onesell-client/src/main/extraction/PayloadBuilder.ts) | Exception thrown — prevents oversized payloads from being sent |
| **LLM output** | `ProductCard[]` Zod schema parse; numerical cross-validation against tool results | Agent pipeline — Synthesizer output validation | Retry once → graceful error (never raw LLM output to client) |
| **Database** | Drizzle ORM typed schema; all queries parameterized | [schema.ts](../../onesell-backend/src/db/schema.ts) | Query-level type errors caught at compile time |
| **Environment variables** | `envSchema` Zod validation at startup | [env.ts](../../onesell-backend/src/env.ts) | `process.exit(1)` — backend refuses to start with invalid config |

### 6.3 CORS

Configured in [validation.ts](../../onesell-backend/src/api/middleware/validation.ts):

- Origins: allowlist from `CORS_ORIGIN` env var (Electron app origin + optional web dashboard)
- Methods: `GET, POST, PUT, DELETE, PATCH, OPTIONS`
- Allowed headers: `Content-Type, Authorization, x-correlation-id`
- Credentials: enabled

---

## 7. Injection Prevention

### 7.1 SQL Injection

**Control**: Drizzle ORM parameterized queries — no raw SQL string concatenation anywhere in the codebase.

**Implementation**: [schema.ts](../../onesell-backend/src/db/schema.ts) defines all tables. All queries use Drizzle's query builder which automatically parameterizes values.

**Verification**:
- `grep -r 'sql.raw\|\.execute(' onesell-backend/src/` must not reveal unparameterized queries
- Code review gate: any raw SQL usage requires Architect approval

### 7.2 Prompt Injection

**Control**: `sanitizeUserInput()` in [prompt-loader.ts](../../onesell-backend/src/services/agent/prompt-loader.ts) strips 10 known injection patterns before any user text is interpolated into prompts.

**Patterns stripped** (replaced with `[FILTERED]`):

| Pattern | What It Catches |
|---|---|
| `system:` | System role override attempts |
| `ignore previous/above/all instructions` | Instruction reset attacks |
| `you are now` | Role reassignment |
| `forget everything/all/your` | Memory wipe attacks |
| `new instructions:` | Instruction injection |
| `override:` | Override declarations |
| `act/behave as` | Role-play exploitation |
| `` ```system `` | Markdown-formatted system override |
| `<\|im_start\|>system` | ChatML system tag injection |
| `<system>` | XML-style system tag injection |

**Additional architectural guard**: User inputs are placed only in designated `[USER_INPUT]` slots in prompt templates — never directly in the system prompt body. This limits the blast radius of any bypass.

### 7.3 XSS Prevention

| Surface | Control |
|---|---|
| **React Renderer** | React auto-escapes all interpolated values by default. `dangerouslySetInnerHTML` is banned — any usage is a code review rejection. |
| **CSP** | `Content-Security-Policy: default-src 'self'; script-src 'self'` — no inline scripts, no external script sources, no `eval()`. |
| **API responses** | LLM-generated text in `ProductCard` is Zod-validated. No HTML is permitted in card fields — only plain text strings. |

### 7.4 Command Injection

**Control**: No `child_process` usage permitted anywhere in the codebase. No `eval()`, no `Function()` constructor, no `vm.runInContext()` outside test infrastructure.

**Verification**: CI lint rule bans these patterns. `grep -r 'child_process\|eval(\|new Function' onesell-backend/ onesell-client/src/` must return zero results.

---

## 8. Authentication & Authorization

### 8.1 Authentication Flow

```
Client                   Backend
  │                        │
  │  POST /auth/login      │
  │  { email, password }   │
  │───────────────────────►│
  │                        │  bcrypt.compare(password, hash)
  │                        │  cost factor ≥ 12
  │  { accessToken,        │
  │    refreshToken }      │
  │◄───────────────────────│  RS256 signed
  │                        │
  │  GET /analysis/:id     │
  │  Authorization: Bearer │
  │───────────────────────►│
  │                        │  verifyToken() → RS256 verify
  │                        │  Check type === 'access'
  │                        │  Extract userId + tier
  │  { results }           │
  │◄───────────────────────│
  │                        │
  │  POST /auth/refresh    │
  │  { refreshToken }      │
  │───────────────────────►│
  │                        │  Verify refresh token
  │  { newAccessToken,     │  Rotate: issue new refresh
  │    newRefreshToken }   │  Invalidate old refresh
  │◄───────────────────────│
```

### 8.2 Token Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Algorithm | RS256 | Asymmetric — public key verification only on API servers; private key isolated |
| Access token TTL | 15 minutes | Short-lived limits replay attack window |
| Refresh token TTL | 7 days | User convenience balanced with security |
| Refresh rotation | On every use | Limits stolen refresh token utility |
| Password hashing | bcrypt, cost ≥ 12 | Industry standard; resistant to GPU brute-force |

Source: [auth.ts](../../onesell-backend/src/api/middleware/auth.ts)

### 8.3 Authorization Invariants

1. **User isolation**: Every query for user-owned data (`user_preferences`, `analysis_sessions`, `saved_products`) includes `WHERE user_id = :userId` from the JWT `sub` claim. No API endpoint returns another user's data.
2. **Tier enforcement**: Analysis count limits and feature gates (export, drill-down, API access) checked server-side from the JWT `tier` claim — never trusted from the client.
3. **Rate limiting**: Per-user, per-endpoint, per-tier sliding window — [rate-limit.ts](../../onesell-backend/src/api/middleware/rate-limit.ts).

### 8.4 Rate Limiting Configuration

| Tier | Requests/min | Enforcement |
|---|---|---|
| Free | 10 | Redis sorted set sliding window |
| Starter | 30 | Redis sorted set sliding window |
| Pro | 60 | Redis sorted set sliding window |
| Business | 120 | Redis sorted set sliding window |

**Graceful degradation (P5)**: If Redis is unavailable, rate limiting is bypassed and the request is allowed. This prevents Redis outages from causing a full service outage.

---

## 9. Existing Security Tests

### 9.1 Test Inventory

| Test File | Coverage | Principle |
|---|---|---|
| [credential-containment.security.test.ts](../../onesell-client/tests/security/credential-containment.security.test.ts) | S1: credential stripping (top-level, nested); S7: 5MB size limit rejection | P1 |
| `middleware-auth.test.ts` | JWT validation, expired token rejection, missing header, invalid type | P9 |
| `middleware-rate-limit.test.ts` | Sliding window counting, tier-based limits, Redis failure graceful degradation | P5, P9 |
| `middleware-validation.test.ts` | Zod rejection, 413 payload limit, correlation ID, CORS | P9 |
| `routes-auth.test.ts` | Login/register/refresh flows, bcrypt verification | P9 |
| `db-schema.test.ts` | Schema structure, cascading deletes, user isolation constraints | P9 |
| `redis-helpers.test.ts` | TTL enforcement, key patterns, graceful degradation | P5 |

### 9.2 Recommended Additional Tests

| Area | Test Case | Priority |
|---|---|---|
| LLM key isolation | `grep` client dist for `sk-` or `OPENAI_API_KEY` | P0 |
| Prompt injection | `sanitizeUserInput()` coverage for all 10 patterns | P1 |
| Cross-user access | API test: user A cannot GET user B's sessions/results | P0 |
| TLS enforcement | Integration test: reject non-TLS connections | P1 |
| Preload surface area | Assert `contextBridge` exposes only expected APIs | P1 |
| BrowserView sandbox | Assert `sandbox: true` in BrowserView config | P1 |

---

## 10. Residual Risks & Mitigations

| Risk | Severity | Current Status | Planned Mitigation |
|---|---|---|---|
| Novel prompt injection patterns bypass `sanitizeUserInput()` | Medium | 10 patterns covered | Expand pattern list; add LLM-based injection detection as a second layer; monitor for anomalous outputs |
| Electron auto-updater supply chain attack | Medium | Code-signing verification on | Pin update server certificate; add update integrity hash verification |
| Redis data exposed if Redis instance is compromised | Medium | TTL limits exposure window | Enable Redis AUTH + TLS (`rediss://`); encrypt sensitive session data at rest in Redis |
| JWT private key compromise | High | AWS Secrets Manager + env isolation | Implement key rotation procedure; add JWT `jti` claim for per-token revocation capability |
| Rate limit bypass via distributed IPs (unauthenticated endpoints) | Low | Auth endpoints rate-limited by IP | Add CAPTCHA or proof-of-work for registration; implement IP reputation scoring |
| DOM extraction scripts could be modified by a compromised page | Low | BrowserView sandbox isolates | Content Security Policy for BrowserView; integrity checks on injected scripts |

---

*This document is maintained by the Architecture team. Changes require an ADR and Architect approval. Security is part of the Definition of Done for every feature.*
