# OneSell Scout — Project Management Guide

**Version**: 1.0  
**Owner**: Project Manager  
**Date**: 2026-03-15  
**Applies to**: All team members — PM, Architect, Dev, Tester

---

## 1. Team Structure & Roles

| Role | Label | Core Responsibility |
|---|---|---|
| **Project Manager (PM — Product)** | `role:pm` | Owns product vision, requirements, UX validation, open questions, KPIs, and stakeholder communication |
| **Architect** | `role:architect` | Owns system design, API contracts, data schemas, technology decisions, and security architecture |
| **Developer** | `role:dev` | Owns function-level design, implementation, code review, and integration |
| **Tester** | `role:tester` | Owns test planning, test execution, quality sign-off, and bug reporting |

> The **Project Manager (PM)** also acts as the overall delivery driver — creating the master task backlog, assigning work, tracking progress, and unblocking the team. All four roles collaborate **exclusively through GitHub Issues and the GitHub Project board** — this is the single source of truth for all work.

---

## 2. The Golden Rule

> **If it is not in a GitHub Issue, it does not exist.**

Every piece of work — a feature, a design decision, a test plan, a bug, a risk item, a question that needs resolution — must be captured as an Issue. No side-channel decisions. No verbal-only agreements. All outcomes and conclusions are written into the Issue or a PR linked to it.

---

## 3. GitHub Project Board

### Board Location
`https://github.com/chenning007/OneSell/projects`

### Columns (Workflow States)

```
Backlog → Ready → In Progress → In Review → Done
```

| Column | Meaning | Who Moves Issues Here |
|---|---|---|
| **Backlog** | Issues created but not yet ready to start | PM when creating tasks |
| **Ready** | Fully defined, dependencies resolved, ready to pick up | PM after review/grooming |
| **In Progress** | Actively being worked on | Assignee when they start work |
| **In Review** | Work complete, waiting for review/approval | Assignee when they submit PR or deliverable |
| **Done** | Reviewed, accepted, and closed | Reviewer after sign-off |

### Milestone Structure

| Milestone | Scope | Target |
|---|---|---|
| `M0 — Foundation` | Architecture design, tech stack decisions, repo setup | Sprint 1–2 |
| `M1 — Wizard + Extraction (US)` | Preference wizard, US-market data extraction | Sprint 3–6 |
| `M2 — Agent + Results` | LLM agent pipeline, results UI, drill-down | Sprint 7–10 |
| `M3 — Quality & NFRs` | Security hardening, performance, accessibility | Sprint 11–12 |
| `M4 — China Market` | China platform extraction, ZH-CN prompts | Sprint 13–16 |
| `M5 — Monetization` | Tier enforcement, subscription access control | Sprint 17–18 |

---

## 4. Labels

### Role Labels (who owns this issue)
| Label | Color | Meaning |
|---|---|---|
| `role:pm` | `#0075ca` | Product manager owns this issue |
| `role:architect` | `#e4e669` | Architect owns this issue |
| `role:dev` | `#d876e3` | Developer owns this issue |
| `role:tester` | `#c5def5` | Tester owns this issue |

### Epic Labels (what area does this belong to)
| Label | Color | Meaning |
|---|---|---|
| `epic:foundation` | `#f9d0c4` | System architecture, repo setup, strategy |
| `epic:wizard` | `#fef2c0` | Preference wizard (Steps 1–6) |
| `epic:extraction` | `#bfd4f2` | Client-side data extraction scripts |
| `epic:agent` | `#d4c5f9` | LLM agent pipeline (Planner/Executor/Synthesizer) |
| `epic:results-ui` | `#c2e0c6` | Results dashboard and product detail UI |
| `epic:china` | `#f29513` | China market extraction and prompts |
| `epic:security-nfr` | `#b60205` | Security, performance, accessibility |
| `epic:monetization` | `#0e8a16` | Subscription tiers and access control |

### Priority Labels
| Label | Color | Meaning |
|---|---|---|
| `P0` | `#b60205` | Critical — must ship in current milestone |
| `P1` | `#e4e669` | High — must ship this quarter |
| `P2` | `#c5def5` | Medium — next milestone |
| `P3` | `#ffffff` | Low — nice to have |

### Type Labels
| Label | Color | Meaning |
|---|---|---|
| `type:feature` | `#a2eeef` | New capability |
| `type:design` | `#e4e669` | Architecture or UX design artifact |
| `type:test` | `#c5def5` | Test plan or test execution |
| `type:bug` | `#d73a4a` | Something is broken |
| `type:question` | `#d876e3` | Open question blocking progress |
| `type:chore` | `#ffffff` | Setup, config, tooling |

---

## 5. Issue Templates

### How to Create an Issue

All issues must include:
1. **Descriptive title** — `[Role] Short description` (e.g., `[Dev] Implement Amazon US extraction script`)
2. **One `role:*` label** — exactly one, the role who owns completion
3. **One `epic:*` label** — which epic it belongs to
4. **One priority label** — `P0` / `P1` / `P2` / `P3`
5. **One `type:*` label** — feature, design, test, bug, question, or chore
6. **Milestone** — which milestone this is targeting
7. **Assignee** — the person responsible for completing it
8. **Body** — use the appropriate template below

---

### Template A — Feature / Implementation

```markdown
## Context
<!-- Why does this need to be built? Link to PRD section if applicable -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies
<!-- List any issues that must be completed before this can start -->
- Blocked by: #XX

## Notes
<!-- Any implementation hints, constraints, or open questions -->
```

---

### Template B — Design / Architecture

```markdown
## Problem Statement
<!-- What design decision or architectural question needs to be resolved? -->

## Options Considered
| Option | Pros | Cons |
|---|---|---|
| Option A | ... | ... |
| Option B | ... | ... |

## Decision
<!-- Chosen approach and rationale — filled in by Architect when resolved -->

## Output Artifacts
- [ ] Design doc / ADR updated
- [ ] API schema updated
- [ ] Dependent issues unblocked
```

---

### Template C — Test Plan / QA

```markdown
## Scope
<!-- What feature or component does this test plan cover? -->

## Test Cases

| # | Test Scenario | Input | Expected Output | Pass/Fail |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

## Edge Cases & Negative Tests
- [ ] Edge case 1
- [ ] Edge case 2

## Entry Criteria
<!-- What must be true before testing begins? -->

## Exit Criteria
<!-- What must be true for this test to be signed off? -->

## Findings
<!-- Filled in by Tester during execution -->
```

---

### Template D — Bug Report

```markdown
## Summary
<!-- One-line description of the bug -->

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior

## Actual Behavior

## Environment
- OS: 
- App version: 
- Market selected: 

## Severity
<!-- P0 blocker / P1 high / P2 medium / P3 low -->

## Attachments
<!-- Screenshots, logs, extracted JSON payload if relevant -->
```

---

### Template E — Open Question

```markdown
## Question
<!-- The specific decision that needs to be made -->

## Context
<!-- Why does this need to be answered? What is blocked? -->

## Options
- Option A: ...
- Option B: ...

## Owner
<!-- Who is responsible for resolving this? -->

## Deadline
<!-- When does this need to be answered to avoid blocking other work? -->

## Resolution
<!-- Filled in when decided — then issue is closed -->
```

---

## 6. Role-Specific Workflows

### PM (Product Manager)

**PM is the issue backlog owner.** The PM:

1. **Creates the master backlog** — translates PRD sections into Issues using Template A/E, assigns role labels and priorities.
2. **Grooms the backlog weekly** — moves issues from `Backlog → Ready` once dependencies are clear and the issue is fully defined.
3. **Creates open question issues** (Template E) — any unresolved question from PRD §13 becomes a `type:question` issue immediately.
4. **Reviews output** — for any `role:pm` issue (UX review, content spec, persona validation), the PM completes and closes it, then creates unblocked dependent issues.
5. **Tracks milestone progress** — monitors the project board weekly; escalates blockers.
6. **Writes acceptance criteria** — for every feature issue, PM authors the AC so Dev and Tester know what done means.

**PM-owned issue types**: user research, content specs, UX reviews, feature definitions, open question resolutions, KPI tracking setup.

---

### Architect

**Architect is the design gate.** The Architect:

1. **Picks up `role:architect` issues** from `Ready` column — moves to `In Progress` immediately.
2. **Produces design artifacts** — API schemas, DB schemas, ADRs (Architecture Decision Records), sequence diagrams. All artifacts are committed to the `/docs/architecture/` folder and linked from the Issue.
3. **Unblocks Dev** — when a design issue is resolved, the Architect:
   - Closes the design issue with a summary decision comment
   - Creates or unblocks the dependent `role:dev` implementation issues
4. **Reviews security** — every feature with security implications (credentials, API keys, data retention) must have Architect sign-off before Dev marks it done.
5. **Flags tech risks** — creates `type:question` issues for any technical ambiguity that could affect the architecture.
6. **Does not implement** — Architect writes specs and makes decisions; Dev implements. If Architect writes code, it is a spike/prototype, clearly labeled `type:chore spike`.

**Architect-owned issue types**: system design, API contracts, DB schemas, security design review, technology selection, extraction module interface design.

---

### Developer

**Dev is the builder.** The Developer:

1. **Picks up `role:dev` issues** from `Ready` — moves to `In Progress`, creates a feature branch: `feature/<issue-number>-short-description`.
2. **Does not start without AC** — if acceptance criteria are missing, comments on the issue asking PM to complete them before proceeding.
3. **Links PR to issue** — every PR must include `Closes #<issue-number>` in the PR description so the issue auto-closes on merge.
4. **Requests Architect review** for any PR that touches: API contracts, data schemas, security boundaries, the LLM agent service, or the extraction module interface.
5. **Requests Tester review** — once a feature is merged to `main`, Dev comments on the linked test plan issue (or creates one if missing) to trigger QA.
6. **Does not self-close issues** — issues move to `Done` only after the Tester has verified the feature (see Tester workflow).
7. **Creates bug issues** for anything found during development using Template D, labels `type:bug`, assigns to self if self-caused.

**Dev-owned issue types**: all implementation features, bug fixes, infrastructure setup, build pipeline, extraction scripts, API implementation, UI components, tool functions.

---

### Tester

**Tester is the quality gate.** The Tester:

1. **Writes test plans early** — for every epic, the Tester creates a `type:test` issue (Template C) as soon as the PM creates the feature issue — not after implementation. Test plans are written against acceptance criteria.
2. **Picks up test execution issues** from `Ready` — moves to `In Progress` only when the feature is merged to `main` and Dev has notified.
3. **Executes against AC** — tests each acceptance criterion. Passes → check it off. Fails → creates a `type:bug` issue linked to the feature issue.
4. **Signs off features** — when all AC pass, Tester comments "✅ QA passed" on the feature issue and moves it to `Done`.
5. **Blocks releases** — Tester has veto power. No milestone is closed until all P0/P1 test issues in that milestone are `Done`.
6. **Performance & security testing** — Tester owns the NFR test issues (startup time, extraction time, agent latency, WCAG audit, security checks).

**Tester-owned issue types**: test plans, test execution records, bug reports, performance benchmarks, security verification, accessibility audits.

---

## 7. Issue Lifecycle (End-to-End)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ISSUE LIFECYCLE                                      │
│                                                                              │
│  1. PM creates Issue → Backlog                                               │
│     Labels: role:* + epic:* + priority + type                                │
│     Body: template filled (context, AC, dependencies)                        │
│                                                                              │
│  2. PM grooms: dependencies resolved? AC clear? → Backlog → Ready           │
│                                                                              │
│  3. Assignee picks up → Ready → In Progress                                 │
│     (Dev creates branch: feature/<issue#>-name)                              │
│                                                                              │
│  4a. [Design/Test issues] Assignee completes artifact, comments summary      │
│      → In Progress → In Review                                               │
│      PM or Architect reviews artifact → approves → Done                     │
│                                                                              │
│  4b. [Dev feature issues] Dev opens PR → links Closes #<issue>              │
│      → In Progress → In Review                                               │
│      Architect reviews (if architecture touches) → approves                 │
│      PR merged to main → Issue moves to In Review                           │
│                                                                              │
│  5. Tester verifies feature against AC → comments ✅ QA passed              │
│     → In Review → Done                                                       │
│                                                                              │
│  (Bug found in step 5) → Tester creates bug Issue → Backlog                 │
│     Bug assigned to Dev → cycle repeats from step 3                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Branching Strategy

### 8.1 Branch Model Overview

```
main
  │
  ├── feature/<issue#>-short-name     ← Dev: one branch per feature issue
  ├── fix/<issue#>-short-name         ← Dev: one branch per bug fix issue
  ├── spike/<issue#>-short-name       ← Architect: research / prototype
  ├── docs/<issue#>-short-name        ← Any role: documentation only
  │
  ├── release/vX.Y                    ← PM only: created when milestone is ready to ship
  └── hotfix/<issue#>-short-name      ← PM only: created from main for post-release P0 fixes
```

**`main` is the only permanent branch.** Every other branch is temporary — created for one issue, merged via PR, and deleted automatically on merge.

---

### 8.2 Branch Naming Rules

| Branch Type | Pattern | Example | Who Creates |
|---|---|---|---|
| Feature | `feature/<issue#>-short-name` | `feature/11-market-selection-screen` | Dev |
| Bug fix | `fix/<issue#>-short-name` | `fix/47-wizard-language-switch-bug` | Dev |
| Spike / research | `spike/<issue#>-short-name` | `spike/3-extraction-architecture` | Architect |
| Docs | `docs/<issue#>-short-name` | `docs/7-kpi-instrumentation-spec` | Any role |
| Release | `release/vX.Y` | `release/v1.0` | **PM only** |
| Hotfix | `hotfix/<issue#>-short-name` | `hotfix/99-credential-leak-fix` | **PM only** |

Rules:
- Always include the **issue number** — this links the branch to its work item
- Use **kebab-case** for the name portion, keep it short (3–5 words)
- Never include your username, dates, or version numbers in `feature/` or `fix/` branches

---

### 8.3 How Dev Creates and Works on a Branch

When you pick up a `role:dev` issue from `Ready`:

```bash
# 1. Make sure you are on main and it is up to date
git checkout main
git pull origin main

# 2. Create your branch — use the exact issue number
git checkout -b feature/11-market-selection-screen

# 3. Do your work. Commit often with clear messages:
git commit -m "feat(wizard): render 7 market tiles with flag icons"
git commit -m "feat(wizard): wire market selection to i18n context"

# 4. Push your branch and open a PR when ready
git push -u origin feature/11-market-selection-screen
```

Post a comment on the GitHub Issue with your branch name when you start: `Working on branch feature/11-market-selection-screen`.

---

### 8.4 Commit Message Format

Use the format: `type(scope): short description`

| Prefix | Used for |
|---|---|
| `feat(scope):` | New feature or capability |
| `fix(scope):` | Bug fix |
| `docs(scope):` | Documentation change |
| `test(scope):` | Adding or updating tests |
| `refactor(scope):` | Code change with no feature or fix |
| `chore(scope):` | Build, config, or tooling change |

**Scope** is the component affected: `wizard`, `extraction`, `agent`, `api`, `ui`, `db`, `auth`, etc.

Examples:
```
feat(extraction): add Amazon US search results extraction script v1.0
fix(agent): prevent calc_margin returning NaN when COGS is zero
test(tools): add 100% branch coverage to score_trend tool
docs(architecture): add ADR-001 for Electron vs browser extension decision
```

---

### 8.5 Pull Request Rules

Every PR must:

- [ ] Have a **title** matching the issue: `[#XX] Short description of what was built`
- [ ] Include `Closes #<issue-number>` in the PR body — this auto-closes the issue on merge
- [ ] Pass all automated checks (tests, lint) before review is requested
- [ ] Have at least **1 approving review** before it can be merged
- [ ] Request **Architect review** if the PR touches: API contracts, extraction interfaces, agent pipeline, security boundaries, or DB schema
- [ ] Request **PM review** if the PR touches: UI screens, wizard content, recommendation card copy, or any user-visible text
- [ ] Have no unresolved review comments at merge time

PR template (create `.github/pull_request_template.md`):
```markdown
## What does this PR do?
<!-- One paragraph summary -->

## Linked Issue
Closes #<issue-number>

## Type of change
- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] docs — documentation
- [ ] test — adding/updating tests
- [ ] chore — build/config/tooling

## Checklist
- [ ] I have read the acceptance criteria on the issue
- [ ] All acceptance criteria are met
- [ ] Tests written and passing
- [ ] No credentials, API keys, or secrets in this diff
- [ ] Relevant docs updated (if applicable)
- [ ] Architect review requested (if touching contracts/security)
```

---

### 8.6 Merge Strategy

- **Squash and merge only** — all commits on a feature branch are squashed into one commit on `main`
- The squash commit message must follow the commit format in §8.4
- After merge, the feature branch is **deleted automatically** (configured in repo settings)
- Never rebase or force-push to `main`

---

### 8.7 Keeping Your Branch Up to Date

If `main` has moved forward while you are working on your branch, rebase your branch onto `main` (do **not** merge `main` into your branch — it creates noisy merge commits):

```bash
git fetch origin
git rebase origin/main

# If there are conflicts, resolve them, then:
git rebase --continue

# Force-push your rebased branch (safe because it's your own branch, not main)
git push --force-with-lease origin feature/11-market-selection-screen
```

---

### 8.8 Release Branch Lifecycle (PM-owned)

When all issues in a milestone reach `Done` and Tester confirms QA sign-off:

```bash
# PM creates the release branch from main
git checkout main
git pull origin main
git checkout -b release/v1.0
git push origin release/v1.0

# PM creates GitHub Release with tag v1.0
# (via GitHub UI: Releases → Draft new release → Tag: v1.0, Target: release/v1.0)

# After release is published, PM merges back to main
git checkout main
git merge --no-ff release/v1.0
git push origin main

# Delete release branch
git push origin --delete release/v1.0
```

**No Dev or Tester commits directly to a `release/*` branch.** If a bug is found during the release window, it is fixed on `main` via the normal PR process and cherry-picked by PM into the release branch.

---

### 8.9 Hotfix Branch Lifecycle (PM-owned)

For a critical (P0) bug discovered after a release:

```bash
# PM creates hotfix branch from main (not from a feature branch)
git checkout main
git pull origin main
git checkout -b hotfix/99-credential-leak-fix

# PM assigns the hotfix branch to Dev for the fix
# Dev opens a PR from hotfix/99-... → main (not into release)

# After Tester signs off and PR is merged:
# PM tags main with a patch version
git tag v1.0.1
git push origin v1.0.1
```

Hotfixes are tagged with a **patch version bump** (`vX.Y.Z`). A GitHub Release is created for every hotfix tag — no silent patches.

---

## 9. Weekly Cadence

| Day | Activity | Who |
|---|---|---|
| **Monday** | PM reviews board: move unblocked issues to `Ready`; flag stale `In Progress` items | PM |
| **Monday** | Each role picks up top `Ready` issue for the week | All |
| **Wednesday** | Mid-week async check: any blockers? Post comment on blocked issue | All |
| **Friday** | Each role updates their `In Progress` issues with a progress comment | All |
| **Friday** | PM closes completed milestones, creates next sprint's `Ready` queue | PM |

---

## 10. Definition of Done

An issue is **Done** only when ALL of the following are true:

- [ ] All acceptance criteria checked off on the issue
- [ ] PR merged to `main` (for implementation issues)
- [ ] Relevant documentation committed to `/docs/`
- [ ] Tester has commented `✅ QA passed` (for implementation issues)
- [ ] No open `type:bug` issues linked to this issue at P0 or P1
- [ ] Issue moved to `Done` column on the project board

---

## 11. Escalation Path

If an issue is **blocked for more than 2 business days**:

1. Assignee adds `blocked` label and comments on the issue explaining the blocker
2. PM is mentioned in the comment (`@pm-username`)
3. PM resolves the block within 1 business day (clarifies AC, creates missing dependency issue, makes a decision)
4. If the block requires an architectural decision → PM creates a `type:question role:architect` issue and marks it `P0`
5. If the block requires a product decision → PM resolves directly and documents the decision in the issue comment

---

## 12. Repository Structure (Evolving)

```
OneSell/
├── README.md
├── .gitignore
├── docs/
│   ├── PRD-Product-Selection-Module.md     ← Product requirements
│   ├── PROJECT-MANAGEMENT.md               ← This file
│   └── architecture/                       ← Architect artifacts (ADRs, schemas, diagrams)
├── client/                                 ← Electron desktop app (Dev)
├── backend/                                ← Cloud API + Agent Service (Dev)
└── tests/                                  ← Test plans and QA scripts (Tester)
```

> Folders are created by Dev/Architect as work begins. Do not create empty placeholder folders.

---

## 13. Getting Started (New Team Member Checklist)

- [ ] Get added as a collaborator on `chenning007/OneSell`
- [ ] Read [PRD: Product Selection Module](PRD-Product-Selection-Module.md)
- [ ] Read this document fully
- [ ] Find your role's open issues in the [Project board](https://github.com/chenning007/OneSell/projects) under `Ready`
- [ ] Set up your local environment (instructions in `README.md` — Dev/Architect)
- [ ] Pick your first issue, move it to `In Progress`, and start

---

*Questions about this process? Create a `type:question` issue labeled `role:pm` and tag the PM.*
