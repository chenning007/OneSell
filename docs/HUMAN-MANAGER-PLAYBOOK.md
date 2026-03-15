# OneSell Scout — Human Manager Playbook

**Who this is for**: You, `@chenning007` — the human owner of this project.  
**What it covers**: How to start the project, when AI agents need you, exactly what to do at each gate, and how to stay in control without micromanaging.  
**Version**: 1.0 | **Date**: 2026-03-15

---

## The One-Line Summary

> You make **decisions**. AI agents do **work**. GitHub Issues are the handshake between you and them.

The agents run 24/7 and coordinate through GitHub Issues and Pull Requests. They stop and wait at exactly four types of decision — and they will email you (or Slack you) the moment they need you. Outside of those gates, you do not need to do anything.

---

## Part 1 — Starting the Project (Do This Once)

### Step 1 — One-time GitHub setup (~30 min)

| # | What | Where |
|---|---|---|
| 1 | ✅ **Labels created** | Done — you ran `bootstrap-labels.ps1` |
| 2 | **Create milestones** | [github.com/chenning007/OneSell/milestones](https://github.com/chenning007/OneSell/milestones) → New milestone |
| 3 | **Create Project Board** | [github.com/chenning007/OneSell/projects](https://github.com/chenning007/OneSell/projects) → New project → Board view |
| 4 | **Create 4 Environments** | Settings → Environments → create each, add yourself as Required Reviewer |
| 5 | **Enable branch protection** | Settings → Branches → Add rule for `main` |
| 6 | **Enable email notifications** | github.com → Settings → Notifications → enable Email for Actions + @mentions |

#### Milestones to create
```
M0 — Foundation
M1 — Wizard + Extraction (US)
M2 — Agent + Results
M3 — Quality & NFRs
M4 — China Market
M5 — Monetization
```

#### Project Board columns to create (in this order)
```
Backlog → Ready → In Progress → In Review → Done
```

#### GitHub Environments to create (each with you as Required Reviewer)
```
prd-approval
architecture-approval
qa-signoff
release-approval
```

#### Branch protection settings for `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass (select all CI jobs once they appear)
- ✅ Require review from Code Owners
- ✅ Do not allow bypassing the above settings

---

### Step 2 — Create the M0 Foundation Issues (~10 min)

Open [.github/M0-foundation-issues.md](../.github/M0-foundation-issues.md).  
Create each of the **8 issues** on GitHub using the issue templates:

| Issue | Title | Labels | Assignee |
|---|---|---|---|
| M0-1 | [Architect] Define database schema | role:architect, epic:foundation, P0, type:design | Architect agent |
| M0-2 | [Architect] Define market config structure | role:architect, epic:foundation, P0, type:design | Architect agent |
| M0-3 | [Dev] Implement database schema and Drizzle ORM | role:dev, epic:foundation, P0, type:chore | Dev agent |
| M0-4 | [Dev] Backend env config and health endpoint | role:dev, epic:foundation, P0, type:chore | Dev agent |
| M0-5 | [Dev] Implement JWT auth middleware | role:dev, epic:foundation, P0, type:feature | Dev agent |
| M0-6 | [Dev] Redis-backed rate limiting | role:dev, epic:foundation, P0, type:feature | Dev agent |
| M0-7 | [Tester] Test plan for M0 Foundation | role:tester, epic:foundation, P0, type:test | Tester agent |
| M0-8 | [PM] Create M1 sprint issues from PRD §5 | role:pm, epic:foundation, P0, type:chore | PM agent |

Move M0-1, M0-2, M0-4, and M0-7 to **`Ready`** immediately.  
M0-3, M0-5, M0-6 stay in **`Backlog`** until M0-1 and M0-2 are approved.  
M0-8 stays in **`Backlog`** until M0-1 and M0-2 are approved.

---

### Step 3 — Trigger the agents

Tell each AI agent (in separate Copilot sessions) their role and that work is ready:

> *"You are the Architect agent for OneSell Scout. Read `.github/copilot-instructions.md`, then `docs/ARCHITECTURE.md` and `docs/PROJECT-MANAGEMENT.md`. Find the highest-priority `role:architect` issue in `Ready` state on GitHub and begin work."*

> *"You are the PM agent for OneSell Scout. Read `.github/copilot-instructions.md`, then `docs/PROJECT-MANAGEMENT.md` and `docs/PRD-Product-Selection-Module.md`. Find the highest-priority `role:pm` issue in `Ready` state and begin work."*

Agents for Dev and Tester use the same pattern with their role name.

**That's it — the agents take it from there.** You will receive notifications when they need you.

---

## Part 2 — Your Four Gates (What You Will Be Notified For)

These are the only moments in the project where work **stops and waits for you**. At every other moment, agents are working automatically.

---

### Gate 1 — PRD Approval

**When it happens**: The PM agent has updated `docs/PRD-Product-Selection-Module.md` with new requirements or a version bump.

**You will receive**:
- A GitHub Actions email with an **Approve / Reject** button (if you've set up the `prd-approval` Environment)
- A Slack DM (if `SLACK_WEBHOOK_URL` is configured)

**What to do**:
1. Click the link in the email → opens the GitHub Actions run
2. Read the PR or commit diff showing what changed in the PRD
3. Click **Approve** if the changes are correct
4. Click **Reject** (and post a comment explaining what needs to change) if not

**Impact of your decision**:
- ✅ Approved → PM agent creates sprint issues from the new PRD version. Dev and Tester agents get new work.
- ❌ Rejected → Everything stops. PM agent reads your comment and revises the PRD.

**Time expected**: 5–15 min read + 1-click decision.

---

### Gate 2 — Architecture Decision Approval (ADR)

**When it happens**: The Architect agent has authored a new Architecture Decision Record (e.g. database schema, API contract, security design) and committed it to `docs/architecture/ADR-NNN-*.md`.

**You will receive**: GitHub Actions email + optional Slack, with a link directly to the ADR file.

**What to do**:
1. Click the link → read the ADR (Problem Statement, Options, Decision, Consequences)
2. If the decision makes sense for the product: **Approve**
3. If you want changes: **Reject** → post a comment with specific questions or concerns

**Impact of your decision**:
- ✅ Approved → Architect agent unblocks dependent Dev issues. Implementation begins.
- ❌ Rejected → Architect agent revises the ADR based on your feedback.

**Time expected**: 10–20 min read + 1-click decision.

**Tip**: You don't need to understand every technical detail. Focus on: *Does this match the product's privacy principles? Does it seem unnecessarily complex? Does it align with what you want to build?* Trust the architecture for technical details you're not sure about — that's what the Architect is for.

---

### Gate 3 — Pull Request Review

**When it happens**: A Dev agent has completed a feature, all CI checks have passed, and the PR is marked `ready_for_review`.

**You will receive**: A GitHub email notification + optional Slack, with a link to the PR.

**What to do**:
1. Click the PR link
2. Read the PR description: **What**, **Why**, **How**, **Tests added**
3. Click **Files changed** to review the diff — focus on:
   - Does it match the acceptance criteria on the linked issue?
   - Does anything look like it could be a security problem?
   - Is it the feature you expected?
4. Click **Approve** on the PR review and merge, or request changes with a comment

**Impact of your decision**:
- ✅ Merged → Tester agent runs test execution. Feature gets `✅ QA passed` when done.
- ❌ Changes requested → Dev agent reads your comment and updates the PR.

**Time expected**: 10–30 min depending on PR size.

**Tip**: You don't need to review every line. The CI pipeline has already checked: lint, type safety, unit tests, integration tests, security scans, no secrets, no eval(). Your review covers correctness of intent, not correctness of syntax.

---

### Gate 4 — Release Approval

**When it happens**: All issues in a milestone are `Done`, all P0/P1 tests have `✅ QA passed`. The Tester agent (or you manually) triggers the release gate workflow.

**You will receive**: GitHub Actions email + optional Slack summarising what is in the release.

**What to do**:
1. Click the link → review the milestone on GitHub (all issues should be `Done`)
2. If you're happy with what shipped: **Approve**
3. If something doesn't feel right: **Reject** → post what needs to be fixed first

**Impact of your decision**:
- ✅ Approved → PM agent cuts `release/vX.Y` branch, creates GitHub Release with release notes, closes the milestone, merges back to `main`. 🚢
- ❌ Rejected → No release. Agents fix the outstanding issues first.

**Trigger the release gate manually** (when you're ready, after all milestone issues are Done):

```
GitHub → Actions → "Human Approval Gates" → Run workflow
→ gate: release-approval
→ context: "All M0 issues done, ready to ship v0.1"
→ milestone: "M0 — Foundation"
→ Run workflow
```

---

## Part 3 — The `needs-human-signoff` Label (Ad Hoc Gate)

In addition to the four automatic gates, **any AI agent can pause and ask for your input at any time** by adding the `needs-human-signoff` label to an issue or PR.

When this happens:
- You get an email + Slack notification immediately
- The issue/PR title and description tell you exactly what question needs answering

**Your response** (always on GitHub — not by email reply):
1. Open the link in the notification
2. Read the AI agent's comment on the issue — it will say:
   - What was completed
   - What specific decision is needed
   - What happens if you approve vs reject
3. Post a comment with your answer
4. Remove the `needs-human-signoff` label from the issue

Examples of when agents use this:
- Architect is unsure between two security options and needs your preference
- PM needs to confirm a product decision before writing acceptance criteria
- Dev encountered an ambiguous requirement and needs clarification before coding
- Tester found a P0 bug in production and needs a hotfix go/no-go

---

## Part 4 — How Agents Coordinate With Each Other

You don't need to manage this — but it helps to understand the flow:

```
You create M0 issues in "Ready"
        ↓
Architect picks up M0-1, M0-2 → writes ADRs → commits to docs/architecture/
        ↓
[Gate 2: You approve ADRs]
        ↓
Architect comments on M0-3, M0-5, M0-6: "Blocked by M0-1/M0-2" → now unblocked
PM picks up M0-8 → creates M1 sprint issues
        ↓
Dev picks up M0-3, M0-4, M0-5, M0-6 → branches: feature/3-..., feature/5-...
Tester picks up M0-7 → writes test plan before Dev finishes
        ↓
Dev opens PRs → CI runs automatically → PRs marked ready_for_review
        ↓
[Gate 3: You review and merge PRs]
        ↓
Tester executes test plan → posts ✅ QA passed on each issue
        ↓
Issues move to Done → milestone complete
        ↓
[Gate 4: You approve release]
        ↓
🚢 v0.1 shipped → M1 sprint begins automatically (PM already created those issues)
```

Agents do not wait for you between steps — only at the 4 gates. An architect can be writing M1 ADRs while a dev is implementing M0 features. A tester can write test plans before Dev finishes code. This is intentional parallelism.

---

## Part 5 — How to Give Feedback on Work In Progress

You don't have to wait for a gate to give feedback. At any point you can:

**Comment on any issue**: agents watch all issues they're assigned to and will incorporate your feedback.

**Request changes on a PR**: even before the formal review gate, you can add review comments on a PR.

**Reject an ADR with detailed notes**: just click Reject and write "Please reconsider option B because [reason]. The main concern is [concern]." The Architect will revise.

**Reopen an issue**: if a `Done` issue was actually not correct, reopen it and add a comment. The PM agent will pick it up and create a fix issue.

**Change priorities**: on any issue, change the `P0`→`P1` label or move it on the project board. Agents always pick the highest-priority `Ready` issue, so re-labelling immediately changes what gets worked on next.

---

## Part 6 — Warning Signs and How to Handle Them

| What you see | What it means | What to do |
|---|---|---|
| An issue has been `In Progress` for more than 2 days with no activity | Agent may be blocked silently | Open the issue, comment "Status update?" |
| A PR has failing CI checks but agent marked it `ready_for_review` | Agent submitted too early | Request changes: "CI is failing — please fix the failing checks before requesting review" |
| `needs-human-signoff` label added but no notification email received | Notifications not configured | Check `github.com > Settings > Notifications` — enable email for Actions and @mentions |
| Agent opened a PR to `release/*` or `hotfix/*` branch | Agent violated the rule (only you create those branches) | Close the PR, comment "This branch must be created by the human PM only. Please reopen against `main` via a feature branch." |
| An issue's acceptance criteria were changed after Dev started | Process violation | Post a comment: "AC cannot change after work begins. Open a new issue for the change instead." |
| An issue closed without `✅ QA passed` comment | Tester gate was bypassed | Reopen the issue. Comment: "This issue must not be closed without Tester QA sign-off." |

---

## Part 7 — Quick Reference Card

### When you get a GitHub/Slack notification, look for this pattern:

| Subject line contains | It's a... | You need to... |
|---|---|---|
| `PRD Updated — Your Approval Required` | Gate 1 | Read PRD diff → Approve or Reject in GitHub Actions |
| `Architecture Decision Ready` | Gate 2 | Read ADR → Approve or Reject in GitHub Actions |
| `PR Ready for Your Review` | Gate 3 | Review PR diff → Approve and merge, or request changes |
| `Release Ready — Your Go/No-Go` | Gate 4 | Review milestone → Approve in GitHub Actions |
| `Your Decision Required` | Ad hoc `needs-human-signoff` | Read issue comment → post your answer as a comment |

### Your responses on GitHub (copy-paste ready):

```
✅ Approved — proceed
```
```
❌ Rejected — [your reason]. Please [specific action you want].
```
```
❌ Rejected — please revisit option B from the ADR. My main concern is [concern]. Come back with a revised proposal.
```
```
Changes requested — [specific thing that needs to change]. Please update and re-request review.
```

### To change what agents work on next:
1. Open the GitHub Project Board
2. Move an issue from `Backlog` → `Ready` (or `Ready` → `Backlog`)
3. Change the priority label (`P0`, `P1`, `P2`, `P3`)
4. Agents automatically pick the highest-priority `Ready` issue next time they start

---

## Part 8 — What You Should Never Need to Do

These are things the agents handle. If you find yourself doing them, something has gone wrong with the setup:

- Writing code, running tests, or debugging errors directly
- Creating feature branches or merging PRs without running CI
- Manually updating `docs/ARCHITECTURE.md` without an ADR
- Closing issues without a Tester `✅ QA passed` comment
- Creating `release/*` branches from outside the release workflow
- Making product decisions in Slack or email without creating a GitHub Issue

If you want to override any of this — that's fine, you're the owner — but document the decision as a comment on the relevant GitHub Issue so the agents have context.

---

*Questions? Open a `type:question role:pm` issue on GitHub. The PM agent will respond and escalate to you if it needs a decision.*
