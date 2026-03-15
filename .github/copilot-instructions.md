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

## 4. Role Responsibilities (Summary)

| Role | Owns | Does NOT do |
|---|---|---|
| **PM** | Issue backlog, acceptance criteria, content specs, UX review, open questions | Implementation, tests |
| **Architect** | System design, API contracts, DB schemas, security review | Implementation, test execution |
| **Dev** | Feature implementation, bug fixes, PRs | Test execution, product decisions |
| **Tester** | Test plans, test execution, bug reports, QA sign-off | Source code changes, product decisions |

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

## 8. When You Are Blocked

Add the `blocked` label to your issue, post a comment explaining the blocker, and mention `@PM`. PM resolves blockers within 1 business day. Do not skip ahead to other work without logging the block first.

---

*Questions about this process? Open a `type:question` issue labeled `role:pm`.*

