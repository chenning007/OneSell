# OneSell Scout — Tester Guide

**Audience**: All QA engineers and AI tester agents writing test plans, executing tests, and signing off on features for OneSell Scout.  
**Version**: 1.1 | **Date**: 2026-03-15  
**Managed by**: Architect — changes to this guide require architect review.

---

## 1. Before You Test Anything — Read These First

Testing without context produces tests that verify the wrong things. Read all four documents before performing any test work on an issue.

### Required Reading (in order)

| Document | Location | What You Need to Understand |
|---|---|---|
| **Project Management Guide** | [`docs/PROJECT-MANAGEMENT.md`](../PROJECT-MANAGEMENT.md) | Role boundaries, issue lifecycle, Definition of Done, QA sign-off gate |
| **PRD** | [`docs/PRD-Product-Selection-Module.md`](../PRD-Product-Selection-Module.md) | What the product must do and why — acceptance criteria trace back here |
| **Architecture** | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Interface contracts, architectural principles (P1–P9), security model — these define what testers must verify |
| **Developer Guide** | [`docs/guides/DEVELOPER-GUIDE.md`](DEVELOPER-GUIDE.md) | What developers are expected to deliver and how — read this to understand the developer's Definition of Done |

> **The Architecture document defines what is correct.** Acceptance criteria define what the feature does. The architecture defines how it must do it  including security, contract conformance, and graceful degradation. Tests must verify both.

---

## 2. How Testing Is Triggered by Issues

Testing is **always triggered by a GitHub Issue**, never started arbitrarily. There are two trigger types:

### Trigger 1  Test Plan Issue (proactive)

The PM creates a `type:test` issue for each epic or significant feature, **before implementation is complete**. This issue is assigned `role:tester` and contains:
- A description of the feature being tested
- A link to the related `type:feature` issue and its acceptance criteria
- The milestone it belongs to

When you pick up a `type:test` issue:
1. Read the linked feature issue and its acceptance criteria.
2. Read the relevant sections of `docs/ARCHITECTURE.md` for the components being tested.
3. Author the test plan directly in the issue as a comment  covering test scope, categories, pass criteria, and anything the developer must provide (fixtures, stubs, etc.).
4. Move the issue to `In Progress`.

The test plan authored on a `type:test` issue becomes the binding specification for what tests are written. It must be done before the developer completes implementation so that any testability gaps can be surfaced early.

### Trigger 2  Feature Issue Moves to `In Review`

When a developer completes an implementation and moves an issue to **`In Review`**, that is the tester's trigger to execute tests against the delivered work. The developer must:
- Post a comment on the issue summarising what was built, what branch/PR to review, and any specific areas to focus on.
- Confirm their own Definition of Done checklist is complete.

The tester then:
1. Reviews the PR diff and the linked test plan (from the `type:test` issue, if one exists).
2. Executes tests against the acceptance criteria.
3. Raises `type:bug` issues for every failure found (see Section 6).
4. Posts ` QA passed` on the feature issue when all acceptance criteria pass  this is the **only gate** that allows an issue to move to `Done`.

If no `type:test` issue was created before the feature was built, the tester writes the test plan anyway  but flags this as a process violation in the issue comment.

---

## 3. How to Pick Up Test Work

### Finding Your Next Task

1. Go to GitHub Issues and filter by **`role:tester`**.
2. Look for two states:
   - **`Ready`**  test plan issues waiting to be authored.
   - Feature issues (any type) that have just moved to **`In Review`**  these need execution.
3. Prioritise by label: **`P0`  `P1`  `P2`  `P3`**.
4. Assign yourself and move to `In Progress` before starting.

### Handing Off to the Developer

If during test planning you discover a testability gap  a component has no observable public interface, a contract is undefined, or an acceptance criterion is impossible to verify  post the gap as a comment on the issue and tag `@Architect`. Do not write tests for untestable specifications. Architect resolves the gap before testing proceeds.

---

## 4. How to Understand What to Test

### Acceptance Criteria Are the Test Specification

Every `role:dev` issue has acceptance criteria written by PM. Each criterion becomes one or more test cases. For each criterion, ask:
- What is the observable output when this criterion is met?
- What is the observable output when it is violated?
- Which component in the architecture is responsible for this behaviour?

Map each criterion to the architecture component it exercises (check `docs/ARCHITECTURE.md`). This tells you which test category applies (unit, integration, contract, security, E2E).

### Architectural Principles Convert to Test Requirements

The 9 architectural principles (P1–P9) in `docs/ARCHITECTURE.md` Section 1 are not just developer rules — they are **test requirements**. Every principle that can be violated must have a corresponding test that detects the violation:

| Principle | Corresponding Test Requirement |
|---|---|
| P1  Credentials never leave the client | Security test: scan any `AnalysisPayload` built by the client for credential-shaped fields |
| P2  Client collects; backend analyses | Contract test: verify no analysis logic (scoring, LLM calls) exists in client IPC handlers |
| P3  Numbers from deterministic tools only | Integration test: LLM output schema validation rejects any unsanctioned numerical field |
| P4  MarketContext is immutable | Unit test: market-sensitive functions with a mutated context produce errors or explicit failures |
| P5  Graceful degradation | Unit/integration test: every component handles empty or partial input without throwing |
| P6  Extraction scripts are isolated plugins | Contract test: adding a script does not require changes to `ExtractionManager` |
| P9  Security by default | Security test suite: auth, injection, RBAC, output sanitisation (see Section 7) |

---

## 5. Testing Standards

### Test the Contract, Not the Implementation

Tests verify that a component behaves according to its **interface contract**  not that it uses a specific internal algorithm. This keeps tests durable through refactors.

- A test that asserts a specific private method was called is fragile.
- A test that asserts the correct output is produced for a given input is durable.

The interface contracts are all defined in `docs/ARCHITECTURE.md`. When in doubt about what to test, look at the contract, not the code.

### Market Isolation Is Mandatory

Tests must remain **market-isolated**:
- US market tests use US market context and US fixtures  never CN or SEA fixtures.
- CN market tests must produce output in Simplified Chinese where the contract specifies it.
- Mixing fixture data across markets is a defect, not a shortcut.

### The Three "Nevers"

1. **Never make live network requests** in unit or integration tests. Platform data comes from recorded DOM fixture snapshots.
2. **Never call live LLM APIs** in any automated test. LLM interactions use a mock `LLMProvider` implementation.
3. **Never use real user credentials** in any test fixture or test data. All fixtures use sanitised synthetic data.

### Test Categories and Coverage Targets

| Category | Scope | Coverage Target |
|---|---|---|
| Unit  Pure functions (tools, utilities) | Each function in isolation | **100% branch coverage**  pure functions are fully testable |
| Unit  Extraction scripts | Scripts against recorded DOM fixture snapshots | All page layouts the script claims to handle + the unrecognised-page case |
| Unit  Schema validators | Zod schemas: valid inputs, invalid inputs, boundary cases |  95% |
| Integration  API endpoints | Full HTTP request  response cycle with real DB (test instance) | All endpoints, all status codes defined in the architecture |
| Integration  Agent pipeline | Planner  Executor  Synthesizer with mocked LLM provider | All 7 markets |
| Contract  IPC messages | IPC message types against their registered Zod schemas | All registered IPC channel types |
| Contract  Payload boundary | PayloadBuilder output conforms to `AnalysisPayload` schema | All market + platform combinations |
| E2E  User flows | Full user journeys in the real Electron app (Playwright) | Core happy path per market  nightly pipeline only |
| Security | Auth, injection prevention, credential handling, output validation | **Zero tolerance  all must pass** |

### CI Gates

All of the following must pass before any PR can merge:

```
lint          zero warnings
typecheck     zero type errors
unit          pass; tool branch coverage 100%
integration   pass
security      pass (zero failures allowed)
build         client and backend build successfully
```

E2E tests run on the nightly pipeline and on release candidates  not on every PR.

---

## 6. Raising and Managing Defects

### When to Raise a `type:bug` Issue

Raise a `type:bug` issue for every objective failure found during testing:
- An acceptance criterion is not met.
- An architectural principle (P1–P9) is violated.
- A security test fails.
- A contract is not honoured (wrong output shape, wrong error handling, wrong status code).

Do not raise bugs for subjective style preferences or minor cosmetic issues  those are comments on the PR, not issues.

### Bug Issue Contents (Required)

Every `type:bug` issue must include:
- **Steps to reproduce**  exact sequence from a known starting state.
- **Expected behaviour**  what the architecture contract or acceptance criterion specifies.
- **Actual behaviour**  what was observed, including any error messages or incorrect values.
- **Environment**  branch, commit SHA, OS, relevant config.
- **Severity label**  see classification below.
- **Link to the feature issue** it was found in.

### Defect Severity Classification

| Severity | Label | Meaning | Resolution Requirement |
|---|---|---|---|
| **P0  Security** | `P0` | Credential leak, LLM key exposure, SQL injection surface, broken auth | Blocks merge immediately  fix before any other work |
| **P1  Architectural violation** | `P1` | Numbers from LLM, mutable market context, wrong tier responsibility, missing validation | Fix before merge |
| **P2  Functional defect** | `P2` | Acceptance criterion not met, wrong output, graceful degradation failure | Fix in same sprint |
| **P3  Quality gap** | `P3` | Missing test coverage on non-critical path, incomplete fixture, minor UI inconsistency | Fix in next sprint |

Tester posts a comment on the **feature issue** listing all defects found and their severity, with links to the individual `type:bug` issues. The feature issue does not move to `Done` while any P0 or P1 bug linked to it is open.

---

## 7. Security Testing Requirements

Security tests are in `tests/security/` and have **zero tolerance**  every test must pass on every CI run. A single failure is a blocking defect.

The security test suite must cover, at minimum:

| Test Area | What Must Be Verified |
|---|---|
| **Credential containment** | `AnalysisPayload` built from any platform fixture must not contain credential-shaped fields (cookie, token, password, session_id, auth header values) |
| **JWT integrity** | A tampered JWT must be rejected with 401; an expired JWT must be rejected with 401 |
| **Cross-user access (RBAC)** | User A's authenticated request for User B's resource (session, saved list) must return 403 |
| **Rate limit enforcement** | A user exceeding their tier's limit must receive 429 — rate limit is enforced server-side, not client-side |
| **Oversized payload** | A request payload exceeding the 5 MB limit must be rejected with 413 |
| **Prompt injection** | A keyword input containing prompt injection patterns must be sanitised before reaching any LLM prompt template |
| **SQL injection surface** | Inputs containing SQL metacharacters must be handled safely with no error leakage (ORM parameterisation prevents execution  test confirms no unexpected errors or data) |
| **LLM output schema violation** | Synthesizer output containing fields not in the `ProductCard` schema must be rejected by Zod validation, not passed to the client |
| **Error response hygiene** | Error responses must use the standard `ErrorResponse` shape  no raw stack traces, no internal paths, no database errors exposed to clients |

---

## 8. Definition of Done for a Tester

A `type:test` issue is **Done** when:

- [ ] Test plan has been authored and posted as a comment on the issue.
- [ ] All tests described in the plan have been written and committed to `tests/`.
- [ ] Tests are in the correct category directories (unit / integration / security / e2e).
- [ ] All CI gates pass with the new tests included.
- [ ] No test makes live network requests or calls a live LLM API.
- [ ] All test fixtures use synthetic data (no real credentials, no real user data).
- [ ] Market-specific tests use only the correct market's fixtures and context.

A feature issue (`type:feature`) is **QA-signed-off** and can move to `Done` when:

- [ ] All acceptance criteria have been verified against the implementation.
- [ ] All P0 and P1 bugs raised against this feature are resolved and re-verified.
- [ ] Tester has posted ` QA passed` as a comment on the feature issue.
- [ ] No P0 or P1 `type:bug` issues linked to this feature remain open.

---

## 9. Cooperating with Other Roles

### With Architect

- Architect owns the interface contracts that tests verify. If a contract is ambiguous or untestable, raise it on the issue and tag `@Architect` before writing tests.
- Architect reviews `type:test` issues that cover security or cross-component contract verification.
- Changes to this guide or to the security test requirements must go through architect review.

### With Developers

- Testers own `tests/`  do not modify source files in `src/`.
- Developers own `src/`  testers notify developers when a DOM fixture needs to be updated (platform script version bump) rather than editing the script themselves.
- When a developer bumps an extraction script's version (DOM change), the tester captures a new fixture snapshot and creates a new `[page-type]-v[new-version].html` file. Both the old and new fixtures are retained for at least one release cycle.
- Defects raised by the tester are treated as blocking by the developer (P0 and P1 block merge; P2 must be resolved in the same sprint).

### With PM

- Tester does not change acceptance criteria  if a criterion is wrong or untestable, raise it as a comment on the issue for PM to resolve.
- The tester's `✅ QA passed` sign-off is the **only gate** that allows PM to close an issue. PM cannot move an issue to `Done` without it.
- Tester raises `type:bug P0` issues for critical post-release findings  PM then initiates the hotfix process.

---

## 10. Quick Reference

| What | Where |
|---|---|
| Architecture, interface contracts, P1–P9 principles | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Product requirements, acceptance criteria source | [`docs/PRD-Product-Selection-Module.md`](../PRD-Product-Selection-Module.md) |
| Issue lifecycle, QA sign-off gate, Definition of Done | [`docs/PROJECT-MANAGEMENT.md`](../PROJECT-MANAGEMENT.md) |
| Developer workflow and Definition of Done | [`docs/guides/DEVELOPER-GUIDE.md`](DEVELOPER-GUIDE.md) |
| Open tester issues | [GitHub Issues  role:tester](https://github.com/chenning007/OneSell/issues?q=label%3Arole%3Atester) |
| Test categories and coverage targets | This guide, Section 5 |
| Security test requirements | This guide, Section 7 |
| Defect severity classification | This guide, Section 6 |

---

*Document owner: Architect. Changes require architect review and a `docs/` PR. Last updated: 2026-03-15.*
