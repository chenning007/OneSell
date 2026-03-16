# Issue Triage Skill

## Purpose
Triage, create, and validate GitHub Issues for OneSell Scout following the project management rules. Use this skill when creating issues, validating existing issues, or grooming the backlog.

## When to Use
- Creating a new issue from a PRD section
- Validating that an issue has all required fields before moving to `Ready`
- Grooming the backlog — checking labels, milestones, AC quality
- Converting a bug report into a properly structured issue

## Issue Validation Checklist

Every issue must have ALL of the following before it can be `Ready`:

### Labels (all required)
- [ ] Exactly one `role:*` label (`role:pm`, `role:architect`, `role:dev`, `role:tester`)
- [ ] Exactly one `epic:*` label (`epic:foundation`, `epic:wizard`, `epic:extraction`, `epic:agent`, `epic:results-ui`, `epic:china`, `epic:security-nfr`, `epic:monetization`)
- [ ] Exactly one priority label (`P0`, `P1`, `P2`, `P3`)
- [ ] Exactly one `type:*` label (`type:feature`, `type:design`, `type:test`, `type:bug`, `type:question`, `type:chore`)

### Metadata
- [ ] Milestone assigned (`M0`–`M5`)
- [ ] Assignee set (match role label to team member)
- [ ] Linked to epic issue (if applicable)

### Acceptance Criteria Quality (for `type:feature`)
Each criterion must be:
- **Observable** — describes an outcome, not an implementation step
- **Independently testable** — a Tester can verify without code access
- **Unambiguous** — only one interpretation
- **PRD-traceable** — maps to a specific PRD section

**Red flags in AC that must be rewritten:**
- "should work correctly" → too vague
- "implement X using Y" → describes implementation, not outcome
- "update the database" → not observable by a user/tester
- No PRD section reference → cannot trace requirement

### Dependencies
- [ ] Architecture dependencies listed (link to `type:design` issues)
- [ ] Blocked issues noted with `Blocked by: #XX`
- [ ] No circular dependencies

## Issue Templates Reference

| Template | Used For | Required Labels |
|---|---|---|
| Feature | New capability for Dev | `role:dev`, `type:feature`, epic, priority |
| Design | Architecture decision for Architect | `role:architect`, `type:design`, epic, priority |
| Test Plan | Test planning for Tester | `role:tester`, `type:test`, epic, priority |
| Bug Report | Defect found in testing | `role:dev`, `type:bug`, epic, priority |
| Question | Blocker needing PM resolution | `role:pm`, `type:question`, epic, priority |
| Chore | Build, config, or tooling change | `role:dev`, `type:chore`, epic, priority |

## Milestone Reference

| Milestone | Scope |
|---|---|
| M0 — Foundation | Architecture design, tech stack, repo setup |
| M1 — Wizard + Extraction (US) | Preference wizard, US extraction |
| M2 — Agent + Results | LLM agent pipeline, results UI |
| M3 — Quality & NFRs | Security, performance, accessibility |
| M4 — China Market | China platform extraction, ZH-CN prompts |
| M5 — Monetization | Tier enforcement, subscription access |
