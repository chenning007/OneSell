# OneSell Scout

**OneSell Scout** is an intelligent product selection module for first-time online sellers.

It removes the single biggest barrier for new sellers — *"What should I sell?"* — by combining user-driven data collection with LLM-powered market analysis.

## How It Works

1. **Data Collection (Desktop Client)** — The user logs into any supported e-commerce platform (Amazon, Taobao, Shopee, etc.) inside the OneSell Scout Electron app. The client extracts market data from those authenticated sessions transparently.

2. **LLM Agent Analysis (Backend)** — Extracted data is passed to an AI agent that autonomously plans and executes analysis tasks — reasoning over demand, competition, margin, and trend signals — then produces a ranked product shortlist with plain-language justifications.

## Supported Markets (v1)

| Market | Platforms |
|---|---|
| 🇺🇸 United States | Amazon, eBay, Etsy, TikTok Shop, Shopify, Walmart |
| 🇨🇳 China | Taobao, Tmall, JD.com, Pinduoduo, Douyin Shop, 1688.com |
| 🇮🇩 Southeast Asia | Shopee, Tokopedia, Lazada, TikTok Shop SEA |
| 🇬🇧 United Kingdom | Amazon UK, eBay UK, Etsy |
| 🇩🇪 Germany / EU | Amazon DE, eBay DE, Otto |
| 🇯🇵 Japan | Amazon JP, Rakuten, Mercari |
| 🇦🇺 Australia | Amazon AU, eBay AU, Catch |

## Repository Structure

```
.github/                    Team collaboration instructions (read first)
docs/
  PRD-Product-Selection-Module.md   Product requirements (PM-owned)
  PROJECT-MANAGEMENT.md             How the team works together (read before any work)
  ARCHITECTURE.md                   System design, contracts, principles (Architect-owned)
  architecture/                     Architecture Decision Records (ADRs)
  guides/
    DEVELOPER-GUIDE.md              How to implement features (Dev)
    TESTER-GUIDE.md                 How to write and execute tests (Tester)
tests/                      Test plans, fixtures, and test suites (Tester-owned)
client/                     Electron desktop app (created in M1)
backend/                    Cloud API + Agent Service (created in M1)
```

## Documentation — Start Here

| Document | Who should read it | What it covers |
|---|---|---|
| [Team Instructions](.github/copilot-instructions.md) | **Everyone — read first** | Roles, rules, how to start |
| [Project Management Guide](docs/PROJECT-MANAGEMENT.md) | Everyone | Issue lifecycle, Definition of Done, release process |
| [PRD: Product Selection Module](docs/PRD-Product-Selection-Module.md) | Everyone | What we are building and why |
| [Architecture](docs/ARCHITECTURE.md) | Architect, Dev, Tester | System design, component contracts, security model |
| [Developer Guide](docs/guides/DEVELOPER-GUIDE.md) | Dev | How to implement features, code standards |
| [Tester Guide](docs/guides/TESTER-GUIDE.md) | Tester | How to write test plans and execute QA |
| [ADR Index](docs/architecture/README.md) | Architect, Dev | Architecture decision records |

## GitHub Project

- **Issues**: [github.com/chenning007/OneSell/issues](https://github.com/chenning007/OneSell/issues)
- **Milestones**: M0 Foundation → M1 Wizard+Extraction → M2 Agent+Results → M3 Quality → M4 China → M5 Monetization

## Status

🚧 **Kickoff** — PRD v0.3 complete. M0 (Foundation) in progress: architecture design, tech stack decisions, user research.
