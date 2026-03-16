# Architecture Review Skill

## Purpose
Perform a structured architectural compliance review of code changes against the 9 OneSell Scout architectural principles (P1–P9). Use this skill when reviewing a PR, a diff, a file, or any code change that needs architecture verification.

## When to Use
- Reviewing PRs touching security boundaries, API contracts, extraction interface, agent pipeline, or DB schema
- Verifying a new platform extraction script follows the plugin pattern
- Checking that a new feature conforms to interface contracts
- Pre-merge security review

## Process

### Step 1 — Gather Context
Read `docs/ARCHITECTURE.md` sections §1 (Principles), §4.3 (Interface Contracts), and §9 (Security Architecture).

### Step 2 — Review the Diff
For each file changed, check:

**Principles Checklist**
- **P1** — No credentials, session tokens, or cookies leave the client in any IPC or API payload
- **P2** — Extraction/collection logic in client only; analysis/scoring in backend only
- **P3** — All numeric outputs from deterministic pure tool functions; LLM produces only reasoning text
- **P4** — `MarketContext` threaded as immutable, typed, explicit parameter; never defaulted or mutated
- **P5** — All data-consuming functions handle empty/partial `platformData` without throwing
- **P6** — New platforms added as isolated plugins; `ExtractionManager` unchanged
- **P7** — New pipeline modules consume `ProductRecord[]` only; Scout internals untouched
- **P8** — No market IDs, platform names, or fee values hardcoded in logic
- **P9** — Zod validation at every boundary; parameterized queries only; no eval/shell

**Interface Contracts**
- `AnalysisPayload` — no credential fields; all required fields present; Zod-validated at backend
- `ExtractionScript` — all methods implemented; `extractFromPage` returns `null` (not throws) on unrecognized pages
- `ProductRecord` — all required fields present; `estimatedMargin` is `0.0–1.0` float
- `MarketContext` — `marketId` from defined union; object is `readonly`

**Security**
- No secrets in the diff
- No `eval()` or `child_process` anywhere in source (not tests)
- All user inputs validated through Zod
- LLM outputs schema-validated before dispatch
- `WHERE user_id = :userId` in all user-owned resource queries (from JWT, not request body)

### Step 3 — Produce Report
Output a structured findings table:

```markdown
## Architectural Review Report

**Target**: [PR number or file path]
**Date**: [today]

### Summary
PASS / FAIL / CONDITIONAL

### Findings
| Check | Result | Notes |
|---|---|---|
| P1 | ✅/❌ | |
| P2 | ✅/❌ | |
...

### Required Changes
1. [specific action]

### ADR Required?
Yes / No
```
