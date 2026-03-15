# OneSell Scout User Guide

OneSell Scout helps first-time online sellers answer one question quickly: what should I sell in my market?

You choose your target market, connect your e-commerce accounts in the desktop app, and the AI agent returns a ranked shortlist of product ideas with clear reasons, margin estimates, and risk warnings.

## Who This Is For

- You are new to e-commerce and need product ideas backed by data
- You want recommendations for your own market (US, China, SEA, UK, EU, Japan, Australia)
- You prefer a guided flow instead of manual spreadsheet research

## What You Need

- A Windows 10+ or macOS 12+ computer
- Internet connection
- Accounts for one or more supported platforms in your market
- 5 to 10 minutes per analysis session

## Install OneSell Scout

### Option 1: Install From Releases (Recommended)

1. Open the Releases page: https://github.com/chenning007/OneSell/releases
2. Download the latest installer for your OS:
  - Windows: `OneSell-Scout-Setup-x.y.z.exe`
  - macOS: `OneSell-Scout-x.y.z.dmg`
3. Run the installer and finish setup.
4. Launch OneSell Scout from Start Menu (Windows) or Applications (macOS).

### Option 2: Build From Source (Advanced)

Use this only if you are comfortable with Node.js tooling.

1. Install Node.js 20+ and pnpm.
2. Clone this repository.
3. Install dependencies: `pnpm install`
4. Start the desktop client in dev mode: `pnpm dev`

If you only want to use the product, use Option 1.

## First-Time Setup

1. Open the app and sign in.
2. Select your market.
3. Confirm language and currency.
4. Complete the onboarding wizard (budget, product type, categories, fulfillment time).

## How To Use OneSell Scout

1. Choose Your Market
  - Example: China, United States, or Southeast Asia.
  - This controls which platform connectors appear.

2. Connect Data Sources
  - Click Connect on platforms you use.
  - Log in inside the app browser panel.
  - Your credentials stay on your machine; only extracted product data is sent for analysis.

3. Enter Product Focus
  - Add keywords or categories you want to explore.
  - Example: home organization, pet accessories, fitness gadgets.

4. Start Extraction
  - The app gathers listing, pricing, review, and trend signals from connected platforms.
  - Extraction usually takes 1 to 3 minutes depending on selected sources.

5. Run AI Analysis
  - The LLM agent plans and executes analysis tasks automatically.
  - Typical analysis time is 30 to 90 seconds.

6. Review Results
  - You receive 5 to 10 ranked product opportunities.
  - Each recommendation includes:
    - Why this product (plain-language reasons)
    - Demand and competition indicators
    - Estimated margin in your local currency
    - Risk flags (seasonality, saturation, complexity)

7. Save and Act
  - Save promising ideas to My List.
  - Export shortlist as CSV/PDF.
  - Re-run analysis with new keywords or extra data sources.

## Market-Specific Platform Examples

| Market | Typical Platforms |
|---|---|
| United States | Amazon, eBay, Etsy, TikTok Shop |
| China | Taobao, Tmall, JD.com, Pinduoduo, Douyin Shop, 1688.com |
| Southeast Asia | Shopee, Tokopedia, Lazada, TikTok Shop SEA |
| United Kingdom | Amazon UK, eBay UK, Etsy |
| Germany / EU | Amazon DE, eBay DE, Otto |
| Japan | Amazon JP, Rakuten, Mercari |
| Australia | Amazon AU, eBay AU, Catch |

## Privacy and Security

- OneSell Scout does not store your marketplace passwords.
- Session credentials remain in the local desktop client.
- Data sent to backend is encrypted in transit (TLS).
- Raw extraction payloads are session-scoped and purged after analysis windows.

## Troubleshooting

### A platform cannot connect

- Verify your account can log in from a regular browser.
- Reopen the connector and sign in again.
- If there is MFA, complete MFA in the embedded browser panel.

### Extraction returns too little data

- Use broader keywords first.
- Connect at least two sources (for example marketplace + supplier/trend source).
- Re-run during normal platform availability (not maintenance windows).

### Results seem too generic

- Add clearer category preferences and exclusions.
- Increase source coverage (for example add trend + supplier source).
- Re-run with market-specific terms in your local language.

## Product Status

Current status: active development and phased rollout by milestone.

- Planning details: [PRD](docs/PRD-Product-Selection-Module.md)
- Roadmap and workflow: [Project Management](docs/PROJECT-MANAGEMENT.md)
- Report issues: https://github.com/chenning007/OneSell/issues

## For Contributors

If you are joining as a project contributor instead of an end user, start here:

- [Team Collaboration Instructions](.github/copilot-instructions.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Developer Guide](docs/guides/DEVELOPER-GUIDE.md)
- [Tester Guide](docs/guides/TESTER-GUIDE.md)
