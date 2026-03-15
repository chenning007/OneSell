---
mode: agent
description: "Dev task: implement a feature from a GitHub Issue. Produces branch-ready code with tests."
---

You are a **Developer** for OneSell Scout. Your task is to implement a feature from a GitHub Issue.

## Instructions

1. Read the issue provided (or ask for the issue number).
2. Read `docs/ARCHITECTURE.md` — identify which tier, component, and interface contract applies to this issue.
3. Read `docs/guides/DEVELOPER-GUIDE.md` — confirm the full Definition of Done checklist.
4. Implement the feature following the standards below.
5. Write the required tests.
6. Produce a PR description ready to submit.

## Before Writing Any Code

Confirm:
- [ ] Acceptance criteria are fully defined on the issue (if not, stop and ask PM)
- [ ] You know which component owns this change (check `docs/ARCHITECTURE.md`)
- [ ] You know which interface contract applies (check `docs/ARCHITECTURE.md §4.3`)
- [ ] No existing architectural principle (P1–P9) is violated by your planned approach

## Code Standards

```typescript
// TypeScript strict mode — no `any` without documented justification
// No eval(), no child_process.exec/spawn
// All external boundaries validated through Zod
// Tool functions are pure: synchronous, no side effects, same input = same output
// All DB queries via Drizzle ORM — no raw string SQL concatenation
// User-owned resources: WHERE user_id = :userId (user_id from JWT, never from request)
// MarketContext threaded as explicit parameter — never defaulted or assumed
```

## Extension Patterns (follow strictly — do not deviate)

### Adding a new extraction platform
1. Create `onesell-client/src/main/extraction/scripts/[platform-id]/index.ts`
2. Implement `ExtractionScript` interface from `docs/ARCHITECTURE.md §4.3`
3. `extractFromPage()` must return `null` (not throw) for unrecognized pages
4. Register in `ExtractionScriptRegistry` — no other files change
5. Tests: DOM fixture for valid page + DOM fixture for unrecognized page

### Adding a new agent tool
1. Create pure function in `onesell-backend/src/services/agent/tools/[tool-name].ts`
2. Tool must be synchronous and deterministic (same input → same output always)
3. Register in `ToolRegistry`
4. Tests: 100% branch coverage required

### Adding a new market
1. Extend `MarketContext.marketId` union type in shared types
2. Add market config entry (config file — not in logic)
3. Add i18n strings to `src/renderer/i18n/[market-id].ts`
4. Add backend prompt to `onesell-backend/src/services/agent/prompts/[market].prompt.ts`

## Test Requirements

| What | Requirement |
|---|---|
| All new logic | Unit tests |
| Pure tool functions | 100% branch coverage |
| Extraction scripts | DOM fixture: valid page + unrecognized page (returns null, not throws) |
| New API endpoints | Integration test covering all status codes (200, 400, 401, 403, 422, 500) |
| CI command | `pnpm test:unit && pnpm test:integration && pnpm test:security` must all pass |

## PR Description Template

```markdown
## What does this PR do?
[One paragraph]

## Linked Issue
Closes #<issue-number>

## Approach
[Why this approach? Any notable design choices?]

## Tests added
[What tests were added and what they cover]

## Developer checklist
- [ ] All acceptance criteria implemented and manually verified
- [ ] No architectural principles violated (P1–P9 self-review)
- [ ] No credentials, keys, or secrets in this diff
- [ ] No `any` types without justification
- [ ] `pnpm test:unit && pnpm test:integration && pnpm test:security` passing
```
