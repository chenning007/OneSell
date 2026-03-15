# OneSell Scout — Developer Guide

**Audience**: All engineers (human and AI developer agents) implementing features and fixes for OneSell Scout.  
**Version**: 1.1 | **Date**: 2026-03-15  
**Managed by**: Architect — changes to this guide require architect review.

---

## 1. Before You Write Any Code — Read These First

Understanding context before coding is not optional. A developer who codes without reading the documents below will produce work that conflicts with the product vision, the architecture, or other contributors' work.

### Required Reading (in order)

| Document | Location | What You Need to Understand |
|---|---|---|
| **Project Management Guide** | [`docs/PROJECT-MANAGEMENT.md`](../PROJECT-MANAGEMENT.md) | Role boundaries, issue lifecycle, Definition of Done, branching conventions |
| **PRD** | [`docs/PRD-Product-Selection-Module.md`](../PRD-Product-Selection-Module.md) | What is being built, for whom, and why — every acceptance criterion traces back here |
| **Architecture** | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | System topology, component contracts, architectural principles (P1–P9), security model, extension patterns |
| **Tester Guide** | [`docs/guides/TESTER-GUIDE.md`](TESTER-GUIDE.md) | How your code will be tested — read this so you write code that is testable by contract |

> **Do not skip the Architecture document.** It defines the interface contracts your code must conform to and the 9 architectural principles that are enforced at review. An implementation that violates those principles is rejected regardless of how correct the logic is.

---

## 2. How to Pick Up Work

All work lives in [GitHub Issues](https://github.com/chenning007/OneSell/issues). There is no valid work outside of issues.

### Finding Your Next Task

1. Go to the GitHub Issues board and filter by **`role:dev`**.
2. Further filter by status **`Ready`** — these issues have been fully groomed by PM and unblocked by Architect. Do not start issues still in `Backlog` or `Blocked`.
3. Within `Ready`, pick by priority label: **`P0` → `P1` → `P2` → `P3`**.
4. If two issues share the same priority, prefer the one in the current sprint's milestone.

### Starting an Issue

1. **Assign yourself** on GitHub.
2. **Move the issue to `In Progress`** on the project board.
3. **Create a branch** following the naming convention:
   - New feature: `feature/<issue-number>-short-description`
   - Bug fix: `fix/<issue-number>-short-description`
4. Post a comment on the issue confirming you have started and noting your branch name.

### If You Are Blocked

Add the `blocked` label to the issue immediately. Post a comment explaining exactly what is blocking you and mention `@PM` or `@Architect` as appropriate. Do not silently stay stuck. Do not pick up a different task without logging the block first.

---

## 3. How to Understand What to Build

Every issue has **Acceptance Criteria** written by PM. These are the exact outputs the tester will verify. Before writing code, read the acceptance criteria and confirm:

- You understand every criterion without ambiguity.
- You know which component in the architecture owns this behaviour (check `docs/ARCHITECTURE.md`).
- You know which interface contract applies to your change.
- The PRD section referenced in the issue gives you enough detail on expected behaviour.

If any criterion is ambiguous, post a clarifying question as a comment on the issue and tag `@PM`. Do not assume — assumptions produce rework.

### Mapping an Issue to Architecture

For each issue, identify in `docs/ARCHITECTURE.md`:

- **Which tier** is affected: Client (Electron), Backend (API/Agent), or Shared types?
- **Which component** owns the change: ExtractionManager, AgentService, UserService, ToolRegistry, UI module, etc.?
- **Which interface contract** your code must conform to — every contract is defined in the Architecture document.
- **Which extension pattern** applies — Section 11 of the Architecture document covers adding platforms, markets, tools, and pipeline modules step by step.

If the issue requires a change that does not fit any existing extension pattern, stop. Post an architectural question on the issue and tag `@Architect` before proceeding. New patterns require architecture review.

---

## 4. Development Standards

### Architectural Principles Are Non-Negotiable

Nine principles (P1–P9) are defined in `docs/ARCHITECTURE.md` Section 1. Every one applies to every line of code. Violations are blocking defects at review:

- Credentials must never leave the client.
- Client collects data; backend analyses it — never cross this boundary.
- Quantitative values come from deterministic tool functions, not LLM output.
- `MarketContext` is an immutable, explicit parameter — always threaded, never assumed.
- New platforms, markets, and tools are added via plugin/config — never as code branches in core logic.

### Code Quality Baseline

- **TypeScript strict mode** (`"strict": true`) everywhere — no `any` types without a documented justification.
- **Zod validation** at every external boundary: API inputs/outputs, IPC messages, LLM responses before use.
- **Tool functions are pure** — same input always produces same output; no side effects; no async.
- **No shell execution** (`child_process.exec/spawn`) — banned with no valid use case in this codebase.
- **No `eval()`** in any process.

### Security Is Part of Every Task

- No credentials, API keys, or secrets in any committed file.
- All user-provided input passes through Zod validation before use.
- All database queries use ORM parameterized calls — no raw string concatenation.
- LLM-produced text is schema-validated before being sent to any client.
- User-owned resources are always filtered by `userId` from the authenticated JWT — never by user-supplied ID alone.

---

## 5. Definition of Done for a Developer

An issue is **not done** when the code works. It is done when all of the following are true.

### Code Completeness
- [ ] All acceptance criteria on the issue are implemented and manually verified.
- [ ] Implementation conforms to the interface contracts defined in `docs/ARCHITECTURE.md`.
- [ ] No architectural principles are violated (self-review against P1–P9).
- [ ] Configuration over code: no hardcoded market identifiers, platform names, or fee values in logic.
- [ ] Graceful degradation: new code handles partial or missing data without crashing.

### Testing
- [ ] Unit tests written for all new logic.
- [ ] Tool functions (pure functions) have **100% branch coverage** — no exceptions.
- [ ] Extraction scripts have DOM fixture tests covering at minimum: a valid page and an unrecognized page (must return `null`, not throw).
- [ ] An integration test exists for any new API endpoint covering all meaningful status codes.
- [ ] All existing tests pass: `pnpm test:unit && pnpm test:integration && pnpm test:security`.

### Security
- [ ] No secrets or credentials in the diff.
- [ ] No `eval()` or shell execution added.
- [ ] All new user inputs validated through Zod before use.
- [ ] LLM outputs schema-validated before dispatch to any client.
- [ ] `WHERE user_id = :userId` present in all queries for user-owned resources.

### PR Hygiene
- [ ] Branch follows naming convention: `feature/<issue#>-name` or `fix/<issue#>-name`.
- [ ] PR description includes `Closes #<issue-number>`.
- [ ] PR description covers: what changed, why, the approach taken, and what tests were added.
- [ ] CI pipeline passes: lint → typecheck → unit → integration → security → build.
- [ ] Self-reviewed the diff for obvious issues before requesting review.

---

## 6. Submitting Work for Review

### Opening the Pull Request

1. Push your branch and open a PR against `main`.
2. Write the PR description covering:
   - **What**: one paragraph summarising the change.
   - **Why**: link to the issue and the acceptance criteria being addressed.
   - **How**: a note on the approach taken, especially any non-obvious design choices.
   - **Testing**: what tests were added and what they cover.
3. Add `Closes #<issue-number>` so the issue auto-closes on merge.
4. Move the issue to **`In Review`** on the project board.
5. Post a comment on the issue: summarise what was built, confirm your Definition of Done checklist is complete, and note any areas you want the tester to focus on. This comment is the **tester's trigger** to begin verification.
6. Request review from a peer developer. If the change touches architecture boundaries or shared interface contracts, also request `@Architect`.

### Code Review Expectations

- Reviewers check: correctness, architectural compliance, security baseline, test coverage.
- Address all review comments before re-requesting review. Disagreements go in the PR thread — never silently ignored.
- The tester verifies acceptance criteria after the developer review approves. Do not merge until the tester posts `✅ QA passed`.

### After Merge

- Move the issue to **`Done`** on the project board.
- Delete your feature branch.
- If your change introduced a new architectural pattern or decision, update `docs/ARCHITECTURE.md` via a separate `docs/<issue#>-name` PR.

---

## 7. Cooperating with Other Roles

### With PM

- PM owns acceptance criteria. If criteria are unclear or contradictory, ask on the issue — do not interpret and proceed.
- PM does not make implementation decisions. If PM requests a specific technical approach that conflicts with architecture, surface this with `@Architect`.
- PM reviews the PR for product correctness (does it match the acceptance criteria) — not for code quality.

### With Architect

- Architect owns interface contracts, component boundaries, and security invariants.
- Any change that modifies or extends a shared interface in `src/shared/types/` requires architect review before merge.
- If an issue demands breaking an architectural principle, open an architecture decision record first — there is no shortcut.

### With Testers

- Testers write tests against your component's **public interface contract**, not your internal implementation. Write code that honours its contract cleanly.
- Do not modify test fixture files in `tests/fixtures/`. If a DOM structure change requires a new fixture, notify the tester who owns that platform's suite.
- Treat tester-raised defects as blocking: **P0 (security) and P1 (architectural violation) block merge; P2 defects must be resolved in the same sprint**.
- Read `docs/guides/TESTER-GUIDE.md` — knowing what the tester will verify helps you write testable code.

---

## 8. Quick Reference

| What | Where |
|---|---|
| Architecture, contracts, extension patterns | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Product requirements and acceptance criteria source | [`docs/PRD-Product-Selection-Module.md`](../PRD-Product-Selection-Module.md) |
| Issue lifecycle, Definition of Done, branching | [`docs/PROJECT-MANAGEMENT.md`](../PROJECT-MANAGEMENT.md) |
| Test strategy, fixture patterns, security tests | [`docs/guides/TESTER-GUIDE.md`](TESTER-GUIDE.md) |
| Open issues for developer role | [GitHub Issues — role:dev](https://github.com/chenning007/OneSell/issues?q=label%3Arole%3Adev) |
| Extraction script plugin pattern | `docs/ARCHITECTURE.md` — Section 11.2 |
| Agent tool plugin pattern | `docs/ARCHITECTURE.md` — Section 11.3 |
| Market config extension | `docs/ARCHITECTURE.md` — Section 11.1 |
| Future pipeline modules (Sourcing, Listing) | `docs/ARCHITECTURE.md` — Section 11.4 |

---

*Document owner: Architect. Changes require architect review and a `docs/` PR. Last updated: 2026-03-15.*
