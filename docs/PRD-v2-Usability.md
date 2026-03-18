# PRD v2: OneSell Scout — Usability Overhaul

**Product**: OneSell Scout  
**Module**: Product Selection Intelligence — UX Rework  
**Version**: 2.0  
**Author**: PM — OneSell  
**Date**: 2026-03-18  
**Status**: Draft — `needs-human-signoff`  
**Change from v0.4**: Complete UX redesign of the onboarding flow and data extraction experience. Reduces wizard from 6 steps to **1 step** (market selection only), introduces saved profiles for returning users, makes platform selection and data extraction **fully autonomous**, adds a tabbed extraction dashboard, **redesigns results as categorized candidate lists with per-product reasoning**, **ships as a one-click installer** (.exe / .dmg), and **removes the backend dependency for the early release** — all data and analysis run client-side.

---

## 1. Problem Statement (Why v2)

User testing and hands-on QA of v1 revealed four critical usability failures:

| Problem | Severity | Evidence |
|---|---|---|
| **Wizard is too long** — 6 steps before the user reaches data extraction | P1 | Users lose motivation clicking through budget, product type, categories, and fulfillment steps that feel like bureaucracy, not progress. Average completion drops off at step 4. |
| **Data extraction is invisible and confusing** — users don't understand what the app is doing when a platform webview opens | P1 | The embedded BrowserView opens over the platform list, obscuring other connect/disconnect buttons. Users cannot tell what data is being collected, from where, or when it's done. |
| **No memory between sessions** — returning users must repeat the full wizard every time | P2 | A user who has already set their market, platforms, and preferences must click through all 6 steps again. There is no quick-start path. |
| **Users are asked what to search for — but they don't know** — the keyword/category input contradicts the product's core value | P0 | Asking a beginner "What do you want to research?" defeats the purpose. If they knew what was trending, they wouldn't need this tool. The product must **discover** hot products autonomously, not wait for the user to guess. |
| **Installation is too complex** — requires Docker, Node.js, pnpm, and manual terminal commands | P1 | A beginner user cannot be expected to install Docker Desktop, run `docker compose up`, start a backend server, and then launch Electron. The product must install and run with a single click. |
| **Backend dependency adds unnecessary complexity** — Docker + Postgres + Redis + Fastify server just to get started | P1 | For an early-stage product validation, requiring a full server stack on the user's machine is overkill. All data collection and analysis can run client-side. Server features (accounts, team sharing, history sync) can be added for Pro+ tiers later. |

### What v1 Got Right (Keep)
- Market selection as the first step — this is essential and stays
- Platform-specific extraction scripts — the technical approach is sound
- Agent analysis with transparent reasoning — users love seeing the AI's thinking
- Recommendation cards — the output format is good

### What v2 Changes
- **Wizard**: 6 steps → **1 step** (Market selection only). Platform selection is automatic based on market. Budget, product type, categories, and fulfillment are moved to an optional "Advanced Preferences" panel.
- **Fully autonomous extraction**: The user selects a market and clicks Go. The app **automatically determines** which platforms to extract, connects to them, navigates bestseller/trending pages, and collects all data. Zero user decisions required beyond market choice.
- **Tabbed extraction dashboard**: During extraction, the user sees a **task pipeline** showing what the app is doing now, what it will do next, and what's done. Each platform is a tab the user can open to watch the extraction live in a webview.
- **Saved profiles**: Returning users see a "Quick Start" screen that lets them re-run with one click.
- **One-click installer**: The app ships as a single installer file (.exe for Windows, .dmg for macOS). No Docker, no Node.js, no terminal commands. Download → install → run.
- **Client-only architecture (early release)**: No backend server. LLM analysis runs client-side via direct API call (user provides their own OpenAI key, or we bundle limited free credits). All data stored locally. Backend features (accounts, sync, team sharing) are deferred to Pro+ tier.
- **Extraction visibility**: Every step is narrated to the user — the app always tells you what it's doing and what's coming next.

---

## 2. Goals & Success Metrics (v2)

| Metric | v1 Target | v2 Target | How |
|---|---|---|---|
| Wizard completion rate | 70% | ≥ 95% | Only 1 click needed (market selection) |
| Time to first extraction start | ~3 min | < 15 sec (returning) / < 30 sec (new) | Saved profiles + 1-step wizard + auto-start |
| User understanding of extraction ("I know what data was collected") | Not measured | ≥ 85% (post-session survey) | Task pipeline narration + tabbed webviews |
| Session time for product discovery | < 15 min | < 8 min | 1-click start + autonomous extraction + same analysis quality |

---

## 3. Feature: Streamlined Wizard (1 Step)

### 3.1 Design Principles

> **Principle 1**: The wizard should capture only what the app **cannot function without**: which market. Everything else is automated.
>
> **Principle 2 (v2 core philosophy)**: The user should **never be asked what to search for, or which platforms to use**. If the user knew what was trending or which platforms mattered, they wouldn't need this tool. The app's job is to **autonomously decide** which platforms to scan and **autonomously discover** hot-selling products by exploring bestseller rankings, trending pages, and category leaders. The user's only job is to choose a market and authenticate when prompted — the AI does the rest.
>
> **Principle 3 (Transparency)**: Even though extraction is fully automated, the user must always understand **what the app is doing now** and **what it will do next**. The app narrates its own actions. Users can open a tab to watch each platform extraction live.

### 3.2 New Wizard: 1 Step

| Step | Question | Input Type | Required? |
|---|---|---|---|
| **1** | Which market are you selling in? | Single-select market tiles (unchanged from v1) | **Yes** |

That's it. **One click, one decision.**

- **Platforms are auto-selected** based on the chosen market. The app knows which platforms matter for each market (defined in `MARKET_CONFIGS`). All platforms for the market are included by default.
- After market selection, the app transitions directly to the **Extraction Dashboard** — a single screen where everything happens.
- There is no separate platform selection step. If a user wants to exclude a specific platform, they can do so from the Extraction Dashboard (toggle off), but the default is all-on.

### 3.3 Advanced Preferences (Optional, Accessible Anytime)

The removed wizard steps are consolidated into a collapsible **"Advanced Preferences"** panel accessible via a gear icon (⚙) on the Extraction Dashboard and Results Dashboard:

| Preference | Default (if user skips) | Input |
|---|---|---|
| Budget | Mid-range for the selected market | Slider |
| Product type | Physical | Toggle |
| Fulfillment time | 5–15 h/week (medium) | Radio cards |

> **Note**: Categories and platforms are NOT included as user preferences for filtering. The app explores **all categories** and **all market platforms** autonomously. The AI agent determines the best opportunities. Users should not constrain the search upfront because they cannot predict where the best opportunities are — that's the agent's job.

These preferences are passed to the agent analysis phase only (not to extraction). If the user never touches them, sensible defaults apply. The agent prompt includes: _"The user has not specified preferences for [X] — use moderate/default assumptions and note this in your recommendations."_

### 3.4 Navigation Flow (v2)

```
[Launch App]
    │
    ├── Returning user (saved profile exists)
    │       │
    │       ▼
    │   [Quick Start Screen]
    │       "🇨🇳 China Market — Ready to scan Taobao, JD, 1688, Baidu"
    │       [ 🚀 Go → ]    [ Change Market ]
    │       │                   │
    │       │                   └──→ Market Selection
    │       ▼
    │   [Extraction Dashboard] ← one click, starts immediately
    │
    └── New user (no saved profile)
            │
            ▼
        [Market Selection] (1 click)
            │
            ▼
        [Extraction Dashboard] ← auto-starts extraction
            │  (user watches, can open tabs per platform)
            ▼
        [Agent Analysis] (auto-transitions when extraction done)
            │
            ▼
        [Results Dashboard]
```

**Key change from v1**: The user goes from app launch to watching data being collected in **2 clicks maximum** (market + Go). For returning users, it's **1 click** (Go).

---

## 4. Feature: Saved User Profile

### 4.1 What Gets Saved

When a user completes their first session, their selections are persisted **locally** (client-side, `electron-store` or `localStorage`):

| Field | Saved Value |
|---|---|
| Market | Market ID (e.g., `cn`) |
| Extraction mode | Always "auto-discover" (reserved for future manual mode) |
| Advanced preferences | Budget, product type, fulfillment (if user set them) |
| Last session timestamp | ISO date |

### 4.2 Quick Start Screen

Displayed **only** when a saved profile exists on app launch. Layout:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Welcome back!                                          │
│                                                          │
│   ┌────────────────────────────────────────────┐        │
│   │  🇨🇳 China Market                          │        │
│   │  Will scan: Taobao, JD, 1688, Baidu, PDD  │        │
│   │  Last session: March 17, 2026              │        │
│   └────────────────────────────────────────────┘        │
│                                                          │
│   [ 🚀 Go — Start Scanning ]    [ Change Market ]         │
│                                                          │
│   [ 🗑️ Clear profile & start fresh ]                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Action | Behaviour |
|---|---|
| **Go — Start Scanning** | Load saved market, auto-select all market platforms, jump to Extraction Dashboard, begin extraction immediately |
| **Change Market** | Go to Market Selection. Choosing a different market auto-updates everything |
| **Clear profile** | Delete local profile, go to Market Selection as a new user |

### 4.3 Profile Persistence Rules

- Profile is saved/updated **after** the user starts extraction (not after wizard completion alone — we need confirmed intent)
- Profile is stored client-side only — never sent to the server
- If the user selects a different market during "Change Settings", the platform list resets (existing behaviour)
- Profile has no expiry — persists until manually cleared or app is uninstalled

---

## 5. Feature: Extraction Dashboard (Fully Autonomous)

### 5.1 Core Concept

The Extraction Dashboard is the **main screen** of OneSell Scout. It replaces the v1 "Data Sources" screen, "Extraction Progress" screen, and platform connection flow with a single, unified experience.

**The user does not choose platforms. The user does not type keywords. The user does not decide where to look.** The app knows what to do based on the market selection and does it all automatically.

The user's role on this screen is to:
1. **Authenticate** when a platform requires login (the app prompts them)
2. **Watch** the extraction happen in real-time via tabbed platform views
3. **Understand** what data is being collected via a narrated task pipeline

### 5.2 How It Works

When the user arrives at the Extraction Dashboard (after selecting a market or clicking "Go" on Quick Start):

```
1. App determines all platforms for the selected market (from MARKET_CONFIGS)
2. For each platform:
   a. If login required → open platform tab, prompt user to log in
   b. If public (no login) → auto-start extraction immediately
3. Once all login-required platforms are authenticated (or skipped):
   → Auto-start extraction across all connected platforms
4. User watches live progress via the Task Pipeline and can open tabs to see each platform
5. When all platforms finish → auto-transition to Agent Analysis
```

### 5.3 Layout: Task Pipeline + Tabbed Webviews

```
┌─────────────────────────────────────────────────────────────────────┐
│  🇨🇳 China Market    [ ⚙ Preferences ]    [ Change Market ]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TASK PIPELINE — What the app is doing                              │
│  ───────────────────────────────────────────────────────            │
│  ✓ Taobao       Scanned hot sellers list — 52 products found       │
│  ✓ JD.com       Scanned rankings — 48 products found               │
│  ⟳ 1688         Scanning supplier prices…   (NOW)                  │
│  ○ Baidu Index   Up next — will scan trending keywords              │
│  ○ Pinduoduo    Queued — will scan bestsellers                      │
│  🔒 Douyin Shop  Needs login — click tab to authenticate            │
│  ── Kuaishou     Skipped (not logged in)                            │
│                                                                     │
│  Overall: 3 of 7 platforms done · ~2 min remaining                  │
│  ───────────────────────────────────────────────────────            │
│                                                                     │
│  PLATFORM TABS (click to see what's happening)                      │
│  ┌────────┬────────┬───────┬──────────┬─────────┬──────┐           │
│  │ Taobao │ JD ✓  │ 1688  │ Baidu    │ PDD     │ More │           │
│  │  ✓     │       │  ⟳   │  ○       │  ○      │      │           │
│  └────────┴────────┴───────┴──────────┴─────────┴──────┘           │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │                                                         │       │
│  │  [ 1688.com webview — showing supplier search page ]    │       │
│  │                                                         │       │
│  │  Currently scanning: wholesale electronics suppliers    │       │
│  │  Found so far: 23 supplier listings, avg ¥15–¥89       │       │
│  │                                                         │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  🔒 Your login credentials never leave this device.                │
├─────────────────────────────────────────────────────────────────────┤
│  [ Cancel ]                          [ Analyze Now → ]              │
│                                      (available when ≥1 done)       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Task Pipeline (Top Section)

The Task Pipeline is the **primary information display** — it tells the user exactly what's happening, what's next, and what's done. It is always visible at the top of the Extraction Dashboard.

#### Row States

| State | Icon | Text | Meaning |
|---|---|---|---|
| **Done** | ✓ (green) | `Scanned [what] — N products found` | Platform extraction complete |
| **Active** | ⟳ (amber, animated) | `Scanning [what]…  (NOW)` | Currently extracting from this platform |
| **Queued** | ○ (grey) | `Up next — will scan [what]` | Waiting in line. Tells user what's coming. |
| **Needs login** | 🔒 (blue) | `Needs login — click tab to authenticate` | Login-required platform, user hasn't authenticated yet |
| **Skipped** | ── (light grey) | `Skipped (not logged in)` | User chose not to log into this optional platform |
| **Error** | ✗ (red) | `Failed — [reason]` | Extraction failed for this platform |

#### Task Descriptions (What the App Will Do)

Each platform row tells the user **in plain language** what the app is going to do or has done:

| Platform | "Will do" text (queued) | "Done" text |
|---|---|---|
| Taobao | Will scan hot sellers and trending searches | Scanned hot sellers — 52 products found |
| JD.com | Will scan rankings and category bestsellers | Scanned rankings — 48 products found |
| 1688 | Will scan supplier prices and wholesale listings | Scanned suppliers — 89 supplier listings |
| Amazon | Will scan Best Sellers, Movers & Shakers | Scanned bestsellers — 65 products found |
| Baidu Index | Will scan trending product keywords | Scanned trends — 30 keywords tracked |
| Google Trends | Will scan search trends for top categories | Scanned trends — 25 categories tracked |
| Shopee | Will scan top sales and daily discover | Scanned top sales — 73 products found |

This narration is critical — it builds user understanding and trust. The user always knows: "The app is scanning JD.com's bestseller rankings **for me**."

### 5.5 Platform Tabs (Bottom Section)

Below the Task Pipeline, a **tabbed panel** shows one platform at a time. Each tab corresponds to a platform in the pipeline.

#### Tab Behaviour

| User Action | Result |
|---|---|
| Click a tab | The webview for that platform appears in the panel below. If platform is currently being extracted, user can watch the pages being navigated in real-time. |
| Tab shows status icon | ✓ (done), ⟳ (active), ○ (queued), 🔒 (needs login) next to platform name |
| Default selected tab | The currently **active** (extracting) platform's tab is auto-selected. As extraction advances to the next platform, the tab auto-switches. |
| User manually selects a different tab | Tab stays on user's choice until the user switches away or a login prompt is needed. |
| Login-required platform tab | Shows the platform login page. User logs in normally. Once authenticated → status changes to "queued" and joins the extraction queue. |

#### What the User Sees in Each Tab

| Platform State | Tab Content |
|---|---|
| **Needs login** | Full webview showing platform login page + banner: _"Please log in to your [Platform] account. The app will start scanning automatically after you log in."_ |
| **Queued** | Brief message: _"Waiting to scan. The app will navigate this platform automatically when it's this platform's turn."_ |
| **Active (extracting)** | Live webview showing the pages being navigated in real-time. User can watch the app browse bestseller pages, trending lists, etc. Below the webview: mini extraction log showing data being collected. |
| **Done** | Summary card: _"Extraction complete. Found 52 products across 3 category pages."_ with a data summary table. |
| **Skipped** | Message: _"This platform was skipped because you didn't log in. Your analysis will still work with the other platforms."_ |

#### Why Tabs Instead of Split-Panel

In v1, the BrowserView overlapped other buttons. A split-panel (left list + right webview) was considered but has drawbacks:
1. The left panel takes up space that could show the task pipeline
2. Users don't need to see the platform list AND a webview simultaneously — the pipeline gives them better status information
3. Tabs allow the user to **choose** when to look at a platform — it's opt-in visibility, not forced

The tab panel is **collapsible** — the user can collapse it to see only the Task Pipeline if they don't want to watch the webview.

### 5.6 Autonomous Extraction Logic

**This is the core product differentiator.** The app does everything autonomously:

| Step | What the App Does | User's Role |
|---|---|---|
| 1 | Determines all platforms for the market | Automatic |
| 2 | Opens login-required platforms → prompts user to authenticate | Log in (one-time) |
| 3 | Navigates to each platform's **bestseller rankings** page | Watch (optional) |
| 4 | Scans **top trending categories** and hot product lists | Watch (optional) |
| 5 | Extracts product data (prices, sales volume, reviews, seller info) | Watch (optional) |
| 6 | Navigates to **trending/rising products** pages | Watch (optional) |
| 7 | Packages all data and moves to the next platform | Automatic |
| 8 | When all done → auto-transitions to Agent Analysis | Automatic |

The user **never types a keyword, selects a category, or tells the app where to look**. The extraction scripts know which pages contain the most valuable market intelligence:

| Platform | Auto-Navigates To |
|---|---|
| Taobao | 爱淘宝热销榜 (Hot Sellers), 淘宝热搜 (Trending Searches), category bestsellers |
| JD.com | 京东排行榜 (JD Rankings), 新品首发 (New Arrivals), category hot lists |
| Amazon | Best Sellers, Movers & Shakers, New Releases, Most Wished For |
| Shopee | Top Sales, Flash Deals trending, Daily Discover |
| Google Trends | Auto-queries top 20 product categories for the target market |
| Baidu Index | Auto-queries trending consumer product keywords |

### 5.7 Login Flow (Minimal Friction)

For platforms that require authentication (Taobao, JD, Amazon, etc.):

```
[Extraction starts]
    │
    ├── Public platforms (Google Trends, Baidu Index, eBay)
    │   → Extract immediately, no user action needed
    │
    └── Login-required platforms (Taobao, JD, Amazon, etc.)
        │
        ▼
    [Platform tab auto-opens with login page]
    [Banner: "Please log in to unlock data from Taobao"]
        │
        ▼
    [User logs in normally]
        │
        ▼
    [App detects successful login → platform joins extraction queue]
    [✓ "Taobao ready — will scan when it's next in the queue"]
```

- Public platforms start extracting immediately — no waiting
- Login-required platforms are opened in tabs. The user can log in to as many as they want, in any order
- If the user skips a login-required platform, extraction proceeds with the remaining platforms. The pipeline shows it as "Skipped"
- **Critical**: There is no separate "Connect" step. The Extraction Dashboard IS the connection step. Everything happens on one screen.

### 5.8 Platform Toggle (Optional Override)

Although all market platforms are included by default, each platform row in the Task Pipeline has a subtle **toggle switch** on the right edge:

| Toggle State | Effect |
|---|---|
| On (default) | Platform is included in extraction |
| Off | Platform is excluded. Row shows "Disabled by you" in grey |

This is for advanced users who know they don't want a specific platform. The toggle is subtle — most users won't touch it.

---

## 6. Feature: Transparent Extraction Feedback

### 6.1 Problem

In v1, extraction happens as an invisible black box. The user sees "Extracting..." but has no idea what data is being read, how much has been found, or what the app is doing on the page.

### 6.2 Solution: Live Extraction Log

During and after extraction, the right panel shows a **compact extraction log**:

```
┌──────────────────────────────────────────┐
│  📊 Data Collected from Taobao           │
│  ─────────────────────────────────       │
│  ✓ Bestseller rankings: 50 products      │
│  ✓ Trending hot searches: 30 keywords     │
│  ✓ Price ranges: captured                 │
│  ✓ Monthly sales volume: 50 products      │
│  ✓ Review counts & seller ratings          │
│  ⟳ Rising categories: scanning...         │
│  ───────────────────────────────────       │
│  Total: 50 products, 6 data signals      │
└──────────────────────────────────────────┘
```

### 6.3 Extraction Log Spec

| Row | Format | Timing |
|---|---|---|
| Waiting (not started) | `○ [Field name]` (grey) | Before extraction starts |
| In progress | `⟳ [Field name]: scanning...` (amber, animated) | During DOM extraction |
| Complete | `✓ [Field name]: [count/summary]` (green) | After field extracted |
| Error | `✗ [Field name]: not available on this page` (red) | If field not found |

The log entries are driven by extraction script events. Each script emits progress callbacks as it extracts different data fields (listings, prices, reviews, etc.).

### 6.4 Benefits

- User **sees the app working on their behalf** — it's exploring bestsellers and trending pages automatically
- User can **verify** the app is collecting real market intelligence (transparency builds trust)
- If extraction partially fails, user sees **which signals are missing** and understands the impact

---

## 7. Extraction → Analysis Auto-Transition

### 7.1 No Separate Progress Screen

In v2, there is **no separate extraction progress screen**. The Extraction Dashboard (§5) IS the progress screen. The Task Pipeline shows real-time progress, and the tabbed webview lets users watch.

### 7.2 Auto-Transition to Agent Analysis

When all platforms finish (or the user clicks "Analyze Now" after ≥ 1 platform is done):

1. Task Pipeline shows all platforms as ✓ Done (or Skipped/Error)
2. A 2-second countdown banner appears: _"All data collected! Starting analysis in 3… 2… 1…"_
3. Auto-transitions to the Agent Analysis screen (unchanged from v1 — shows the live reasoning steps)

The user can also click "Analyze Now" at any time after at least 1 platform completes, to proceed with partial data.

---

## 8. Feature: Results Dashboard (Categorized Candidates)

v1 displays results as a flat ranked list of 5–10 recommendation cards sorted by overall score. This doesn't help users **compare across opportunity types** or understand **why** any product was chosen. v2 redesigns the results as a **categorized candidate list** with per-product reasoning.

### 8.1 Results Structure

Results are organized into **category groups**. Each group represents a product opportunity category that the agent identified as relevant for the user's market. Categories are not hardcoded — the agent determines them dynamically based on the extracted data.

```
┌──────────────────────────────────────────────────────────────────┐
│  Results Dashboard — 🇺🇸 US Market                    ⚙ Prefs   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📂 Trending Home & Kitchen  (5 products)              ▼ expand  │
│  ├── #1  Portable Blender Bottle           Score: 87  ▸ Detail   │
│  ├── #2  Collapsible Silicone Strainer     Score: 81  ▸ Detail   │
│  ├── #3  Smart Soap Dispenser              Score: 79  ▸ Detail   │
│  ├── #4  Ice Cube Tray with Lid            Score: 74  ▸ Detail   │
│  └── #5  Bamboo Cutlery Travel Set         Score: 71  ▸ Detail   │
│                                                                  │
│  📂 Rising Electronics & Gadgets  (4 products)        ▼ expand   │
│  ├── #1  Mini Projector                    Score: 84  ▸ Detail   │
│  ├── #2  Bluetooth Earbuds Case            Score: 78  ▸ Detail   │
│  ├── #3  Magnetic Phone Mount              Score: 75  ▸ Detail   │
│  └── #4  USB-C Hub Adapter                 Score: 70  ▸ Detail   │
│                                                                  │
│  📂 Seasonal Opportunity — Summer  (3 products)       ▼ expand   │
│  ├── #1  UV Sanitizer Bottle               Score: 82  ▸ Detail   │
│  ├── #2  Cooling Neck Fan                  Score: 76  ▸ Detail   │
│  └── #3  Waterproof Phone Pouch            Score: 72  ▸ Detail   │
│                                                                  │
│  [Re-analyze ↻]   [Export CSV ↓]   [Save to My List ★]          │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Category Groups

The agent dynamically generates 3–6 category groups based on the data. Typical group types include:

| Group Type | When Generated | Example |
|---|---|---|
| Trending category | Products with rising demand signals | "Trending Home & Kitchen" |
| Seasonal opportunity | Products peaking in an upcoming season | "Seasonal Opportunity — Summer" |
| High-margin niche | Products with low competition + high margin | "High-Margin Niche — Pet Supplies" |
| Platform-specific hot | Products trending on a specific platform | "Hot on TikTok Shop" |
| Emerging category | New product types with fast growth | "Emerging — Smart Home Gadgets" |
| Budget-friendly entry | Low COGS products for new sellers | "Easy Start — Under $10 COGS" |

Each group shows:
- **Group name** — a plain-language label (generated by agent)
- **Product count** — number of candidates in the group
- **Collapsible list** — products ranked by score within the group, all expanded by default

### 8.3 Candidate Card (Per Product)

Each product in the list is a candidate card. Clicking "▸ Detail" expands the card inline or navigates to a detail view.

#### Collapsed View (List Row)

```
#1  Portable Blender Bottle    Score: 87    Home & Kitchen
    "Growing 34% YoY with low competition — good entry window"
```

Every candidate row shows:
- **Rank** within its category group
- **Product name** (generic category name, not brand)
- **Overall score** (0–100)
- **One-line reason** — a plain-English sentence explaining why this product was selected

#### Expanded / Detail View

```
┌─────────────────────────────────────────────────────────────┐
│  #1  Portable Blender Bottle                    Score: 87   │
│  Category: Trending Home & Kitchen                           │
├─────────────────────────────────────────────────────────────┤
│  WHY THIS PRODUCT?                                           │
│  ✅ Demand is growing 34% year-over-year on Google Search   │
│  ✅ Only 23% of competing listings have 500+ reviews —      │
│     the market is not yet saturated                         │
│  ✅ Source at ~$6–9, list at $24–32 → est. 58% gross margin │
│  ✅ Trending on TikTok #healthylifestyle (2.1M posts/week)  │
│  ⚠️  Demand peaks in Jan–Mar; plan inventory accordingly    │
├─────────────────────────────────────────────────────────────┤
│  SCORE BREAKDOWN            QUICK STATS                      │
│  Demand:      ████████ 82   Avg Sell Price:  $27            │
│  Competition: █████████ 88  Est. COGS:       $7             │
│  Margin:      ███████  76   Est. Gross Margin: 58%          │
│  Trend:       ████████ 91   Top Platform:   Amazon          │
├─────────────────────────────────────────────────────────────┤
│  SOURCE PLATFORMS                                            │
│  📊 Amazon — BSR #342 in Kitchen, 4.3★ avg, 127 reviews    │
│  📊 Google Trends — "portable blender" +34% YoY            │
│  📊 TikTok — #portableblender 8.2M views this month        │
│  📊 Alibaba — 12 suppliers, $5.80–$9.20 FOB                │
├─────────────────────────────────────────────────────────────┤
│  SUGGESTED NEXT STEPS                                        │
│  "View suppliers on Alibaba →"  "Compare with #2 →"         │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 Selection Reasoning Requirements

The agent **must** provide reasoning for every candidate. This is enforced in the agent prompt:

| Reasoning Element | Required | Description |
|---|---|---|
| One-line summary reason | Yes | Shown in collapsed list row; ≤ 120 characters |
| "Why this product?" bullets | Yes | 3–5 bullets in detail view; plain English, no jargon |
| Risk flags (⚠️) | If applicable | Seasonal risk, regulatory concerns, competition spikes |
| Source platforms | Yes | Which extracted data sources contributed to this recommendation |
| Score breakdown | Yes | Per-dimension scores (demand, competition, margin, trend) |

The agent prompt includes:
```
For every recommended product, you MUST provide:
1. A one-line reason (≤ 120 chars) explaining why this product is a good opportunity
2. 3–5 "Why this product?" bullet points with specific data from the extraction
3. Risk warnings for any seasonal, regulatory, or competitive concerns
4. The specific platforms and data points that support your recommendation

Do NOT recommend a product without explaining WHY. The user needs to make
an informed decision — your job is to surface the reasoning, not just the ranking.
```

### 8.5 Results Interaction

| Action | Result |
|---|---|
| Click category header | Collapse/expand the category group |
| Click product row | Expand inline detail view |
| Click "▸ Detail" | Navigate to full product detail screen |
| Click "Re-analyze ↻" | Re-run agent analysis with current data (respects Advanced Preferences) |
| Click "Export CSV ↓" | Download all candidates across all categories as CSV |
| Click "Save to My List ★" | Save current results to local history |
| Drag to reorder | User can manually reorder candidates within a category |

---

## 9. Updated Screen List (v2)

| # | Screen | v1 Step | v2 Step | Notes |
|---|---|---|---|---|
| 0 | Quick Start (new) | — | 0 (returning users only) | 1-click to re-run |
| 1 | Market Selection | Step 1 | Step 1 | Unchanged — the **only** wizard step |
| — | ~~Platform Selection~~ | ~~Step 3~~ | Removed | Platforms are auto-selected from market |
| — | ~~Budget~~ | ~~Step 2~~ | Moved to Advanced Preferences | Optional |
| — | ~~Product Type~~ | ~~Step 4~~ | Moved to Advanced Preferences | Optional |
| — | ~~Categories~~ | ~~Step 5~~ | Removed | Agent handles all categories |
| — | ~~Fulfillment~~ | ~~Step 6~~ | Moved to Advanced Preferences | Optional |
| 2 | Extraction Dashboard (new) | Steps 7+8 combined | Step 2 | Task pipeline + tabbed webviews |
| — | ~~Data Sources Connect~~ | ~~Step 7~~ | Merged into Extraction Dashboard | Login prompts are inline |
| — | ~~Extraction Progress~~ | ~~Step 8~~ | Merged into Extraction Dashboard | Pipeline IS the progress |
| 3 | Agent Analysis | Step 9 | Step 3 | Unchanged |
| 4 | Results Dashboard | Step 10 | Step 4 | **Redesigned** — categorized candidates with reasoning (see §8) |
| 5 | Product Detail | Step 11 | Step 5 | Unchanged |

### Step Numbering Mapping (for wizard store)

| v2 `currentStep` | Screen |
|---|---|
| 0 | Quick Start (returning users) |
| 1 | Market Selection |
| 2 | Extraction Dashboard (connect + extract + progress all here) |
| 3 | Agent Analysis |
| 4 | Results Dashboard |
| 5 | Product Detail |

**Total user-facing screens: 5** (down from 11 in v1). The user makes **1 decision** (market) and then watches the app work.

---

## 10. Advanced Preferences Panel Spec

### 10.1 Trigger

- **Gear icon button** (⚙) in the Data Extraction screen header and Results Dashboard toolbar
- Opens as a **slide-out drawer** from the right edge (400px wide) or a collapsible section

### 10.2 Contents

The 4 former wizard steps, rendered compactly in a single scrollable panel:

```
┌─────────────────────────────────────────┐
│  ⚙ Advanced Preferences          [ × ] │
│  ─────────────────────────────────      │
│                                         │
│  Budget                                 │
│  [ ────●──────── ] ¥2,500              │
│                                         │
│  Product Type                           │
│  ◉ Physical  ○ Digital                  │
│                                         │
│  Categories (optional)                  │
│  [ Electronics ] [ Home ] [ Fashion ]   │
│  [ Beauty ] [ Sports ] [ Toys ]         │
│                                         │
│  Fulfillment Time                       │
│  ○ < 5h/week  ◉ 5–15h  ○ 15h+         │
│                                         │
│  ─────────────────────────────────      │
│  [ Reset to Defaults ]   [ Apply ]      │
└─────────────────────────────────────────┘
```

### 10.3 Behaviour

| Action | Result |
|---|---|
| Open drawer | Populated with current preferences (saved or defaults) |
| Change any value | Stored in wizard store immediately (no "Apply" needed for local state) |
| Click "Apply" | Closes drawer. If called from Results Dashboard, triggers re-analysis with new preferences. |
| Click "Reset to Defaults" | Reverts all preferences to market-specific defaults |
| Click "×" | Closes drawer without discarding changes (changes are already stored) |

---

## 11. Feature: One-Click Installer

### 11.1 Problem

v1 requires users to:
1. Install Node.js and pnpm
2. Install Docker Desktop
3. Run `docker compose up -d` to start Postgres and Redis
4. Run `pnpm dev:backend` to start the API server
5. Run `pnpm electron:dev` to start the client
6. Manually create a `.env` file for JWT keys and database URLs

This is unacceptable for the target audience (beginners with zero technical background).

### 11.2 Solution: Packaged Installer

The app ships as a **single installer file** with zero prerequisites:

| Platform | Installer Type | File |
|---|---|---|
| Windows | NSIS installer or MSI | `OneSell-Scout-Setup-x.x.x.exe` |
| macOS | DMG with drag-to-Applications | `OneSell-Scout-x.x.x.dmg` |
| Linux (stretch goal) | AppImage or .deb | `OneSell-Scout-x.x.x.AppImage` |

### 11.3 What the Installer Includes

- Electron app (bundled with Chromium)
- All extraction scripts (pre-compiled)
- Local storage engine (SQLite or electron-store — no Docker/Postgres)
- No Docker, no Node.js runtime, no backend server

### 11.4 User Experience

```
[User downloads OneSell-Scout-Setup.exe from website]
        │
        ▼
[Double-click installer → standard Windows install wizard]
[Installs in ~30 seconds]
        │
        ▼
[Desktop shortcut created → user clicks to launch]
        │
        ▼
[App opens → Market Selection screen]
        │
        ▼
[Ready to use. No configuration needed.]
```

### 11.5 Build Pipeline

| Tool | Purpose |
|---|---|
| `electron-builder` | Package Electron app into platform installers (already in `electron-builder.yml`) |
| GitHub Actions | CI/CD pipeline builds installers on every release tag |
| Code signing (future) | Windows Authenticode + macOS notarization to avoid security warnings |

### 11.6 No Auto-Update (v2)

For the early release, updates are manual (download new installer from website). Auto-update via `electron-updater` is a Phase 3 enhancement.

---

## 12. Feature: Client-Only Architecture (Early Release)

### 12.1 Design Decision

**For the early release (v2.0), OneSell Scout runs entirely on the client. No backend server.**

| Aspect | v1 (backend-dependent) | v2 Early Release (client-only) |
|---|---|---|
| Database | PostgreSQL via Docker | `electron-store` (JSON) or SQLite |
| Cache | Redis via Docker | In-memory or file-based |
| LLM calls | Backend → OpenAI API | Client main process → OpenAI API directly |
| User accounts | JWT auth via Fastify | None — local user only |
| Saved lists | PostgreSQL `saved_lists` table | Local file storage |
| Session history | PostgreSQL + Redis TTL | Local file (electron-store) |
| Tier enforcement | Backend middleware | Client-side (honor system for free tier; Pro+ backend enforcement later) |
| Install requirements | Docker + Node.js + pnpm | None — single installer |

### 12.2 Why Client-Only

1. **Target users cannot run Docker** — our personas are beginners who've never used a terminal
2. **Faster to ship** — remove the entire backend deployment story for v2
3. **Validates the product** — if users love the extraction + analysis workflow, backend features can be added. If they don't, we haven't over-invested in infrastructure.
4. **Lower barrier** — download, install, use. No account creation, no server, no Docker
5. **Privacy benefit** — all data stays on the user's machine. No server to trust.

### 12.3 LLM API Key Strategy

Since LLM analysis now runs client-side, the user's API key must be handled:

| Option | Description | Recommended Phase |
|---|---|---|
| **A: User provides own key** | Settings screen where user enters their OpenAI API key. Stored locally (encrypted via electron safeStorage). | **v2.0 (ship this)** |
| **B: Bundled free credits** | App ships with a proxy endpoint that provides N free analyses, rate-limited per device. | v2.1 |
| **C: Backend key (Pro+)** | Authenticated users on paid tiers get server-proxied LLM access with usage tracking. | Pro+ tier |

For v2.0 early release: **Option A**. A first-launch setup screen asks for an OpenAI API key with a link to get one. The key is stored locally using Electron's `safeStorage` API (OS-level encryption). The key never leaves the device.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Welcome to OneSell Scout!                              │
│                                                          │
│   To analyze market data, the app needs an OpenAI        │
│   API key. Your key stays on this device only.           │
│                                                          │
│   [ Enter your API key: _________________________ ]      │
│                                                          │
│   Don't have one? [Get a key from OpenAI →]              │
│                                                          │
│   [ Save & Continue → ]                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 12.4 Local Data Storage

All data that was previously in PostgreSQL/Redis is now stored locally:

| Data | Storage | Format |
|---|---|---|
| User preferences (market, budget, etc.) | `electron-store` | JSON |
| Saved profile (Quick Start) | `electron-store` | JSON |
| API key | `electron safeStorage` | Encrypted |
| Extraction results (raw) | Temp files, auto-deleted after analysis | JSON |
| Analysis results (recommendations) | `electron-store` or local SQLite | JSON |
| Session history | `electron-store` | JSON array (last 10 sessions) |

### 12.5 What Gets Deferred to Pro+ (Backend)

These v1 backend features are **not included** in v2 early release:

| Feature | Status | When |
|---|---|---|
| User accounts & authentication | Deferred | Pro+ |
| Team sharing & collaboration | Deferred | Business tier |
| Cloud sync of saved lists | Deferred | Starter+ |
| Server-side tier enforcement | Deferred | Pro+ (client-side honor system for now) |
| Usage tracking & analytics | Deferred | Pro+ |
| Rate limiting | Deferred | Pro+ |
| Subscription billing | Deferred | Pro+ |

### 12.6 Agent Analysis — Client-Side

The LLM agent (Planner → Executor → Synthesizer) runs in the Electron **main process**:

```
[Extraction Dashboard completes]
        │
        ▼
[Main process assembles AnalysisPayload (same format as v1)]
        │
        ▼
[Main process calls OpenAI API directly]
  - Uses user's API key from safeStorage
  - Same system prompts and tool functions as v1 backend
  - Tool functions (calc_margin, rank_competition, etc.) run locally
        │
        ▼
[Results returned to renderer via IPC]
        │
        ▼
[Results Dashboard displays recommendations]
```

The agent service code (`onesell-backend/src/services/agent/`) is **moved to `onesell-client/src/main/agent/`** and adapted to run in Node.js (Electron main process) instead of Fastify route handlers.

---

## 13. Implementation Priorities (Updated)

### Phase 1 — Critical (P0): Ship the Client-Only Product

| Issue | Description | Epic |
|---|---|---|
| 1-step wizard | Remove all wizard steps except Market Selection; auto-select platforms from market | `epic:wizard` |
| Extraction Dashboard | New unified screen: Task Pipeline + tabbed webviews (replaces DataSourceConnect + ProgressScreen) | `epic:extraction` |
| Auto-platform selection | App determines all platforms from `MARKET_CONFIGS[marketId]` and auto-starts extraction flow | `epic:extraction` |
| Task Pipeline component | Narrated progress rows with status icons, plain-language descriptions, toggle switches | `epic:extraction` |
| Tabbed webview panel | Collapsible tabs per platform showing live BrowserView or status summary | `epic:extraction` |
| Step renumbering | Update wizard store, App.tsx routing — 5 screens total | `epic:wizard` |
| Client-side agent | Move agent service to Electron main process; call OpenAI API directly | `epic:agent` |
| Local data storage | Replace PostgreSQL/Redis with electron-store; all data local | `epic:foundation` |
| API key setup screen | First-launch screen for OpenAI key entry; encrypted storage via safeStorage | `epic:foundation` |
| One-click installer | electron-builder packaging for Windows (.exe) and macOS (.dmg) | `epic:foundation` |
| Remove backend dependency | App launches without Docker/Postgres/Redis/Fastify | `epic:foundation` |

### Phase 2 — High (P1): Polish & Returning Users

| Issue | Description | Epic |
|---|---|---|
| Saved user profile | Client-side persistence (electron-store), Quick Start screen | `epic:wizard` |
| Auto-login detection | Detect when user has authenticated in a platform tab; auto-queue for extraction | `epic:extraction` |
| Extraction progress events | Extraction scripts emit granular progress callbacks for the mini-log in each tab | `epic:extraction` |
| Advanced Preferences drawer | Budget, product type, fulfillment as a drawer component | `epic:wizard` |
| Auto-transition to analysis | Countdown banner + auto-navigate when all platforms done | `epic:extraction` |
| Session history | Store last 10 analysis sessions locally; browsable from Results screen | `epic:foundation` |

### Phase 3 — Medium (P2): Enhancement

| Issue | Description | Epic |
|---|---|---|
| Autonomous navigation scripts | Upgrade extraction scripts to auto-navigate bestseller/trending pages | `epic:extraction` |
| Time estimate | Calculate and display estimated extraction time per platform | `epic:extraction` |
| Profile management | Clear/edit saved profile from a settings menu | `epic:wizard` |
| Tab collapse/expand | Let users collapse the webview tabs to see only the Task Pipeline | `epic:extraction` |
| Bundled free credits | Proxy endpoint for N free analyses without user API key (v2.1) | `epic:monetization` |
| Auto-updater | electron-updater for seamless app updates | `epic:foundation` |

### Phase 4 — Pro+ Backend (P3): Future Monetization

| Issue | Description | Epic |
|---|---|---|
| Backend server reintroduction | Fastify API with PostgreSQL/Redis for authenticated users | `epic:foundation` |
| User accounts | Registration, login, JWT auth | `epic:security-nfr` |
| Cloud sync | Sync saved lists and session history to server | `epic:foundation` |
| Server-side tier enforcement | Real subscription tiers with payment integration | `epic:monetization` |
| Team sharing | Business tier: shared workspaces and collaborative lists | `epic:monetization` |

---

## 14. Impact on Existing Systems

### Agent Service — Moved to Client

- The agent analysis service moves from the Fastify backend to the Electron **main process**
- Agent prompts (`onesell-backend/src/services/agent/prompts/`) are copied to `onesell-client/src/main/agent/prompts/`
- The main process makes direct HTTPS calls to OpenAI API using the user's API key (stored via `safeStorage`)
- No changes to the prompt content or analysis logic — only the transport layer changes

### Extraction Scripts — Autonomous Navigation

Extraction scripts need two enhancements:

**1. Autonomous navigation** — scripts must know how to navigate to bestseller/trending pages:

```typescript
interface ExtractionScript {
  platformId: string;
  extract(document: Document): RawPlatformData | null;
  getNavigationTargets(): string[];

  // NEW in v2: auto-navigation sequence
  getAutoDiscoveryUrls(): Array<{
    url: string;           // e.g., 'https://www.taobao.com/markets/hot'
    label: string;         // e.g., 'Hot Sellers'
    expectedDataType: string; // e.g., 'bestseller-listings'
  }>;
}
```

**2. Progress events** — scripts emit granular callbacks for the extraction log:

```typescript
interface ExtractionProgressEvent {
  field: string;        // e.g., 'bestseller-listings', 'trending-keywords'
  status: 'scanning' | 'done' | 'error';
  count?: number;       // e.g., 52
  summary?: string;     // e.g., 'Top 50 products from hot sellers list'
}
```

### Backend — Preserved but Not Required

- The Fastify backend (`onesell-backend/`) is **not deleted** — it remains in the repo for Pro+ development
- Docker Compose, PostgreSQL, and Redis configs remain but are **not used** by the client-only release
- The backend API contracts are unchanged; Pro+ features will re-enable the client→backend connection
- Build scripts (`pnpm dev`, `pnpm build`) are updated so the client can start independently without backend

### Build System Changes

- `electron-builder` is added to `onesell-client/` for producing installers
- New npm scripts: `pnpm dist:win`, `pnpm dist:mac`, `pnpm dist:linux`
- CI/CD pipeline updated to produce platform-specific artifacts on tagged releases
- `pnpm dev` in client no longer requires `docker compose up` or backend running

---

## 15. Migration from v1

### Backward Compatibility

- Users upgrading from v1 to v2 will see the new 1-step wizard on first launch (no saved profile yet)
- Their first v2 session saves a profile; subsequent launches show Quick Start
- All existing extraction scripts remain compatible
- v1 extraction scripts work as-is initially; autonomous navigation (`getAutoDiscoveryUrls`) is added in Phase 3
- **No backend migration needed** — v2 client stores data locally; v1 backend data (if any) is not carried over

### What Gets Removed from the User Flow

- `BudgetStep`, `ProductTypeStep`, `CategoriesStep`, `FulfillmentStep` → relocated to `AdvancedPreferencesDrawer`
- `PlatformStep` → **removed entirely** (platform selection is automatic from market config)
- `WizardLayout` → **removed** (only 1 wizard step, renders directly)
- `Wizard.tsx` → **removed** (no longer needed as a step container)
- `DataSourceConnect` → **replaced** by `ExtractionDashboard`
- `ProgressScreen` → **merged** into `ExtractionDashboard`
- `App.tsx` routing changes from 11 steps to 5 screens
- Backend dependency for analysis → **replaced** by direct OpenAI API call from main process

---

## 16. Open Questions (v2)

1. **Quick Start vs. auto-start**: Should the Quick Start screen even exist, or should the app auto-start extraction with saved settings and show a "Settings changed? Click here" link? (Recommendation: keep Quick Start — explicit user intent before extraction is safer.)
2. **Multiple saved profiles**: Should users be able to save multiple profiles (e.g., one for China, one for US)? (Recommendation: defer to v2.1 — single profile is sufficient for now.)
3. **Advanced preferences timing**: Should changing advanced preferences during results trigger an automatic re-analysis or require the user to click "Re-analyze"? (Recommendation: require explicit click — avoids surprise API cost.)
4. **Extraction progress granularity**: How many progress events can extraction scripts realistically emit? Some simple scripts (Google Trends) may only have 1-2 fields. (Recommendation: minimum 2 events per script — "started" and "done" — with more granular events as an enhancement.)
5. **Offline mode**: Should the client work without an internet connection (cached results only)? (Recommendation: defer — extraction and analysis both require internet.)

---

## 17. Relationship to v1 PRD

This document **supplements** `docs/PRD-Product-Selection-Module.md` (v0.4). Sections not mentioned here remain unchanged:

- §1 Executive Summary — updated implicitly (faster onboarding, client-only)
- §2 Problem Statement — unchanged
- §3 Goals — updated targets in this doc's §2
- §4 User Personas — unchanged
- §5.1–5.2 Feature overview + wizard — **superseded by this doc's §3 (1-step wizard)**
- §5.3 Client-side data collection — **superseded by this doc's §5 (Extraction Dashboard)**
- §5.4 Agent analysis system — **superseded by this doc's §12 (agent moves to client main process)**
- §5.5 Output recommendation cards — **superseded by this doc's §8 (categorized candidates with reasoning)**
- §6 User flow — **superseded by this doc's §3.4**
- §7 Key screens — **superseded by this doc's §9 (5 screens vs 11)**
- §7A Interaction spec — **superseded by this doc's §5 (Extraction Dashboard spec)**
- §8 Technical architecture — **partially superseded by this doc's §12 (client-only) and §11 (installer)**
- §9 Non-functional requirements — unchanged
- §10 Monetization — unchanged (tier enforcement deferred to Pro+ backend phase)
- §11–14 — **superseded by this doc's §14–§15**

---

*This PRD requires human sign-off before sprint issues are created. See `.github/copilot-instructions.md` §10 — PRD Gate.*
