# OneSell Scout — File Directory for All Users

**Who this is for**: Everyone — human manager, PM agent, Architect agent, Dev agent, Tester agent.  
**Purpose**: One reference showing every file, who uses it, what it is, and how.

> **Legend for "Primary User" column**  
> 👤 Human (`@chenning007`) · 🤖PM (PM agent) · 🏗️Arch (Architect agent) · 👨‍💻Dev (Dev agent) · 🧪Test (Tester agent) · ⚙️Auto (GitHub Actions — runs automatically)

---

## 1. Start Here — Everyone

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [docs/HUMAN-MANAGER-PLAYBOOK.md](HUMAN-MANAGER-PLAYBOOK.md) | All participants | Collaboration playbook for the entire team | **Read this first.** Covers who does what, when, the continuous collaboration loop (Steps ①–⑪), all 4 human gates, how every participant finds their work, and how to keep the pipeline flowing. |
| [README.md](../README.md) | 👤 Human · all agents | Project overview and repo map | Orientation doc — explains what OneSell Scout is and where everything lives. |

---

## 2. Product & Process — Rules Every Agent Reads Before Starting

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [docs/PROJECT-MANAGEMENT.md](PROJECT-MANAGEMENT.md) | 👤 Human · all agents | The law of how work flows | Every agent reads this before picking up any issue. Defines roles, labels, issue lifecycle, Definition of Done, branching, and release flow. |
| [docs/PRD-Product-Selection-Module.md](PRD-Product-Selection-Module.md) | 🤖PM · 👤 Human | Product requirements document | PM agent authors and versions this. Human approves changes at Gate 1. All acceptance criteria trace back to sections in this doc. |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | 🏗️Arch · 👨‍💻Dev · 🧪Test | The complete system design | Authoritative source for all technical decisions. Dev and Tester must read before any implementation or test work. Contains the 9 binding architectural principles (P1–P9), all interface contracts, directory structures, security model, and extension patterns. |

---

## 3. Role-Specific Guides

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [docs/guides/DEVELOPER-GUIDE.md](guides/DEVELOPER-GUIDE.md) | 👨‍💻Dev | Dev operating manual | Read before writing any code. Covers: how to pick up issues, code standards, architectural principle compliance checklist, Definition of Done, PR hygiene, and extension patterns (how to add a platform, market, or tool). |
| [docs/guides/TESTER-GUIDE.md](guides/TESTER-GUIDE.md) | 🧪Test | Tester operating manual | Read before writing any tests. Covers: how testing is triggered by issues, test categories (unit/integration/contract/security/E2E), architectural principle test requirements, bug reporting standard, and the QA sign-off gate. |

---

## 4. Architecture Decisions

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [docs/architecture/README.md](architecture/README.md) | 🏗️Arch · 👤 Human | Index of all ADRs | Architect keeps this updated. Human reads it to see what design decisions have been made. |
| [docs/architecture/ADR-template.md](architecture/ADR-template.md) | 🏗️Arch | Blank ADR template | Architect copies this, renames to `ADR-NNN-short-title.md`, fills it in for every architectural decision that affects a component boundary, technology choice, or security posture. Each completed ADR triggers Gate 2 (human approval). |

---

## 5. GitHub Copilot Automation

### Global Instructions (read by all Copilot sessions)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/copilot-instructions.md](../.github/copilot-instructions.md) | All agents | Master rules for all AI agents | Copilot reads this automatically in every session. Defines role responsibilities, the issue-driven process, branching rules, the 4 human gates, notification setup, and what agents must never do without human approval. **Do not edit without human review.** |

### Role-Scoped Instructions (auto-applied by file path)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/instructions/pm.instructions.md](../.github/instructions/pm.instructions.md) | 🤖PM | PM-specific Copilot rules | Auto-applied when Copilot works on `docs/PRD-*.md` or issue templates. Contains AC writing standard, label reference, and PRD version convention. |
| [.github/instructions/architect.instructions.md](../.github/instructions/architect.instructions.md) | 🏗️Arch | Architect-specific Copilot rules | Auto-applied when Copilot works on `docs/architecture/**`. Contains P1–P9 enforcement checklist, ADR process, interface contract reference, security review checklist. |
| [.github/instructions/dev.instructions.md](../.github/instructions/dev.instructions.md) | 👨‍💻Dev | Dev-specific Copilot rules | Auto-applied when Copilot works on `onesell-client/**` or `onesell-backend/**`. Contains full DoD checklist, code standards, extension patterns. |
| [.github/instructions/tester.instructions.md](../.github/instructions/tester.instructions.md) | 🧪Test | Tester-specific Copilot rules | Auto-applied when Copilot works on `tests/**`. Contains principle-to-test mapping, test category guide, sign-off gate rules. |
### Custom Agents (invoke with `@agent-name` in VS Code Copilot Chat)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/agents/pm.agent.md](../.github/agents/pm.agent.md) | 🤖PM | PM agent definition | Use `@pm` in Copilot Chat to activate the PM agent with pre-configured tool access for issue creation and sprint planning. |
| [.github/agents/architect.agent.md](../.github/agents/architect.agent.md) | 🏗️Arch | Architect agent definition | Use `@architect` in Copilot Chat for ADR creation, architecture reviews, and security reviews. |
| [.github/agents/dev.agent.md](../.github/agents/dev.agent.md) | 👨‍💻Dev | Developer agent definition | Use `@dev` in Copilot Chat for feature implementation, test writing, and PR preparation. |
| [.github/agents/tester.agent.md](../.github/agents/tester.agent.md) | 🧪 Test | Tester agent definition | Use `@tester` in Copilot Chat for test plan creation, test execution, and QA sign-off. |

### Custom Skills (auto-referenced by agents and prompts)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/skills/architecture-review/SKILL.md](../.github/skills/architecture-review/SKILL.md) | 🏗️Arch · 👨‍💻Dev | Architecture review skill | Provides the full P1–P9 compliance checklist and structured review report template. Referenced by `@architect` agent and `/architect-review` prompt. |
| [.github/skills/issue-triage/SKILL.md](../.github/skills/issue-triage/SKILL.md) | 🤖PM | Issue triage skill | Validates issues have all required labels, AC quality, and dependencies. Referenced by `@pm` agent and `/pm-create-feature-issue` prompt. |
| [.github/skills/extraction-script/SKILL.md](../.github/skills/extraction-script/SKILL.md) | 👨‍💻Dev · 🧪 Test | Extraction script skill | Step-by-step patterns for creating extraction scripts with safe DOM queries and test fixtures. Referenced by `@dev` agent and `/dev-implement-feature` prompt. |
### Agent Prompt Files (invoke with `/` in VS Code Copilot Chat)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/prompts/pm-create-feature-issue.prompt.md](../.github/prompts/pm-create-feature-issue.prompt.md) | 🤖PM | Prompt: create a feature issue from a PRD section | PM agent runs this to turn a PRD section into a fully-formed GitHub Issue body with labels and AC. In VS Code: open Copilot Chat → type `/pm-create-feature-issue`. |
| [.github/prompts/architect-review.prompt.md](../.github/prompts/architect-review.prompt.md) | 🏗️Arch | Prompt: review a PR or design for P1–P9 compliance | Architect agent runs this to produce a structured findings table before approving a PR. In VS Code: `/architect-review`. |
| [.github/prompts/dev-implement-feature.prompt.md](../.github/prompts/dev-implement-feature.prompt.md) | 👨‍💻Dev | Prompt: implement a feature from a GitHub Issue | Dev agent runs this to get step-by-step implementation guidance, DoD reminders, and a ready-to-submit PR description. In VS Code: `/dev-implement-feature`. |
| [.github/prompts/tester-write-test-plan.prompt.md](../.github/prompts/tester-write-test-plan.prompt.md) | 🧪Test | Prompt: write a test plan for a feature issue | Tester agent runs this to produce a complete test plan comment, mapping every AC to a test case and every relevant P1–P9 principle to a test requirement. In VS Code: `/tester-write-test-plan`. |

---

## 6. GitHub Issue Templates (used when creating issues)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/ISSUE_TEMPLATE/config.yml](../.github/ISSUE_TEMPLATE/config.yml) | ⚙️Auto | Disables blank issues; adds project board link | GitHub uses this automatically. No action needed. |
| [.github/ISSUE_TEMPLATE/feature.yml](../.github/ISSUE_TEMPLATE/feature.yml) | 🤖PM | Template A — new feature or capability | PM agent (or human) selects "Feature / Implementation" when creating a `role:dev` issue. Pre-fills dropdowns for epic, priority, milestone. Asks for context, acceptance criteria, dependencies, and architecture reference. |
| [.github/ISSUE_TEMPLATE/design.yml](../.github/ISSUE_TEMPLATE/design.yml) | 🤖PM · 🏗️Arch | Template B — architecture decision issue | PM creates this to assign design work to Architect. Architect fills in the Decision section when resolved, then commits an ADR. |
| [.github/ISSUE_TEMPLATE/test-plan.yml](../.github/ISSUE_TEMPLATE/test-plan.yml) | 🤖PM · 🧪Test | Template C — test plan issue | PM creates for every epic/feature; Tester fills in the test cases and execution findings. Must be created **before** Dev finishes implementation. |
| [.github/ISSUE_TEMPLATE/bug-report.yml](../.github/ISSUE_TEMPLATE/bug-report.yml) | 🧪Test · 👨‍💻Dev | Template D — bug report | Used whenever a test fails or a defect is found. Includes severity, steps to reproduce, and a dropdown for which architectural principle was violated (if any). |
| [.github/ISSUE_TEMPLATE/question.yml](../.github/ISSUE_TEMPLATE/question.yml) | All agents | Template E — open question blocking progress | Any agent creates this when a decision is needed before work can continue. Auto-labels `role:pm`. PM resolves within 1 business day. |
| [.github/ISSUE_TEMPLATE/chore.yml](../.github/ISSUE_TEMPLATE/chore.yml) | 👨‍💻Dev | Template F — chore / tooling | Used for build system changes, config updates, CI/CD tweaks, or dependency upgrades. Auto-labels `type:chore`. |

---

## 7. Pull Request Template

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/pull_request_template.md](../.github/pull_request_template.md) | 👨‍💻Dev | PR description template | Pre-fills automatically whenever Dev opens a PR. Must include `Closes #<issue-number>`, type of change checklist, developer DoD checklist, and review routing checkboxes. If the PR touches security boundaries, Dev must check "Architect review requested." |

---

## 8. GitHub Actions Workflows (run automatically — no manual action needed unless noted)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | ⚙️Auto | CI pipeline | Runs automatically on every push and PR. Jobs: lint → typecheck → unit tests → integration tests (with Postgres + Redis) → security checks (secret scan, eval/shell ban, CVE audit) → build → PR validation (branch name + linked issue check). **You see results on every PR.** |
| [.github/workflows/human-gates.yml](../.github/workflows/human-gates.yml) | ⚙️Auto · 👤 Human | The 4 approval gate workflows | Fires automatically when PRD changes (Gate 1), new ADR committed (Gate 2), PR marked ready (Gate 3). Gate 4 (release) is triggered manually: Actions → "Human Approval Gates" → Run workflow. **You act on these by clicking Approve/Reject in the email you receive.** |
| [.github/workflows/notify-human.yml](../.github/workflows/notify-human.yml) | ⚙️Auto · 👤 Human | Ad-hoc notification on `needs-human-signoff` label | Fires whenever any issue or PR gets the `needs-human-signoff` label. Sends Slack + email instantly. **You respond by posting a comment on GitHub**, then removing the label. |

---

## 9. Scripts (run manually by human)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/scripts/bootstrap-labels.ps1](../.github/scripts/bootstrap-labels.ps1) | 👤 Human | Creates all 24 GitHub labels via REST API | **Run once** after repo creation. Requires a GitHub Personal Access Token. Command: `.\.github\scripts\bootstrap-labels.ps1 -Token "ghp_..." -DeleteDefaults` |
| [.github/scripts/bootstrap-labels.sh](../.github/scripts/bootstrap-labels.sh) | 👤 Human (Linux/Mac) | Same as above, bash version using `gh` CLI | Run on Linux/Mac if `gh` CLI is installed: `bash .github/scripts/bootstrap-labels.sh --delete-defaults` |

---

## 10. GitHub Access Control

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.github/CODEOWNERS](../.github/CODEOWNERS) | ⚙️Auto · 👤 Human | Automatic PR review routing by file path | GitHub reads this automatically. Routes PRs to `@chenning007` for all security-critical paths (extraction layer, agent pipeline, auth middleware, DB schema, ADRs, workflows). No action needed — reviewers are auto-assigned when a PR is opened. |
| [.github/M0-foundation-issues.md](../.github/M0-foundation-issues.md) | 👤 Human | Pre-written M0 issue bodies | **Used once** at project start. Open this file, copy each issue block, and create it as a GitHub Issue with the specified labels and milestone. After all M0 issues are created, this file is no longer needed. |

---

## 11. Monorepo Configuration (used by agents and CI)

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [package.json](../package.json) | 👨‍💻Dev · ⚙️Auto | Root monorepo scripts | Defines workspace-level commands (`pnpm test:unit`, `pnpm build`, etc.) that the CI pipeline runs. Dev agents use these commands locally. |
| [pnpm-workspace.yaml](../pnpm-workspace.yaml) | 👨‍💻Dev · ⚙️Auto | Declares the two workspace packages | Tells pnpm that `onesell-client` and `onesell-backend` are part of the monorepo. No editing needed. |
| [tsconfig.base.json](../tsconfig.base.json) | 👨‍💻Dev | Shared TypeScript config | Both packages extend this. Enforces `strict: true`. Dev never edits this without Architect review. |
| [docker-compose.yml](../docker-compose.yml) | 👨‍💻Dev | Local dev database + cache | Dev agents (and you) run `docker compose up -d` to start Postgres 16 + Redis 7 locally before running integration tests or the backend dev server. |
| [.env.example](../.env.example) | 👨‍💻Dev | All required environment variables | Copy to `.env` and fill in real values. Shows every variable the backend needs (DB URL, Redis URL, JWT keys, LLM API keys). Never commit the `.env` file — it's in `.gitignore`. |
| [.gitignore](../.gitignore) | ⚙️Auto | Files git never tracks | Excludes `node_modules/`, `dist/`, `.env`, logs. No editing needed. |
| [.github/dependabot.yml](../.github/dependabot.yml) | ⚙️Auto | Automated dependency updates | Dependabot opens PRs weekly for outdated npm packages and GitHub Actions. PRs are auto-labeled `type:chore`. |

---

## 12. VS Code Workspace Configuration

| File | Primary User | What it is | How to use it |
|---|---|---|---|
| [.vscode/settings.json](../.vscode/settings.json) | All agents · 👤 Human | Shared editor settings | Auto-format on save with Prettier, ESLint fix on save, TypeScript SDK pointing to workspace version. No action needed — VS Code applies these automatically. |
| [.vscode/extensions.json](../.vscode/extensions.json) | 👤 Human | Recommended extensions | VS Code prompts to install these on first open. Includes ESLint, Prettier, Copilot, GitLens, Vitest Explorer, and Playwright. |

---

## 13. Backend Source (skeleton — implemented by Dev agents in M0–M2)

| File / Directory | Primary User | What it is | How to use it |
|---|---|---|---|
| [onesell-backend/src/index.ts](../onesell-backend/src/index.ts) | 👨‍💻Dev | Fastify app entry point | Dev agent wires plugins and routes here. Currently has `/healthz`. Run dev server: `pnpm dev:backend`. |
| [onesell-backend/src/env.ts](../onesell-backend/src/env.ts) | 👨‍💻Dev | Zod environment validation | Validates all env vars at startup. Add new variables here; add them to `.env.example` too. Never access `process.env` directly elsewhere — always import from `env.ts`. |
| [onesell-backend/src/api/middleware/](../onesell-backend/src/api/middleware/) | 👨‍💻Dev | Auth, rate-limit, Zod validation middleware | Dev implements in M0 (auth, rate-limit) per issues M0-5 and M0-6. Each middleware is a separate file. |
| [onesell-backend/src/api/routes/](../onesell-backend/src/api/routes/) | 👨‍💻Dev | Fastify route handlers | Dev implements in M1 (auth, analysis, user routes) per PRD §5 and Architecture §5.1. |
| [onesell-backend/src/services/agent/](../onesell-backend/src/services/agent/) | 👨‍💻Dev · 🏗️Arch | LLM agent pipeline (Planner → Executor → Synthesizer) | Dev implements in M2. Architect must review all PRs touching this directory. Contains `ToolRegistry` and `LLMProvider` abstraction. |
| [onesell-backend/src/services/agent/tools/](../onesell-backend/src/services/agent/tools/) | 👨‍💻Dev | Deterministic tool functions | Each file is a pure function (no side effects, same input → same output). 100% branch coverage required. LLM never generates numbers — only these tools do. |
| [onesell-backend/src/services/agent/prompts/](../onesell-backend/src/services/agent/prompts/) | 👨‍💻Dev · 🤖PM | Market-specific LLM system prompts | One `.ts` file per market. Dev implements; PM reviews content for tone and accuracy. |
| [onesell-backend/src/services/market/](../onesell-backend/src/services/market/) | 👨‍💻Dev | Market config service | Config-driven (Principle P8). Markets, platforms, fee structures are data here — never hardcoded in logic. |
| [onesell-backend/src/services/user/](../onesell-backend/src/services/user/) | 👨‍💻Dev | User account, preferences, saved lists | All queries filter by `userId` from JWT — never from request body (security requirement P9). |
| [onesell-backend/src/db/](../onesell-backend/src/db/) | 👨‍💻Dev · 🏗️Arch | Drizzle ORM schema + DB client | Architect defines schema (ADR-001); Dev implements. All queries parameterized through Drizzle — no raw SQL string concatenation. |
| [onesell-backend/package.json](../onesell-backend/package.json) | 👨‍💻Dev | Backend package manifest + scripts | Lists all dependencies. Dev adds packages here. Run `pnpm install` after changes. |
| [onesell-backend/tsconfig.json](../onesell-backend/tsconfig.json) | 👨‍💻Dev | Backend TypeScript config | Extends `tsconfig.base.json`. Targets Node 20 / ESM. Do not weaken `strict` settings. |
| [onesell-backend/vitest.config.ts](../onesell-backend/vitest.config.ts) | 👨‍💻Dev · 🧪Test | Test runner config | Configures Vitest with coverage thresholds. Tester may adjust coverage targets via an issue — never reduce below the minimums without Architect approval. |
| [onesell-backend/tests/setup.ts](../onesell-backend/tests/setup.ts) | 👨‍💻Dev | Global test setup | Sets test environment variables so `env.ts` validation passes in CI. Dev updates when new required env vars are added. |

---

## 13. Client Source (skeleton — implemented by Dev agents in M1–M2)

| File / Directory | Primary User | What it is | How to use it |
|---|---|---|---|
| [onesell-client/src/shared/types/MarketContext.ts](../onesell-client/src/shared/types/MarketContext.ts) | 👨‍💻Dev · 🏗️Arch | **Authoritative** `MarketContext` interface | Every component that is market-aware receives this as an explicit, immutable parameter. Changing the `marketId` union type requires an ADR and Architect approval. |
| [onesell-client/src/shared/types/ExtractionScript.ts](../onesell-client/src/shared/types/ExtractionScript.ts) | 👨‍💻Dev · 🏗️Arch | **Authoritative** `ExtractionScript` plugin interface | Every new platform implements this. Any change to the interface requires an ADR. `extractFromPage()` must return `null` (never throw) for unrecognized pages. |
| [onesell-client/src/shared/types/AnalysisPayload.ts](../onesell-client/src/shared/types/AnalysisPayload.ts) | 👨‍💻Dev · 🏗️Arch | **Authoritative** `AnalysisPayload` interface | The only data that crosses the client-to-backend boundary. Security rule (P1): no credential field may ever appear in this type. Changing this interface requires an ADR. |
| [onesell-client/src/shared/types/ProductRecord.ts](../onesell-client/src/shared/types/ProductRecord.ts) | 👨‍💻Dev · 🏗️Arch | **Authoritative** `ProductRecord` + `ProductCard` interfaces | Pipeline contract produced by Scout and consumed by future modules (Sourcing, Listing). `estimatedMargin` is always `0.0–1.0` float, never a percentage. Changing this requires an ADR. |
| [onesell-client/src/shared/types/index.ts](../onesell-client/src/shared/types/index.ts) | 👨‍💻Dev | Type barrel export | Import all shared types from here: `import type { MarketContext } from '../shared/types'`. |
| [onesell-client/src/main/](../onesell-client/src/main/) | 👨‍💻Dev | Electron Main Process | Implements ExtractionManager, PayloadBuilder, BackendClient, SessionStore, IPC handlers. **Credentials must never be captured or transmitted from this process.** |
| [onesell-client/src/main/extraction/](../onesell-client/src/main/extraction/) | 👨‍💻Dev | Extraction layer | ExtractionManager orchestrates flows; ExtractionScriptRegistry maps platformId → script. Architect must review PRs touching these two files. |
| [onesell-client/src/main/extraction/scripts/](../onesell-client/src/main/extraction/scripts/) | 👨‍💻Dev | Platform extraction scripts (plugins) | One subdirectory per platform. Dev adds new platforms here only — no other file changes required (Principle P6). |
| [onesell-client/src/main/ipc/](../onesell-client/src/main/ipc/) | 👨‍💻Dev | IPC handler registry | Every handler validates its payload with Zod before processing. Unknown shapes are rejected. Architect reviews all PRs here. |
| [onesell-client/src/renderer/](../onesell-client/src/renderer/) | 👨‍💻Dev · 🤖PM | React UI modules | Dev builds components; PM reviews against PRD wireframes. No Node.js access from renderer — all system operations go through IPC. |
| [onesell-client/package.json](../onesell-client/package.json) | 👨‍💻Dev | Client package manifest + scripts | Lists Electron, React, Zustand, Playwright, Vitest dependencies. |
| [onesell-client/tsconfig.json](../onesell-client/tsconfig.json) | 👨‍💻Dev | Client TypeScript config | Extends base config; targets ESNext/bundler resolution for Vite. |

---

## 14. Tests (skeleton — implemented by Tester agents in M0 onwards)

| File / Directory | Primary User | What it is | How to use it |
|---|---|---|---|
| [tests/README.md](../tests/README.md) | 🧪Test | Test suite overview and conventions | Tester reads before writing any tests. Covers directory structure, file naming mirrors (`src/X.ts` → `tests/unit/X.test.ts`), fixture naming, and how to run each test category. |
| `onesell-backend/tests/unit/` | 🧪Test · 👨‍💻Dev | Backend unit tests | One test file per source file. Tool functions require 100% branch coverage. Run: `pnpm --filter onesell-backend test:unit`. |
| `onesell-backend/tests/integration/` | 🧪Test | Backend integration tests | Require Postgres + Redis running (via `docker compose up -d`). Cover all API endpoints with all meaningful status codes. Run: `pnpm --filter onesell-backend test:integration`. |
| `onesell-backend/tests/security/` | 🧪Test | Security tests | Zero-tolerance — any failure is P0 blocker. Cover P1–P9 principle violations: credential scan, injection, auth bypass, missing user-id filter. Run: `pnpm --filter onesell-backend test:security`. |
| `onesell-client/tests/` (created in M1) | 🧪Test | Client unit + E2E tests | Unit: extraction script DOM fixture tests. E2E: Playwright wizard + extraction flows. |

---

## Quick-Access Summary by Role

### 👤 If you are the Human Manager
Start with [HUMAN-MANAGER-PLAYBOOK.md](HUMAN-MANAGER-PLAYBOOK.md). Your daily interaction is: receive GitHub email → click link → read → Approve or post a comment → done. See Part 5 and Part 8 of the playbook for finding work and gate response templates.

### 🤖 If you are the PM Agent
Activate with `@pm` in VS Code. Read in order: [copilot-instructions.md](../.github/copilot-instructions.md) → [PROJECT-MANAGEMENT.md](PROJECT-MANAGEMENT.md) → [PRD-Product-Selection-Module.md](PRD-Product-Selection-Module.md). Use `/pm-create-feature-issue` to create issues and `/pm-sprint-planning` to plan milestones. Your instruction file is [pm.instructions.md](../.github/instructions/pm.instructions.md). Skill: `issue-triage`.

### 🏗️ If you are the Architect Agent
Activate with `@architect` in VS Code. Read in order: [copilot-instructions.md](../.github/copilot-instructions.md) → [PROJECT-MANAGEMENT.md](PROJECT-MANAGEMENT.md) → [ARCHITECTURE.md](ARCHITECTURE.md). Use `/architect-review` for PR reviews and the [ADR-template.md](architecture/ADR-template.md) for decisions. Your instruction file is [architect.instructions.md](../.github/instructions/architect.instructions.md). Skill: `architecture-review`.

### 👨‍💻 If you are the Dev Agent
Activate with `@dev` in VS Code. Read in order: [copilot-instructions.md](../.github/copilot-instructions.md) → [PROJECT-MANAGEMENT.md](PROJECT-MANAGEMENT.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [DEVELOPER-GUIDE.md](guides/DEVELOPER-GUIDE.md). Use `/dev-implement-feature` to implement issues and `/dev-code-review` to review PRs. Your instruction file is [dev.instructions.md](../.github/instructions/dev.instructions.md). Skills: `architecture-review`, `extraction-script`.

### 🧪 If you are the Tester Agent
Activate with `@tester` in VS Code. Read in order: [copilot-instructions.md](../.github/copilot-instructions.md) → [PROJECT-MANAGEMENT.md](PROJECT-MANAGEMENT.md) → [ARCHITECTURE.md](ARCHITECTURE.md) → [TESTER-GUIDE.md](guides/TESTER-GUIDE.md). Use `/tester-write-test-plan` for test plans and `/tester-execute-tests` for execution. Your instruction file is [tester.instructions.md](../.github/instructions/tester.instructions.md). Skill: `extraction-script`.
