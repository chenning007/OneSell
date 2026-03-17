# OneSell Scout

OneSell Scout helps first-time online sellers answer one question quickly: **what should I sell in my market?**

You choose your target market, connect your e-commerce accounts in the desktop app, and an AI agent returns a ranked shortlist of product ideas with clear reasons, margin estimates, and risk warnings.

## Who This Is For

- You are new to e-commerce and need product ideas backed by real data
- You want recommendations tailored to your market (US, China, Southeast Asia, UK, Germany, Japan, or Australia)
- You prefer a guided flow over hours of manual spreadsheet research

## What You Need

- A Windows 10+ or macOS 12+ computer
- An internet connection
- An account on at least one supported marketplace (see [Supported Platforms](#supported-platforms) below)

## Install OneSell Scout

### Option 1 — Download the Installer (Recommended)

1. Go to the [Releases page](https://github.com/chenning007/OneSell/releases)
2. Download the installer for your operating system:
   - **Windows**: `OneSell-Scout-Setup-x.y.z.exe`
   - **macOS**: `OneSell-Scout-x.y.z.dmg`
3. Run the installer and follow the prompts
4. Launch **OneSell Scout** from your Start Menu (Windows) or Applications folder (macOS)

### Option 2 — Build From Source

Use this if a packaged installer is not yet available for your platform.

1. Install [Node.js 18+](https://nodejs.org/) and [pnpm](https://pnpm.io/installation)
2. Open a terminal and run:

```bash
git clone https://github.com/chenning007/OneSell.git
cd OneSell
pnpm install
cd onesell-client
pnpm electron:dev
```

The app window opens automatically. You are ready to start.

## How to Use OneSell Scout

### Step 1 — Choose Your Market

When the app opens you see market tiles with flags. Click the market that matches where you plan to sell.

The app automatically switches to the right language and currency. For example, selecting **China** switches the interface to Chinese and shows prices in CNY.

**Supported markets**: United States, China, United Kingdom, Germany, Japan, Australia, Southeast Asia.

### Step 2 — Set Your Budget

Use the slider to set how much you are willing to invest in your first product. The range adjusts automatically based on your market. If you are unsure, skip this step — a reasonable default is applied.

### Step 3 — Pick Your Platforms

Select the marketplaces you already have accounts on (or plan to use). Only platforms relevant to your market appear. Select at least one.

### Step 4 — Choose Product Type

Pick **Physical**, **Digital**, or **Mixed**. If you skip this step, physical products are assumed.

### Step 5 — Select Categories

Choose product categories you are interested in, or exclude ones you want to avoid. Labels are shown in your local language.

### Step 6 — Fulfillment Preference

Set how quickly you want to ship orders. If you skip this step, a moderate fulfillment speed is assumed.

### Step 7 — Connect Your Data Sources

Click **Connect** next to each platform you selected. A secure browser panel opens inside the app where you log in to your marketplace account.

> **Your login credentials never leave your computer.** The lock icon confirms this. OneSell Scout only reads public product listing data from pages you visit — it does not store or transmit your passwords.

After logging in, you can type **keywords** in the search box to focus the extraction on specific product categories (e.g., "kitchen organizer", "pet accessories").

When ready, click **Start Extraction**.

### Step 8 — Watch Extraction Progress

Each connected platform shows a progress row as data is gathered. This usually takes 1 to 3 minutes.

- If some platforms fail, the others still work — you can proceed with partial data
- You can **Cancel** at any time; results already collected are kept
- If all platforms fail, click **Back to Data Sources** to reconnect and try again

### Coming Soon — AI Analysis and Results

> The AI analysis engine is under active development. In a future update, after extraction completes, the app will automatically analyze the collected data and show you a ranked shortlist of product recommendations with scores, margin estimates, and risk flags.

## Supported Platforms

OneSell Scout currently supports data extraction from these US-market platforms:

| Platform | What It Collects |
|---|---|
| Amazon US | Bestseller rank, review count, price, seller count |
| eBay US | Sell-through rate, price distribution |
| Etsy | Top listings, review velocity |
| TikTok Shop US | Hashtag GMV, trending products |
| Google Trends | 12-month search volume trends, related queries |
| Alibaba / AliExpress | MOQ, unit price, shipping estimates |

Additional platforms for China, Southeast Asia, UK, Germany, Japan, and Australia are coming in future updates.

## Features

- **7 markets** with localized interfaces (English, Chinese, Japanese, German)
- **6-step preference wizard** to personalize your product search
- **6 extraction scripts** for US-market data gathering
- **Keyboard accessible** — navigate the entire app with Tab, Enter, Space, and Arrow keys
- **Screen reader support** — ARIA labels, live regions, and proper focus management
- **Responsive layout** — works on screens down to 800px wide
- **Privacy first** — your marketplace credentials stay on your machine
- **Secure extraction** — all data transfer uses TLS 1.3 encryption

## Privacy and Security

- OneSell Scout **never stores your marketplace passwords**
- Login sessions stay inside the local app — credentials are never sent to any server
- All extraction runs inside isolated browser panels on your machine
- Data sent to the analysis backend is encrypted in transit (TLS 1.3)
- Raw data is temporary and purged automatically after analysis

## Troubleshooting

### A platform will not connect

- Make sure you can log in to that platform from a regular browser first
- Close the connector panel and click Connect again
- If the platform requires two-factor authentication (MFA), complete it in the embedded browser

### Extraction returns very little data

- Try broader keywords (e.g., "electronics" instead of "USB-C hub 65W")
- Connect at least two sources — a marketplace plus a trend or supplier source gives better coverage
- Avoid running during known platform maintenance windows

### The app does not start

If you installed from source:
- Check that Node.js 18+ is installed: run `node --version` in a terminal
- Check that pnpm is installed: run `pnpm --version`
- Try deleting `node_modules` and reinstalling: `pnpm install`
- On Windows, GPU-related errors are handled automatically — the app should still open

### Something else is wrong

Open an issue at: https://github.com/chenning007/OneSell/issues

## Roadmap

| Feature | Status |
|---|---|
| Preference wizard (7 markets, 6 steps) | ✅ Available now |
| US market data extraction (6 platforms) | ✅ Available now |
| AI-powered product analysis | Coming soon |
| Results dashboard with scores and rankings | Coming soon |
| China market platforms (Taobao, JD, Pinduoduo, etc.) | Planned |
| Southeast Asia platforms (Shopee, Lazada, etc.) | Planned |
| UK, Germany, Japan, Australia platforms | Planned |
| Subscription tiers | Planned |

## For Contributors

If you are a developer, tester, or contributor (not an end user), see:

- [Developer Guide](docs/guides/DEVELOPER-GUIDE.md) — code standards, branch workflow, Definition of Done
- [Tester Guide](docs/guides/TESTER-GUIDE.md) — test strategy, QA process
- [Architecture](docs/ARCHITECTURE.md) — system design, principles P1–P9, interface contracts
- [Product Requirements](docs/PRD-Product-Selection-Module.md) — full PRD with personas and acceptance criteria
- [Project Management](docs/PROJECT-MANAGEMENT.md) — issue lifecycle, labels, release process
- [Issues](https://github.com/chenning007/OneSell/issues) — backlog and task board
