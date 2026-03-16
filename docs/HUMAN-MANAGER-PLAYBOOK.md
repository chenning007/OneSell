# OneSell Scout — Collaboration Playbook

**Who this is for**: Everyone — the human owner (`@chenning007`), all four AI agents (PM, Architect, Dev, Tester), and GitHub automation (CI, Dependabot, human-gate workflows).  
**What it covers**: Who does what, when to do it, what triggers the next step, and how the whole team keeps the project moving continuously.  
**Version**: 2.0 | **Date**: 2026-03-16

---

## The One-Line Summary

> **GitHub Issues are the heartbeat.** The human makes decisions. AI agents do work. GitHub automation enforces quality. Nothing moves without an issue.

---

## Part 1 — The Five Participants and Their Tools

| Participant | What They Own | How They Work | Tools / Triggers |
|---|---|---|---|
| **Human** (`@chenning007`) | Final decisions at 4 gates; priority changes; product direction | Reviews notifications → makes Approve/Reject decisions on GitHub | GitHub email, Slack, browser |
| **PM Agent** (`@pm`) | Product backlog, acceptance criteria, sprint planning, PRD | Creates and grooms issues; authors PRD updates | `/pm-create-feature-issue`, `/pm-sprint-planning`, `issue-triage` skill |
| **Architect Agent** (`@architect`) | System design, API contracts, security, ADRs | Writes ADRs; reviews PRs for P1–P9 compliance; unblocks Dev | `/architect-review`, `architecture-review` skill |
| **Dev Agent** (`@dev`) | Implementation, tests, PRs | Writes code; writes tests; opens PRs linked to issues | `/dev-implement-feature`, `/dev-code-review`, `extraction-script` skill |
| **Tester Agent** (`@tester`) | Quality, test plans, QA sign-off, bug reports | Writes test plans; executes tests; posts `✅ QA passed` | `/tester-write-test-plan`, `/tester-execute-tests` |
| **GitHub Automation** | CI, Dependabot, human-gate workflows, CODEOWNERS | Runs on push/PR/label events; blocks merges until checks pass | `.github/workflows/ci.yml`, `human-gates.yml`, `notify-human.yml`, `dependabot.yml` |

---

## Part 2 — The Continuous Collaboration Loop

This is how every feature moves from idea to shipped. The loop repeats for every milestone.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ① PM updates PRD                                                          │
│      ↓                                                                      │
│   ② GitHub fires Gate 1 → Human approves PRD                                │
│      ↓                                                                      │
│   ③ PM creates sprint issues → assigns roles → moves to Ready               │
│      ↓                                                                      │
│   ④ Architect picks up type:design issues → writes ADRs                     │
│      ↓                                                                      │
│   ⑤ GitHub fires Gate 2 → Human approves ADR                                │
│      ↓                                                                      │
│   ⑥ Architect unblocks Dev issues → Dev picks up type:feature issues         │
│      ↓  (IN PARALLEL)                                                       │
│   ⑥a Tester picks up type:test issues → writes test plan (before Dev done)  │
│      ↓                                                                      │
│   ⑦ Dev opens PR → CI runs automatically → PR marked ready_for_review       │
│      ↓                                                                      │
│   ⑧ GitHub fires Gate 3 → Human reviews + merges PR                         │
│      ↓                                                                      │
│   ⑨ Tester executes test plan → posts ✅ QA passed → issue moves to Done    │
│      ↓                                                                      │
│   ⑩ All milestone issues Done → Human triggers Gate 4 → Release shipped 🚢  │
│      ↓                                                                      │
│   ⑪ PM begins next milestone (loop back to ①)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key rule**: Steps ④ through ⑨ run in parallel across multiple issues. An Architect can work on M2 ADRs while Dev implements M1 features. A Tester can write M1 test plans while Dev is still coding. This parallelism is intentional — do not wait sequentially.

---

## Part 3 — Step-by-Step: Who Does What and When

### Step ① — PM Updates the PRD

| | |
|---|---|
| **Who** | PM Agent (`@pm`) |
| **Trigger** | New milestone starting, or a product decision that changes requirements |
| **Action** | Update `docs/PRD-Product-Selection-Module.md` — increment version, add/change requirements |
| **Output** | Updated PRD committed to a branch, PR opened |
| **What happens next** | GitHub `human-gates.yml` fires **Gate 1** → Human is notified |

**PM checklist before updating PRD**:
- [ ] Read the current PRD version fully
- [ ] Identify new requirements or changes from user feedback, market research, or road map
- [ ] Write requirements as observable outcomes — not implementation details
- [ ] Add `needs-human-signoff` label to the associated issue

---

### Step ② — Human Approves PRD (Gate 1)

| | |
|---|---|
| **Who** | Human (`@chenning007`) |
| **Trigger** | Email/Slack notification: "PRD Updated — Your Approval Required" |
| **Action** | Read the PRD diff → Approve or Reject in GitHub Actions |
| **Time needed** | 5–15 minutes |
| **What happens next** | ✅ Approved → PM creates sprint issues (Step ③). ❌ Rejected → PM revises PRD. |

**Human decision guide**:
- Does every new requirement map to a real user need?
- Are priorities correct for the current business context?
- Is anything missing that you expected to see?

---

### Step ③ — PM Creates Sprint Issues

| | |
|---|---|
| **Who** | PM Agent (`@pm`) |
| **Trigger** | PRD approved at Gate 1 |
| **Action** | Use `/pm-sprint-planning` → create ALL issues for the target milestone |
| **Output** | Issues created with: title, labels (`role:*`, `epic:*`, `P*`, `type:*`), milestone, assignee, full AC |
| **What happens next** | Design issues move to `Ready` → Architect picks them up (Step ④) |

**PM checklist for each issue**:
- [ ] Exactly one `role:*`, one `epic:*`, one `P*`, one `type:*` label
- [ ] Milestone assigned
- [ ] Assignee set (match role label to agent)
- [ ] Full acceptance criteria — observable, independently testable, unambiguous, PRD-traceable
- [ ] Dependencies listed (`Blocked by: #XX` if applicable)
- [ ] `type:design` issues moved to `Ready` first (they unblock everything else)
- [ ] `type:test` issues created for every feature group

**Dependency ordering**:
```
type:design (Architect) → type:feature (Dev) → type:test execution (Tester)
```

---

### Step ④ — Architect Writes Design Decisions (ADRs)

| | |
|---|---|
| **Who** | Architect Agent (`@architect`) |
| **Trigger** | `type:design role:architect` issue in `Ready` state |
| **Action** | Read the issue → design the solution → commit ADR to `docs/architecture/ADR-NNN-*.md` |
| **Output** | ADR committed; summary comment posted on the issue |
| **What happens next** | GitHub `human-gates.yml` fires **Gate 2** → Human is notified |

**Architect checklist**:
- [ ] Read `docs/ARCHITECTURE.md` to understand existing constraints
- [ ] Copy `docs/architecture/ADR-template.md` → fill all sections
- [ ] Verify P1–P9 compliance of the proposed design
- [ ] Update `docs/architecture/README.md` with a new row
- [ ] Link ADR from the GitHub Issue
- [ ] Add `needs-human-signoff` label

---

### Step ⑤ — Human Approves ADR (Gate 2)

| | |
|---|---|
| **Who** | Human (`@chenning007`) |
| **Trigger** | Email/Slack: "Architecture Decision Ready — Your Review Required" |
| **Action** | Read the ADR → Approve or Reject in GitHub Actions |
| **Time needed** | 10–20 minutes |
| **What happens next** | ✅ Approved → Architect unblocks Dev issues (Step ⑥). ❌ Rejected → Architect revises. |

**Human decision guide** (you don't need to evaluate every technical detail):
- Does it align with the product's privacy-first principles?
- Does it seem unnecessarily complex for what we're building?
- Are there any obvious risks or concerns?

---

### Step ⑥ — Architect Unblocks Dev; Dev Implements

| | |
|---|---|
| **Who** | Architect Agent → Dev Agent (`@dev`) |
| **Trigger** | Architect: ADR approved. Dev: `type:feature role:dev` issue in `Ready` state. |
| **Action (Architect)** | Post "Design complete — unblocked" comment on dependent issues; move them to `Ready` |
| **Action (Dev)** | Use `/dev-implement-feature` → create branch `feature/<#>-name` → write code + tests → open PR with `Closes #<issue-number>` |
| **Output** | PR opened, linked to issue |
| **What happens next** | CI runs automatically → if passing, mark PR `ready_for_review` → Gate 3 fires |

**Dev checklist (Definition of Done)**:
- [ ] All acceptance criteria implemented and manually verified
- [ ] P1–P9 self-review passed (use `architecture-review` skill)
- [ ] Unit tests for all new logic; 100% branch coverage for tool functions
- [ ] Extraction scripts: DOM fixture tests (valid page + unrecognized page)
- [ ] Integration tests for new API endpoints
- [ ] `pnpm test:unit && pnpm test:integration && pnpm test:security` all pass
- [ ] No secrets, no `eval()`, no `child_process`, no `any` without justification
- [ ] PR includes: What / Why / How / Tests added + `Closes #<issue-number>`
- [ ] Request Architect review if touching: API contracts, agent pipeline, extraction interface, IPC, DB schema

### Step ⑥a — Tester Writes Test Plan (In Parallel)

| | |
|---|---|
| **Who** | Tester Agent (`@tester`) |
| **Trigger** | `type:test role:tester` issue in `Ready` state (PM creates these at Step ③) |
| **Action** | Use `/tester-write-test-plan` → map every AC to test cases, every relevant P1–P9 principle to a verification test |
| **Output** | Test plan posted as a comment on the `type:test` issue |
| **What happens next** | Test plan is ready and waiting for Dev to finish (Step ⑦–⑧) |

**Tester checklist for test plans**:
- [ ] Every AC item has at least one test case (happy path + failure path)
- [ ] P1–P9 principles tested where relevant (P1 credential scan, P5 empty data, P9 auth)
- [ ] Edge cases and negative tests identified
- [ ] Entry criteria defined (when to start executing)
- [ ] Exit criteria defined (when to sign off)

---

### Step ⑦ — CI Runs Automatically

| | |
|---|---|
| **Who** | GitHub Actions (`ci.yml`) |
| **Trigger** | Every push to `feature/**`, `fix/**`, `spike/**`, `chore/**`, or PR to `main` |
| **Checks** | Lint → Typecheck → Unit tests → Integration tests (Postgres+Redis) → Security checks (secrets scan, eval ban, CVE audit) → Build → PR validation (branch name + linked issue) |
| **Output** | Green ✅ or red ❌ status checks on the PR |
| **What happens next** | If all green → Dev marks PR `ready_for_review` → Gate 3. If red → Dev fixes and pushes again. |

**No one needs to do anything manually here.** CI runs automatically. Dev monitors the results and fixes any failures.

---

### Step ⑧ — Human Reviews + Merges PR (Gate 3)

| | |
|---|---|
| **Who** | Human (`@chenning007`) |
| **Trigger** | Email/Slack: "PR Ready — Awaiting Human Review" |
| **Action** | Review PR diff → Approve and merge, or request changes |
| **Time needed** | 10–30 minutes depending on PR size |
| **What happens next** | ✅ Merged → Tester executes tests (Step ⑨). ❌ Changes requested → Dev fixes. |

**Human review focus** (CI already checked syntax, types, tests, and security):
- Does the code do what the linked issue describes?
- Does anything feel wrong or overly complex?
- Is there anything the user would notice that seems off?

---

### Step ⑨ — Tester Executes Tests and Signs Off

| | |
|---|---|
| **Who** | Tester Agent (`@tester`) |
| **Trigger** | Feature PR merged to `main`; Dev posts completion comment on feature issue |
| **Action** | Use `/tester-execute-tests` → run test plan → record results |
| **Output** | Test execution report posted on the `type:test` issue |
| **What happens next** | All AC pass + no P0/P1 bugs → post `✅ QA passed` on feature issue → move to `Done` |

**Tester actions after execution**:
- [ ] All AC items checked off on the feature issue
- [ ] Any failures → create `type:bug` issues using the bug-report template
- [ ] Post `✅ QA passed` only when: all AC pass AND no open P0/P1 bugs
- [ ] Move the feature issue to `Done` on the project board

**If bugs are found**:
1. Create a `type:bug role:dev` issue with: steps to reproduce, expected vs actual, severity, which P1–P9 principle was violated
2. Link it to the original feature issue
3. Do NOT post `✅ QA passed` until the bug is fixed and re-tested
4. Dev picks up the bug issue → fix → PR → Gate 3 → Tester re-verifies

---

### Step ⑩ — Human Approves Release (Gate 4)

| | |
|---|---|
| **Who** | Human (`@chenning007`) |
| **Trigger** | All issues in the milestone are `Done`; all P0/P1 tests have `✅ QA passed` |
| **Action** | Manually trigger: GitHub → Actions → "Human Approval Gates" → Run workflow → gate: `release-approval` |
| **Time needed** | 5–10 minutes |
| **What happens next** | ✅ Approved → PM cuts `release/vX.Y` branch, creates GitHub Release, closes milestone. 🚢 |

**Human pre-release checklist**:
- [ ] Open the milestone on GitHub — are ALL issues `Done`?
- [ ] Are there any open P0 or P1 bugs linked to this milestone?
- [ ] Is the PRD version current and correct?
- [ ] Are you happy with what shipped?

**How to trigger Gate 4**:
```
GitHub → Actions → "Human Approval Gates" → Run workflow
→ gate: release-approval
→ context: "All M1 issues done, ready to ship v0.2"
→ milestone: "M1 — Wizard + Extraction (US)"
→ Run workflow
```

---

### Step ⑪ — PM Starts Next Milestone

| | |
|---|---|
| **Who** | PM Agent (`@pm`) |
| **Trigger** | Current milestone released; or PM proactively created next-sprint issues earlier |
| **Action** | Loop back to Step ① — update PRD if needed, create issues for next milestone |
| **What happens next** | The loop repeats continuously |

**Best practice**: PM should create next-milestone issues WHILE the current milestone is still in progress. This ensures agents are never idle waiting for work.

---

## Part 4 — The Ad Hoc Gate: `needs-human-signoff`

Beyond the 4 automatic gates, **any AI agent can pause and ask the human at any time**.

| | |
|---|---|
| **Trigger** | Agent adds `needs-human-signoff` label to any issue or PR |
| **Notification** | Instant email + Slack via `notify-human.yml` |
| **Human action** | Read the agent's comment → post your decision → remove the label |
| **Agent action** | Wait until label is removed, then resume |

**Examples of when agents use this**:
- Architect is torn between two security options
- PM is unsure whether a feature should be P1 or P2
- Dev found an ambiguous requirement
- Tester found a P0 bug and needs hotfix go/no-go

**Human response templates** (copy-paste):
```
✅ Approved — proceed
```
```
❌ Rejected — [your reason]. Please [specific action].
```
```
The answer to your question is: [answer]. Please proceed with [direction].
```

---

## Part 5 — How Each Participant Finds Their Work

### Human
1. Watch your email/Slack for gate notifications
2. Visit the [Project Board](https://github.com/chenning007/OneSell/projects) weekly to see overall progress
3. Watch for `needs-human-signoff` labels

### PM Agent (`@pm`)
1. Filter issues: `role:pm` + `Ready` state
2. Pick the highest priority (`P0 → P1 → P2 → P3`)
3. Read PRD before every task
4. After completing work: move issue to `In Review` or `Done`

### Architect Agent (`@architect`)
1. Filter issues: `role:architect` + `Ready` state
2. Pick highest priority
3. Read `docs/ARCHITECTURE.md` before every task
4. After completing: post a summary comment, add `needs-human-signoff`, move to `In Review`

### Dev Agent (`@dev`)
1. Filter issues: `role:dev` + `Ready` state
2. Pick highest priority
3. Read the linked design issue / ADR before coding
4. After completing: open PR → CI runs → mark `ready_for_review`

### Tester Agent (`@tester`)
1. Filter issues: `role:tester` + `Ready` state
2. Pick highest priority
3. Read the linked feature issue's AC and the relevant `docs/ARCHITECTURE.md` sections
4. After completing: post results → `✅ QA passed` or file bugs

### GitHub Automation
- **CI** (`ci.yml`): runs on every push and PR — no manual action
- **Human Gates** (`human-gates.yml`): fires on PRD changes, new ADRs, PR ready, manual release — pauses and notifies human
- **Notify Human** (`notify-human.yml`): fires when `needs-human-signoff` label added — sends instant notification
- **Dependabot** (`dependabot.yml`): opens weekly PRs for outdated dependencies — auto-labeled `type:chore`
- **CODEOWNERS**: auto-assigns `@chenning007` as reviewer for security-critical paths

---

## Part 6 — Keeping the Pipeline Flowing: Common Stalls and Fixes

| Symptom | Root Cause | Who Fixes It | Action |
|---|---|---|---|
| No issues in `Ready` for a role | PM hasn't created or groomed issues | **PM** | Run `/pm-sprint-planning` for the current milestone |
| Dev issue in `Ready` but blocked by unfinished design | Architect hasn't completed the ADR | **Architect** | Prioritise the blocking `type:design` issue |
| PR has been `In Review` for 2+ days | Human hasn't reviewed at Gate 3 | **Human** | Check email for "PR Ready" notification; review and merge |
| Test plan not written yet but Dev is almost done | Tester hasn't started test planning | **Tester** | Pick up the `type:test` issue immediately — plans should be written BEFORE Dev finishes |
| Issue `In Progress` for 2+ days with no activity | Agent may be stuck or blocked | **Human** | Comment on the issue: "Status update?" |
| Bug filed but no one is working on it | Bug not assigned or not in `Ready` | **PM** | Assign the `type:bug` issue, set priority, move to `Ready` |
| `needs-human-signoff` label with no human response | Human missed the notification | **Human** | Check GitHub notifications; respond on the issue |
| PRD approved but no sprint issues created | PM didn't follow through after Gate 1 | **PM** | Run `/pm-sprint-planning` immediately |
| All issues Done but no release | Human hasn't triggered Gate 4 | **Human** | Go to Actions → Human Approval Gates → Run workflow |
| Dependabot PR sitting unmerged | No one reviewed the dependency update | **Human/Dev** | Review the Dependabot PR; merge if CI passes |
| CI failing on a PR | Code issue or flaky test | **Dev** | Read CI output → fix the failure → push again |
| Agent opened PR to `release/*` branch | Violation — only Human creates release branches | **Human** | Close the PR; comment explaining the rule |
| Issue closed without `✅ QA passed` | Tester gate bypassed | **Human** | Reopen the issue; comment: "QA sign-off required" |

---

## Part 7 — Starting the Project (One-Time Setup)

### For the Human — GitHub Setup (~30 min)

| # | What | Where |
|---|---|---|
| 1 | **Create labels** | Run `.github/scripts/bootstrap-labels.ps1 -Token "ghp_..." -DeleteDefaults` |
| 2 | **Create milestones** | github.com/chenning007/OneSell/milestones → New milestone |
| 3 | **Create Project Board** | github.com/chenning007/OneSell/projects → Board view with columns: `Backlog → Ready → In Progress → In Review → Done` |
| 4 | **Create 4 Environments** | Settings → Environments → create `prd-approval`, `architecture-approval`, `qa-signoff`, `release-approval` with yourself as Required Reviewer |
| 5 | **Enable branch protection** | Settings → Branches → Protect `main`: require PR, status checks, Code Owner review |
| 6 | **Enable notifications** | github.com → Settings → Notifications → enable Email for Actions + @mentions |
| 7 | **Optional: Slack** | Configure `SLACK_WEBHOOK_URL` secret for instant Slack notifications |

### For the Human — Create M0 Foundation Issues (~10 min)

Open `.github/M0-foundation-issues.md` and create the 8 issues with the correct labels and milestone. Move these to `Ready` immediately: M0-1, M0-2, M0-4, M0-7. The rest stay in `Backlog` until dependencies are met.

### For the Human — Start the Agents

In VS Code Copilot Chat, start each agent for the first time:

| Command | What it does |
|---|---|
| `@architect` — "Find the highest-priority `role:architect Ready` issue and begin work." | Kicks off Architect |
| `@pm` — "Find the highest-priority `role:pm Ready` issue and begin work." | Kicks off PM |
| `@dev` — "Find the highest-priority `role:dev Ready` issue and begin work." | Kicks off Dev |
| `@tester` — "Find the highest-priority `role:tester Ready` issue and begin work." | Kicks off Tester |

After the initial trigger, agents pick up work automatically by filtering for `Ready` issues with their role label.

---

## Part 8 — Quick Reference Cards

### For the Human — Gate Response Cheat Sheet

| Notification Subject | Gate | Time | Action |
|---|---|---|---|
| "PRD Updated — Your Approval Required" | Gate 1 | 5–15 min | Read PRD diff → Approve or Reject in GitHub Actions |
| "Architecture Decision Ready" | Gate 2 | 10–20 min | Read ADR → Approve or Reject in GitHub Actions |
| "PR Ready for Your Review" | Gate 3 | 10–30 min | Review PR diff → Approve+merge or request changes |
| "Release Ready — Your Go/No-Go" | Gate 4 | 5–10 min | Review milestone → Approve in GitHub Actions |
| "Your Decision Required" | Ad hoc | 5 min | Read issue comment → post your decision → remove label |

### For AI Agents — "What Do I Do Next?" Decision Tree

```
1. Filter GitHub Issues: role:<your-role> + Ready
2. Pick highest priority (P0 > P1 > P2 > P3)
3. Move issue to In Progress
4. Read the issue fully — AC, dependencies, architecture references
5. Do the work:
   PM      → create/groom issues, update PRD
   Architect → write ADR, review PR, unblock Dev
   Dev     → implement feature, write tests, open PR
   Tester  → write test plan or execute tests
6. Post deliverable:
   PM      → issues created → move to Done
   Architect → ADR committed → add needs-human-signoff → In Review
   Dev     → PR opened → CI passes → ready_for_review
   Tester  → test results posted → ✅ QA passed or bugs filed
7. Pick up next issue (go to step 1)
```

### For Everyone — Copilot Tools Reference

| Role | Agent | Prompts | Skills |
|---|---|---|---|
| PM | `@pm` | `/pm-create-feature-issue`, `/pm-sprint-planning` | `issue-triage` |
| Architect | `@architect` | `/architect-review` | `architecture-review` |
| Dev | `@dev` | `/dev-implement-feature`, `/dev-code-review` | `architecture-review`, `extraction-script` |
| Tester | `@tester` | `/tester-write-test-plan`, `/tester-execute-tests` | `extraction-script` |

---

## Part 9 — How to Give Feedback and Change Direction

The human can intervene at any point without waiting for a gate:

| Action | How to Do It | Impact |
|---|---|---|
| **Change priorities** | Update `P*` label on any issue | Agents pick highest-priority `Ready` issue next |
| **Reorder work** | Move issues between `Backlog` ↔ `Ready` on the project board | Controls what agents can pick up |
| **Give mid-work feedback** | Comment on any issue or PR | Agents read and incorporate your comments |
| **Request changes on a PR** | Add review comments before Gate 3 | Dev sees and addresses them |
| **Reject an ADR with notes** | At Gate 2: Reject + comment with specific concerns | Architect revises based on your feedback |
| **Reopen a Done issue** | Reopen the issue + comment what's wrong | PM will create a follow-up fix issue |
| **Create an urgent issue** | Create a `P0 type:bug` issue and assign it | Takes priority over all other work |
| **Pause all work** | Move all `Ready` issues back to `Backlog` | No agent picks up new work until you move issues back |

---

## Part 10 — What Each Participant Should Never Do

| Participant | Never Do This |
|---|---|
| **Human** | Write code directly; bypass CI; merge without passing checks; close issues without `✅ QA passed` |
| **PM Agent** | Write code; run tests; make architectural decisions; create release branches |
| **Architect Agent** | Write production features; execute tests; change acceptance criteria |
| **Dev Agent** | Change AC; make product decisions; self-close issues without Tester sign-off; merge to `main` |
| **Tester Agent** | Modify source code (only test files); change product requirements; self-approve features |
| **Any AI Agent** | Merge PRs to `main`; create `release/*` or `hotfix/*` branches; publish git tags; close milestones; delete AC on `role:pm` issues |

---

## Part 11 — Milestone Roadmap

| Milestone | Scope | Key Roles Active | Primary Gates |
|---|---|---|---|
| **M0 — Foundation** | Architecture, DB schema, auth, CI | Architect → Dev → Tester | Gate 2 (ADRs), Gate 3 (PRs), Gate 4 (release) |
| **M1 — Wizard + Extraction (US)** | Preference wizard, US platform extraction | PM → Architect → Dev → Tester | All 4 gates |
| **M2 — Agent + Results** | LLM agent pipeline, results UI | Architect → Dev → Tester | Gate 2, 3, 4 |
| **M3 — Quality & NFRs** | Security hardening, performance, a11y | Dev → Tester | Gate 3, 4 |
| **M4 — China Market** | China extractions, ZH-CN prompts, i18n | PM → Architect → Dev → Tester | All 4 gates |
| **M5 — Monetization** | Subscription tiers, access control | PM → Architect → Dev → Tester | All 4 gates |

---

*Questions about this process? Open a `type:question role:pm` issue on GitHub. The PM agent will respond and escalate to you if it needs a decision.*
