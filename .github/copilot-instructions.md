# OneSell Scout — Team Collaboration Instructions

> **Every team member — PM, Architect, Dev, and Tester — must read this file before starting any work.**
> These instructions govern how the team cooperates and how work progresses. They are mandatory.
>
> Full project management guide: [`docs/PROJECT-MANAGEMENT.md`](../docs/PROJECT-MANAGEMENT.md)

---

## 1. Read This First

Before you do anything:

1. Read [`docs/PROJECT-MANAGEMENT.md`](../docs/PROJECT-MANAGEMENT.md) — contains role definitions, issue templates, lifecycle rules, and the Definition of Done.
2. Read [`docs/PRD-Product-Selection-Module.md`](../docs/PRD-Product-Selection-Module.md) — understand what we are building and why.
3. Go to the [GitHub Issues](https://github.com/chenning007/OneSell/issues) and find the open issues assigned to your role (`role:pm`, `role:architect`, `role:dev`, or `role:tester`).
4. Pick the highest-priority issue in `Ready` state, move it to `In Progress`, and start.

---

## 2. The One Rule That Overrides Everything

> **If it is not in a GitHub Issue, it does not exist.**

All work is tracked in GitHub Issues. No side-channel decisions. No verbal-only agreements. Every outcome is written into an issue comment or a PR linked to an issue.

---

## 3. How the Team Works Together

```
PM creates / grooms Issues → assigns to roles → moves to Ready
        ↓
Role picks up issue → moves to In Progress → does the work
        ↓
Role submits deliverable (PR or artifact) → moves to In Review
        ↓
Reviewer approves → Tester signs off → issue moved to Done
```

**Detailed rules for each step are in [`docs/PROJECT-MANAGEMENT.md`](../docs/PROJECT-MANAGEMENT.md).**

---

## 4. Role Responsibilities

### Product Manager (`role:pm`)
The PM owns the product — what it is, who it serves, and whether it is working. All product decisions flow through the PM.

- **Product vision & strategy** — defines and maintains the product direction; ensures every feature maps to a user need from the PRD
- **Market analysis** — researches target markets and user personas; validates assumptions through user interviews and competitive analysis
- **PRD ownership** — authors and versions [`docs/PRD-Product-Selection-Module.md`](../docs/PRD-Product-Selection-Module.md); every PRD change gets a version bump and a summary comment on the associated issue
- **Issue backlog** — creates, grooms, and prioritizes all GitHub Issues; writes acceptance criteria before any Dev or Tester work begins
- **UX review** — reviews implemented screens against PRD specs; raises new issues for any gap
- **Open questions** — owns all `type:question` issues; resolves blockers within 1 business day
- **Product improvement** — collects user feedback post-launch; translates it into new PRD sections and `type:feature` issues
- **PRD-driven sprint planning** — before every milestone begins, PM reads the current PRD version, identifies all work items implied by that version, creates the corresponding GitHub Issues with full acceptance criteria, assigns them to the correct roles, and moves them to `Ready`; no role should ever be waiting for work
- **Task assignment** — PM matches every issue to a specific assignee based on role, capacity, and dependency order; unassigned issues in `Ready` are a PM failure
- **Release management** — PM owns the branch and tag strategy for every shipment; see Section 9

> PM does **not** write code, run tests, or make architectural decisions.

---

### Architect (`role:architect`)
The Architect owns the technical design — how the system is built, how components connect, and where the boundaries are.

- **System design** — produces architecture decision records (ADRs) and sequence diagrams; committed to `/docs/architecture/`
- **API contracts** — defines request/response schemas for all service boundaries before Dev implements them
- **Data schemas** — designs the database schema (PostgreSQL) and cache strategy (Redis)
- **Security design** — owns the threat model; reviews every feature that touches credentials, data retention, or external APIs
- **Technology decisions** — selects frameworks, libraries, and infrastructure; documents rationale in ADRs
- **Dev unblocking** — resolves technical ambiguities that block Dev; closes design issues with a decision comment before handing off to Dev

> Architect does **not** write production features or execute tests.

---

### Developer (`role:dev`)
The Dev owns the implementation — turning design specs and acceptance criteria into working, merged code.

- **Feature implementation** — builds features described in `role:dev` issues, working from AC written by PM and specs written by Architect
- **Function-level design** — makes implementation-level decisions (data structures, algorithms, component structure) within the architecture set by the Architect
- **Bug fixes** — owns all `type:bug` issues assigned to them; reproduces, fixes, and links the fix PR to the bug issue
- **Code review** — reviews PRs from other Devs; requests Architect review for any PR touching security boundaries or API contracts
- **Integration** — ensures new code integrates cleanly with existing modules; does not break other features

> Dev does **not** change acceptance criteria, make product decisions, or self-close issues without Tester sign-off.

---

### Tester (`role:tester`)
The Tester owns quality — ensuring every feature meets its acceptance criteria and the product is safe to ship.

- **Test planning** — writes a `type:test` issue with a full test plan for every epic *before* implementation is complete
- **Test execution** — runs test cases once Dev signals a feature is merged; logs results on the feature issue
- **Bug reporting** — raises `type:bug` issues for every failure found; includes steps to reproduce, expected vs actual behaviour, and environment details
- **QA sign-off** — posts `✅ QA passed` on the feature issue when all AC pass; this is the gate for moving an issue to `Done`
- **Non-functional testing** — owns performance benchmarks, security verification, and accessibility audits
- **Release gate** — no milestone is closed until all P0 and P1 test issues in that milestone are `Done`

> Tester does **not** modify source code or change product requirements.

---

## 5. Issue Labels to Know

Every issue carries:
- **Role**: `role:pm` / `role:architect` / `role:dev` / `role:tester` — who owns it
- **Epic**: `epic:foundation` / `epic:wizard` / `epic:extraction` / `epic:agent` / `epic:results-ui` / `epic:china` / `epic:security-nfr` / `epic:monetization`
- **Priority**: `P0` (critical) → `P1` (high) → `P2` (medium) → `P3` (low)
- **Type**: `type:feature` / `type:design` / `type:test` / `type:bug` / `type:question` / `type:chore`

Always filter by your role label to find your work.

---

## 6. Definition of Done

An issue is **Done** only when ALL of the following are true:

- [ ] All acceptance criteria on the issue are checked off
- [ ] PR merged to `main` (for implementation issues)
- [ ] Tester has commented `✅ QA passed` (for implementation issues)
- [ ] No open `type:bug` issues linked to this issue at P0 or P1
- [ ] Issue moved to `Done` on the project board

---

## 7. Branching Convention

| Prefix | Used for |
|---|---|
| `feature/<issue#>-name` | Dev — new features |
| `fix/<issue#>-name` | Dev — bug fixes |
| `spike/<issue#>-name` | Architect — research/prototypes |
| `docs/<issue#>-name` | Any role — documentation only |

Every PR must include `Closes #<issue-number>` in the description.

---

## 10. When You Are Blocked

Add the `blocked` label to your issue, post a comment explaining the blocker, and mention `@PM`. PM resolves blockers within 1 business day. Do not skip ahead to other work without logging the block first.

---

## 9. Release Management (PM-owned)

### PRD Version → Sprint Plan

Every time the PRD is updated, the PM follows this sequence before any Dev or Tester work begins:

```
PM reads new PRD version
        ↓
PM identifies all new or changed requirements
        ↓
PM creates / updates GitHub Issues for each item
  (title, acceptance criteria, labels, milestone, assignee)
        ↓
PM moves issues to Ready
        ↓
Roles pick up issues — work begins
```

A PRD version bump with no corresponding new issues is incomplete. The issues **are** the sprint plan.

### Branch Strategy for Shipment

```
main          ← always reflects the latest released version; protected
release/vX.Y  ← cut by PM when a milestone is ready to ship
hotfix/<#>    ← cut from main for urgent post-release fixes only
```

**PM is the only person who creates `release/*` and `hotfix/*` branches.** Devs work exclusively on `feature/`, `fix/`, `spike/`, and `docs/` branches.

### Milestone → Release Flow

```
All milestone issues reach Done
        ↓
Tester confirms: all P0/P1 test issues in milestone are ✅ QA passed
        ↓
PM cuts release branch:  git checkout -b release/vX.Y
        ↓
PM creates GitHub Release with tag vX.Y and release notes
  (summarises what shipped, links milestone, lists closed issues)
        ↓
PM closes the milestone on GitHub
        ↓
PM merges release/vX.Y back into main
        ↓
🚢 Shipped
```

### Release Notes (PM authors)

Every GitHub Release must include:
- **What's new** — plain-language summary of features shipped (maps to PRD sections)
- **PRD version** — which PRD version this release implements
- **Issues closed** — linked list of all issues in the milestone
- **Known limitations** — any P2/P3 issues deliberately deferred
- **Upgrade notes** — any breaking changes or migration steps (if applicable)

### Hotfix Process

For a critical bug found after release:

1. Tester raises a `type:bug P0` issue
2. PM creates `hotfix/<issue#>-description` branch from `main`
3. Dev fixes on that branch; Tester verifies
4. PM merges hotfix to `main`, tags as `vX.Y.Z`, creates a GitHub Release
5. Issue closed with `✅ QA passed` comment

**No hotfix ships without Tester sign-off**, even for P0 bugs.

---

## 10. When You Are Blocked

Add the `blocked` label to your issue, post a comment explaining the blocker, and mention `@PM`. PM resolves blockers within 1 business day. Do not skip ahead to other work without logging the block first.

---

*Questions about this process? Open a `type:question` issue labeled `role:pm`.*

