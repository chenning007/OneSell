# OneSell Scout

OneSell Scout helps first-time online sellers answer one question quickly: **what should I sell in my market?**

You choose your target market, connect your e-commerce accounts in the desktop app, and the AI agent returns a ranked shortlist of product ideas with clear reasons, margin estimates, and risk warnings.

## Current Release — M0 + M1 (Wizard + Extraction)

This release includes the **Foundation** (M0) and **Wizard + Extraction** (M1) milestones. The guided preference wizard and US-market data extraction pipeline are fully implemented and tested.

### What's Included

#### Preference Wizard (6 steps)
- **Step 1 — Market Selection**: Choose from 7 markets (US, China, UK, Germany, Japan, Australia, Southeast Asia) with flag icons and localized labels
- **Step 2 — Budget**: Set your starting budget with a slider control (market-appropriate ranges and currency)
- **Step 3 — Platforms**: Multi-select platforms available in your market (auto-filtered by market)
- **Step 4 — Product Type**: Choose physical, digital, or mixed product focus (defaults to physical if skipped)
- **Step 5 — Categories**: Select or exclude product categories with localized labels
- **Step 6 — Fulfillment**: Set fulfillment time preference (defaults to moderate if skipped)
- Full keyboard navigation (Tab, Enter, Space, Arrow keys)
- ARIA-compliant progress bar, focus rings, and screen reader support

#### Data Source Connection (Step 7)
- Connect to marketplace platforms via embedded browser panels
- Privacy indicator with lock icon — credentials never leave the client
- Keyword input for focused extraction
- Back-to-wizard navigation preserving all state
- Per-platform connection lifecycle (Idle → Connected → Closed)

#### Extraction Engine (Step 8)
- Animated per-platform progress rows with real-time status
- 6 US-market extraction scripts:
  - **Amazon US** — bestseller rank, reviews, price, seller count
  - **eBay US** — sell-through rate, price distribution
  - **Etsy** — top listings, review velocity
  - **TikTok Shop US** — hashtag GMV, trending products
  - **Google Trends** — 12-month search index, related queries
  - **Alibaba/AliExpress** — MOQ, unit price, shipping estimates
- Graceful degradation: partial platform failures don't block analysis
- Cancel support with completed results preserved
- All-error state detection with back navigation
- Shield icon + TLS security indicator
- `aria-live` region for screen reader progress announcements

#### Shared UI Components
- **Toast** notifications — success/error/info variants, auto-dismiss (3s), bottom-right positioning
- **ErrorBanner** — full-width dismissible error with optional retry action
- **ConfirmDialog** — accessible modal with focus trapping, Escape to close
- **FadeTransition** — CSS keyframe screen transitions (no JS timers)
- **GlobalStyles** — `:focus-visible` 2px blue outline on all interactive elements
- Responsive layout (grids collapse at < 800px, reduced padding)
- WCAG AA contrast ratios on all text (≥ 4.5:1 body, ≥ 3:1 large/UI)

#### Internationalization
- 4 languages: English, Chinese (ZH-CN), Japanese, German
- Market-driven language switching (automatic on market selection)
- Localized category labels, budget ranges, and platform names

#### Backend Foundation (partial M2)
- PostgreSQL schema (users, analyses, saved lists, market configs)
- Redis helpers with TTL management
- Agent tool functions: `calc_margin`, `rank_competition`, `score_trend` (pure, deterministic)

### What's NOT Included Yet
- AI agent analysis pipeline (M2 — in progress)
- Results dashboard and product detail screens (M2)
- Auth, rate limiting, and API routes (M2)
- China market extraction scripts (M4)
- SEA and regional market scripts (M6)
- Subscription tier enforcement (M5)

---

## Who This Is For

- You are new to e-commerce and need product ideas backed by data
- You want recommendations for your own market (US, China, SEA, UK, EU, Japan, Australia)
- You prefer a guided flow instead of manual spreadsheet research

## Prerequisites

- Windows 10+ or macOS 12+
- Node.js 18+ and [pnpm](https://pnpm.io/)
- Git

## Install and Run (Development)

```bash
# 1. Clone the repository
git clone https://github.com/chenning007/OneSell.git
cd OneSell

# 2. Switch to the M0+M1 release branch
git checkout release/m0-m1-wizard-extraction

# 3. Install all dependencies
pnpm install

# 4. Start the Electron desktop client in dev mode
cd onesell-client
pnpm electron:dev
```

This opens a Vite dev server on `http://localhost:5173` and launches the Electron app.

### Run Tests

```bash
# Client unit tests (293 tests across 24 files)
cd onesell-client
pnpm test:unit

# Backend unit tests (57 tests across 5 files)
cd onesell-backend
npx vitest run
```

### Build for Production

```bash
cd onesell-client
pnpm build              # TypeScript + Vite build
pnpm electron:build     # Package Electron app (uses electron-builder)
```

## How to Test the Wizard Flow

1. Launch the app (`pnpm electron:dev` from `onesell-client/`)
2. **Step 1**: Click a market tile (e.g., "United States") — the app switches language and advances
3. **Steps 2–6**: Use the wizard to set budget, select platforms, choose product type, categories, and fulfillment time. Try skipping steps to verify defaults.
4. **Step 7 (Data Sources)**: Click "Connect" on any platform to open an embedded browser. After connecting, use the keyword input to set search focus. Click "Start Extraction".
5. **Step 8 (Progress)**: Watch per-platform extraction progress. Test cancel behavior and partial-success scenarios.
6. After extraction completes, the app is ready for analysis (backend agent pipeline — coming in M2).

### Keyboard Navigation Test

- Tab through all wizard controls
- Use Enter/Space to select market tiles and buttons
- Use Arrow Left/Right on the budget slider
- Verify blue focus ring appears on all interactive elements

### Accessibility Test

- Use a screen reader (NVDA, VoiceOver) to navigate the wizard
- Verify progress bar announces step changes
- Verify extraction progress is announced via aria-live region
- Test ConfirmDialog focus trapping (Tab should not escape the modal)

## Project Structure

```
OneSell/
├── onesell-client/          # Electron + React desktop app
│   ├── src/
│   │   ├── main/            # Electron main process
│   │   │   ├── extraction/  # Extraction engine + scripts
│   │   │   └── ipc/         # IPC handlers
│   │   ├── renderer/        # React UI
│   │   │   ├── components/  # Shared UI (Toast, ErrorBanner, ConfirmDialog, etc.)
│   │   │   ├── config/      # Markets config, responsive breakpoints
│   │   │   ├── i18n/        # Internationalization (en, zh, ja, de)
│   │   │   ├── modules/     # Feature modules (wizard, data-sources, progress)
│   │   │   └── store/       # Zustand stores (wizard, extraction)
│   │   └── shared/          # Shared types (ProductRecord, MarketContext, etc.)
│   └── tests/               # Unit + contract + security tests
├── onesell-backend/         # Fastify backend (partial)
│   ├── src/
│   │   ├── db/              # PostgreSQL schema + Drizzle ORM
│   │   └── services/        # Agent tools, market config, Redis
│   └── tests/               # Backend unit tests
├── docs/                    # PRD, architecture, guides
└── tests/                   # Cross-cutting test plans + E2E
```

## Supported Platforms (US Market — M1)

| Platform | Data Extracted |
|---|---|
| Amazon US | Bestseller rank, review count, price, seller count |
| eBay US | Sell-through rate, price distribution |
| Etsy | Top listings, review velocity |
| TikTok Shop US | Hashtag GMV, trending products |
| Google Trends | 12-month search volume index, related queries |
| Alibaba/AliExpress | MOQ, unit price, shipping estimates |

## Privacy and Security

- OneSell Scout does not store your marketplace passwords
- Session credentials remain in the local Electron client — never sent via IPC or API (P1 principle)
- All extraction scripts run in sandboxed BrowserView instances
- Data sent to backend is encrypted in transit (TLS 1.3)
- Raw extraction payloads are session-scoped and purged after analysis
- No `eval()`, no shell execution, no raw SQL — enforced by architectural principles P1–P9

## Troubleshooting

### A platform cannot connect

- Verify your account can log in from a regular browser
- Reopen the connector and sign in again
- If there is MFA, complete MFA in the embedded browser panel

### Extraction returns too little data

- Use broader keywords first
- Connect at least two sources (marketplace + trend/supplier source)
- Re-run during normal platform availability (not maintenance windows)

### App doesn't start

- Ensure Node.js 18+ is installed: `node --version`
- Ensure pnpm is installed: `pnpm --version`
- Delete `node_modules` and reinstall: `pnpm install`
- On Windows, if GPU errors appear, the app handles them automatically

## Roadmap

| Milestone | Status | Description |
|---|---|---|
| M0 Foundation | ✅ Complete | Architecture, PRD, personas, KPIs, test strategy |
| M1 Wizard + Extraction | ✅ Complete | Preference wizard, 6 US extraction scripts, full a11y |
| M2 Agent + Results | 🔧 In Progress | AI agent pipeline, results dashboard, auth, API routes |
| M3 Quality + NFRs | Planned | TLS enforcement, data purge, performance, security audit |
| M4 China Market | Planned | 8 China platform scripts, ZH-CN agent prompts |
| M5 Monetization | Planned | Subscription tiers, access control |
| M6 SEA + Regional | Planned | 11 additional regional extraction scripts |

## Links

- [Product Requirements (PRD)](docs/PRD-Product-Selection-Module.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Project Management](docs/PROJECT-MANAGEMENT.md)
- [Developer Guide](docs/guides/DEVELOPER-GUIDE.md)
- [Tester Guide](docs/guides/TESTER-GUIDE.md)
- [Issues](https://github.com/chenning007/OneSell/issues)

## For Contributors

If you are joining as a project contributor instead of an end user, start here:

- [Team Collaboration Instructions](.github/copilot-instructions.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/guides/DEVELOPER-GUIDE.md)
- [Tester Guide](docs/guides/TESTER-GUIDE.md)
