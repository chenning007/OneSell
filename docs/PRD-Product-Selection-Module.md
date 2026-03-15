# PRD: OneSell Scout — Intelligent Product Selection Module

**Product**: OneSell Scout  
**Module**: Product Selection Intelligence  
**Version**: 0.3 (Multi-Market Support)  
**Author**: PM — OneSell  
**Date**: 2026-03-15  
**Status**: Draft  
**Change from v0.2**: Added target market / region selection step. Platform lists, data sources, currency, language, and agent reasoning are now fully localized to the user's chosen market.

---

## 1. Executive Summary

OneSell Scout is the first module of the OneSell platform. It removes the single biggest barrier for first-time online sellers: *"What should I sell?"*

It works in two steps:

1. **The user collects data themselves** — via a lightweight desktop/browser client, the user logs into any e-commerce or market research website they already have access to (Amazon, Alibaba, Google Trends, TikTok, etc.). The client extracts market data from those authenticated sessions on the user's behalf, with full transparency and user control.

2. **An LLM agent does the thinking** — the extracted data is passed to an AI agent that autonomously plans analysis tasks, executes them (reasoning over demand, competition, margin, and trend signals), and writes a curated, plain-language product shortlist with clear justifications.

No proprietary data scrapers. No third-party API subscriptions. No rule-based black boxes. The user brings their own data access; the AI brings the intelligence.

Critically, **the user chooses their target market** (e.g., China, US, Southeast Asia, Europe) at the start of every session. The platform list, suggested data sources, currency, supplier options, and the agent's reasoning are all automatically tailored to that market — so a Chinese seller researching Taobao and JD.com gets exactly the same quality of guidance as a US seller researching Amazon.

---

## 2. Problem Statement

### Who is the user?
An individual (18–45) with zero online selling experience. They are motivated to start an e-commerce side hustle or business but are overwhelmed by the first step: choosing what to sell.

### What are their pain points?

| Pain Point | Detail |
|---|---|
| Information overload | Hundreds of "top products to sell" blog posts with no personalization |
| No analytical skills | Cannot read Google Trends, Jungle Scout, or Alibaba data meaningfully |
| Fear of wrong choice | Afraid to invest money/time in a product that won't sell |
| No market intuition | Cannot gauge competition levels or margin potential |
| Time cost | Manual research across 10+ platforms takes days |

### What is the cost of inaction?
Users either pick randomly (high failure rate), pay expensive consultants, or never start at all.

---

## 3. Goals & Success Metrics

### Goals
1. Reduce time-to-first-product-decision from days → under 15 minutes.
2. Give a beginner the confidence of an experienced seller.
3. Generate a shortlist of viable products with transparent, jargon-free reasoning.

### Success Metrics (KPIs)

| Metric | Target (3 months post-launch) |
|---|---|
| % of users who complete a product shortlist | ≥ 70% |
| Average session time for product discovery | < 15 min |
| User satisfaction (NPS) on recommendations | ≥ 40 |
| Conversion: shortlist → listing created | ≥ 30% |
| Recommendation accuracy (user-rated "relevant") | ≥ 75% |

---

## 4. User Personas

### Persona A — "The Curious Beginner" (Primary, US/Global)
- **Name**: Jamie, 28
- **Background**: Office worker, wants a side income, zero e-commerce experience
- **Tech comfort**: Uses Amazon, TikTok, Instagram daily; comfortable with apps
- **Goal**: Find 1–3 products to start selling on Amazon or Shopify within 30 days
- **Frustration**: "I don't know where to start. Everything feels risky."

### Persona B — "The Career Changer" (Secondary, US/Global)
- **Name**: Maria, 42
- **Background**: Left corporate job, planning full-time e-commerce
- **Tech comfort**: Moderate; uses spreadsheets
- **Goal**: Systematically identify a niche with sustainable demand
- **Frustration**: "I've done research but can't tell if my idea is actually good."

### Persona C — "The Chinese Domestic Seller" (Primary, China Market)
- **Name**: Wei, 30
- **Background**: Factory worker or small business owner, wants to sell on Chinese platforms
- **Tech comfort**: Heavy mobile user; uses Taobao, Pinduoduo, WeChat daily
- **Goal**: Find trending products to sell on Taobao, JD.com, or Pinduoduo
- **Frustration**: "I see products trending on Douyin but I don't know which ones will actually sell well and have good margins."

### Persona D — "The Southeast Asia Seller" (Emerging, SEA Market)
- **Name**: Anya, 26
- **Background**: Freelancer in Indonesia, wants to start selling on Shopee or Tokopedia
- **Tech comfort**: Mobile-first; uses Shopee and TikTok daily
- **Goal**: Identify products with strong local demand in SEA
- **Frustration**: "Products that sell in the US don't always work here. I need data for my market."

---

## 5. Core Feature: Product Selection Intelligence

### 5.1 Feature Overview

A two-phase workflow:

- **Phase 1 — Data Collection (Client)**: The user opens the OneSell Scout client, connects to the websites they want to pull data from by logging in normally, and tells the client what categories or keywords to focus on. The client extracts raw market data from those authenticated browser sessions.

- **Phase 2 — Agent Analysis (Backend)**: The collected raw data is sent to an LLM agent on the backend. The agent autonomously plans and executes a set of analysis tasks — reasoning over trends, competition, margins, and suitability — then produces a final ranked product shortlist with plain-English explanations for each recommendation.

---

### 5.2 User Inputs (Preference Wizard)

The user answers a short **6-step** onboarding wizard before the analysis runs. **Step 1 is now market/region selection** — it determines every platform and data source shown in subsequent steps.

| Step | Question | Input Type | Purpose |
|---|---|---|---|
| 1 | **Which market are you selling in?** | Single-select with flag icons (see Market List below) | Determines platform list, currency, language, supplier options, and agent prompts for the entire session |
| 2 | What is your approximate starting budget? | Slider in local currency (e.g., ¥500 / ¥2,000 / ¥5,000 for China; $50 / $200 / $500 for US) | Filter out high-cost product categories |
| 3 | Where do you plan to sell? | Multi-select — **populated dynamically based on Step 1** (see Platform Table below) | Target platform-specific data sources |
| 4 | Do you prefer physical or digital products? | Toggle | Scope search |
| 5 | Any categories you love or want to avoid? | Tag select — **localized category labels per market** | Personalize results |
| 6 | How much time can you spend on fulfillment per week? | Options: < 5h / 5–15h / 15h+ | Factor in product complexity |

#### Supported Markets (v1)

| Market | Region | UI Language | Currency | Notes |
|---|---|---|---|---|
| 🇺🇸 United States | North America | English | USD | Default market |
| 🇨🇳 China (Domestic) | China | Simplified Chinese | CNY (¥) | Separate platform set; Douyin/Taobao-focused |
| 🇬🇧 United Kingdom | Europe | English | GBP | Amazon UK + Etsy UK |
| 🇩🇪 Germany / EU | Europe | German / English | EUR | Amazon DE + Otto |
| 🇯🇵 Japan | Asia-Pacific | Japanese / English | JPY | Amazon JP + Mercari JP |
| 🇮🇩 Southeast Asia | SEA | English | USD / local | Shopee + Tokopedia + Lazada |
| 🇦🇺 Australia | Oceania | English | AUD | Amazon AU + Catch |

> Additional markets added post-launch based on user demand.

#### Platform Options Per Market (Step 3 — dynamically shown)

| Market | Selling Platforms (multi-select) | Primary Supplier Source |
|---|---|---|
| 🇺🇸 US | Amazon, Shopify, eBay, Etsy, TikTok Shop US, Walmart Marketplace | Alibaba, AliExpress, CJdropshipping |
| 🇨🇳 China | Taobao, Tmall, JD.com, Pinduoduo, Douyin Shop, Kuaishou Shop, Xiaohongshu | 1688.com, Yiwu market listings |
| 🇬🇧 UK | Amazon UK, eBay UK, Etsy, OnBuy | Alibaba, AliExpress |
| 🇩🇪 Germany / EU | Amazon DE, eBay DE, Otto, Etsy | Alibaba, AliExpress |
| 🇯🇵 Japan | Amazon JP, Rakuten, Mercari, Yahoo! Shopping | Alibaba, domestic wholesalers |
| 🇮🇩 SEA | Shopee (ID/MY/TH/PH), Tokopedia, Lazada, TikTok Shop SEA | Alibaba, AliExpress, local suppliers |
| 🇦🇺 Australia | Amazon AU, eBay AU, Catch, Etsy | Alibaba, AliExpress |

---

### 5.3 Client-Side Data Collection

#### How It Works

The OneSell Scout **desktop client** (Electron app) embeds a controlled browser panel. The user navigates to any supported platform and logs in with their own credentials. The client then runs extraction scripts on the pages the user visits — exactly as if the user were reading them manually, but structured and saved automatically.

This approach:
- Requires **zero third-party API subscriptions** from OneSell
- Operates entirely within the user's own authenticated session (their account, their access rights)
- Gives the user **full visibility and control** over what is extracted
- Avoids server-side mass-crawling ToS concerns

#### Supported Data Sources — by Market

The client only shows platforms relevant to the user's selected market. Extraction scripts are market-specific modules.

**🇺🇸 US Market**

| Platform | User Logs In? | Data Extracted | Signal Category |
|---|---|---|---|
| Amazon (US) | Yes | BSR, review count, price range, seller count | Demand + Competition |
| eBay (US) | No (public) | Completed listings, sell-through rate, price distribution | Demand + Margin |
| Etsy | No (public) | Top listings, review velocity, price spread | Demand + Competition |
| TikTok Shop (US) | Yes (optional) | Trending product hashtags, GMV indicators | Trend + Demand |
| Alibaba / AliExpress | Yes (optional) | MOQ, unit price, shipping cost bracket | Margin (COGS) |
| Google Trends | No (public) | 12-month search index, related queries | Demand + Trend |

**🇨🇳 China (Domestic) Market**

| Platform | User Logs In? | Data Extracted | Signal Category |
|---|---|---|---|
| Taobao / Tmall | Yes | Product search results, monthly sales volume, seller rating, price range | Demand + Competition |
| JD.com | Yes | Category bestseller rank, review count, price, seller tier | Demand + Competition |
| Pinduoduo | Yes | Search result listings, sales volume indicators, price range | Demand + Competition |
| Douyin Shop (抖音小店) | Yes (optional) | Trending product hashtags, live-stream sales indicators, GMV rank | Trend + Demand |
| Kuaishou Shop | Yes (optional) | Trending product categories, sales rank | Trend |
| Xiaohongshu (小红书) | Yes (optional) | Product post count, engagement rate, trending keywords | Trend + Demand |
| 1688.com | Yes (optional) | Wholesale unit price, MOQ, supplier rating, ships-from city | Margin (COGS) |
| Baidu Index (百度指数) | No (public) | Search volume trend by keyword (equivalent to Google Trends for China) | Demand + Trend |

**🇮🇩 Southeast Asia Market**

| Platform | User Logs In? | Data Extracted | Signal Category |
|---|---|---|---|
| Shopee (ID / MY / TH / PH) | Yes | Search results, sales count, review count, price range | Demand + Competition |
| Tokopedia | Yes | Search results, official store rankings, price spread | Demand + Competition |
| Lazada | Yes (optional) | Category bestsellers, review counts, price range | Demand + Competition |
| TikTok Shop (SEA) | Yes (optional) | Trending products, hashtag GMV | Trend + Demand |
| Alibaba / AliExpress | Yes (optional) | MOQ, unit price, shipping estimate | Margin (COGS) |
| Google Trends | No (public) | Search index with geo filter set to target country | Demand + Trend |

**🇬🇧 UK / 🇩🇪 EU / 🇯🇵 Japan / 🇦🇺 Australia**

| Platform | User Logs In? | Data Extracted | Signal Category |
|---|---|---|---|
| Amazon (regional) | Yes | BSR, review count, price, seller count | Demand + Competition |
| eBay (regional) | No (public) | Completed listings, price distribution | Demand + Margin |
| Etsy | No (public) | Top listings, review velocity | Demand + Competition |
| Rakuten (JP only) | Yes | Category rank, review count, price | Demand + Competition |
| Mercari (JP only) | No (public) | Sold listings, price spread | Demand + Margin |
| Alibaba / AliExpress | Yes (optional) | MOQ, unit price, shipping | Margin (COGS) |
| Google Trends | No (public) | Search index with geo filter | Demand + Trend |

#### Extraction Flow (per platform)

```
[User clicks "Connect" for a platform in the client]
        │
        ▼
[Embedded browser panel opens — user logs in normally]
        │
        ▼
[User enters keyword/category focus (e.g. "kitchen gadgets")]
        │
        ▼
[Client auto-navigates relevant pages (search results,
 bestseller lists, product pages) within the session]
        │
        ▼
[DOM extraction scripts collect structured data fields]
        │
        ▼
[Data packaged as JSON → sent to Agent Analysis backend]
```

#### Data Extracted Per Product Signal

**From Amazon (authenticated session)**
- Keyword search result set (top 50 listings): title, ASIN, BSR, price, review count, review rating, seller name, listing age estimate, sponsored/organic flag
- Best Sellers page per category: top 100 ASINs with BSR and price
- Product detail page (spot-sampled): variation count, Q&A volume, buy box info

**From Alibaba/AliExpress (authenticated)**
- Supplier search results for matched product keywords: unit price range, MOQ, supplier rating, ships-from location, estimated shipping cost bracket

**From Google Trends (public)**
- 12-month search interest index for target keywords
- Related rising queries
- Interest-by-region breakdown

**From TikTok Shop (authenticated)**
- Hashtag video count and weekly growth for product-related tags
- Trending product category GMV rank (where publicly visible)

**From Etsy / eBay (public)**
- Listing count per keyword, top listing review counts, price spread, recent listing dates

#### User Data Privacy
- All extracted data is **scoped to the user's own session** — no credentials are stored by OneSell
- Raw extracted data is transmitted over TLS and used only for the analysis session
- Users can review and delete their extraction history at any time
- OneSell never reads, stores, or reuses account credentials

---

### 5.4 LLM Agent Analysis System

Once the client delivers the extracted data payload, an **LLM agent** on the backend takes over. Rather than a fixed scoring formula, the agent reasons dynamically over the data — creating its own sub-tasks, executing them, and synthesizing conclusions.

#### Agent Architecture

The agent follows a **Plan → Execute → Synthesize** loop:

```
┌──────────────────────────────────────────────────────────┐
│                     LLM AGENT LOOP                       │
│                                                          │
│  INPUT: Raw extracted data JSON + User preferences       │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  PLANNER  (LLM — reasoning step)                │    │
│  │  Reads data, identifies what analyses to run,   │    │
│  │  creates an ordered task list                   │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │ Task list                         │
│                      ▼                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  EXECUTOR  (LLM with tool calls)                │    │
│  │  Runs each task using available tools:          │    │
│  │  - calc_margin(price, cogs, fees, shipping)     │    │
│  │  - rank_competition(listing_data)               │    │
│  │  - score_trend(search_index_series)             │    │
│  │  - flag_beginner_risk(product_attributes)       │    │
│  │  - compare_products(product_list)               │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │ Task results                      │
│                      ▼                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  SYNTHESIZER  (LLM — writing step)              │    │
│  │  Produces final ranked shortlist with           │    │
│  │  plain-English recommendation cards             │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  OUTPUT: Ranked product shortlist + recommendation cards │
└──────────────────────────────────────────────────────────┘
```

#### Planner Step — Task Generation

The Planner LLM receives:
- The full structured data payload from the client
- The user's preference wizard answers (budget, platform, category, time)
- **The selected market/region** — used to inject market-specific context into the system prompt (e.g., platform norms, consumer behavior patterns, local logistics cost structures, currency)
- A system prompt defining its role as a product research expert, **localized per market**

It produces a prioritized **task plan** such as:

```
Task Plan — US Market (example):
1. Filter out products whose estimated COGS exceeds user budget of $200
2. Identify products with search growth > 15% YoY on Google Trends (US geo)
3. For each remaining product, calculate estimated gross margin (Amazon FBA fees applied)
4. Rank by competition accessibility (low review count + high sales velocity on Amazon US)
5. Cross-reference with TikTok Shop US trend signals — boost products with viral indicators
6. Apply beginner risk flags (regulatory, fulfillment complexity, MOQ)
7. Select top 10 candidates and write recommendation cards in English

Task Plan — China Market (example):
1. Filter out products whose estimated COGS exceeds user budget of ¥2,000 (1688.com pricing)
2. Identify products trending on Douyin and Xiaohongshu (growth > 20% weekly post volume)
3. For each remaining product, calculate estimated gross margin (Taobao/JD commission rates applied)
4. Rank by competition accessibility (low monthly sales gap between top seller and page-2 sellers on Taobao)
5. Cross-reference with Baidu Index search trend — confirm sustained search interest
6. Apply China-specific risk flags (platform category restrictions, live-stream fulfillment requirements)
7. Select top 10 candidates and write recommendation cards in Simplified Chinese
```

The task plan adapts based on what data was actually collected — if the user didn't connect Alibaba, the margin task uses price-based proxies instead.

#### Executor Step — Tool Calls

The Executor runs each task via deterministic tool functions (not LLM guesses for numbers):

| Tool | Input | Output |
|---|---|---|
| `calc_margin` | sell price, COGS estimate, **market-specific platform fee %**, shipping bracket | Gross margin %, net margin estimate in **local currency** |
| `rank_competition` | listing array (review counts, seller ages, BSR / sales volume), **market** | Competition accessibility score + narrative |
| `score_trend` | Search index series (Google Trends or **Baidu Index** for China), market | Trend direction, seasonality flag, growth % |
| `flag_beginner_risk` | product category, weight, regulatory keywords, **market** | Risk flags array (SAFE / FLAGGED / WARNING) — rules vary by market |
| `compare_products` | scored product list | Ranked comparison table |
| `estimate_cogs` | **1688.com / Alibaba / AliExpress** price range depending on market | COGS range low/high in local currency |
| `get_platform_fees` | platform name, product category, **market** | Fee structure: listing fee, commission %, fulfillment fee if applicable |

These tools are pure functions with no LLM involvement — they ensure **numerical accuracy** while the LLM handles reasoning and language.

#### Synthesizer Step — Output Generation

The Synthesizer LLM receives all task results and writes the final output:
- Ranks products by overall opportunity quality (reasoning holistically, not a fixed formula)
- Writes justification for each product (3–5 bullet points) **in the language of the selected market** (English for US/UK/SEA, Simplified Chinese for China, Japanese for Japan, German for DE/EU)
- Uses **market-native platform names and concepts** (e.g., references "Taobao monthly sales" not "Amazon BSR" for a Chinese user; references "Shopee sold count" for SEA)
- Flags risks relevant to that market (e.g., "This category requires a Tmall flagship store to compete" for China; "Amazon US has a 15% referral fee in this category" for US)
- Adapts tone and vocabulary to a beginner audience — no jargon
- Ensures each justification references the actual data extracted (not generic statements)

#### Beginner Suitability — Agent Reasoning
Rather than hard-coded filters, the agent is instructed to reason about suitability:
- Products requiring regulatory approvals → agent flags and explains why in plain language
- MOQ exceeding budget → agent removes from shortlist and notes "sourcing cost too high for your budget"
- Complex fulfillment → agent flags and suggests simpler alternatives
- Saturated markets → agent explains the entry barrier in concrete terms ("top sellers have 10,000+ reviews; very hard for a new seller to compete")

---

### 5.5 Output: Product Recommendation Cards

The system returns **5–10 Product Recommendation Cards**, ranked by Overall Score.

#### Anatomy of a Recommendation Card

```
┌─────────────────────────────────────────────────────────────┐
│  #1  Portable Blender Bottle                    Score: 87   │
│  Category: Kitchen & Home                                    │
├─────────────────────────────────────────────────────────────┤
│  WHY THIS PRODUCT?                                           │
│  ✅ Demand is growing 34% year-over-year on Google Search   │
│  ✅ Most competing listings have fewer than 150 reviews —   │
│     meaning it's not too late to enter this market          │
│  ✅ You can source for ~$6–9 and list at $24–32 (60% margin)│
│  ✅ Trending on TikTok #healthylifestyle (2.1M posts/week)  │
│  ⚠️  Demand peaks in Jan–Mar; plan inventory accordingly    │
├─────────────────────────────────────────────────────────────┤
│  SCORE BREAKDOWN          QUICK STATS                        │
│  Demand:      ████████ 82   Avg Sell Price:  $27            │
│  Competition: █████████ 88  Est. COGS:       $7             │
│  Margin:      ███████  76   Est. Gross Margin: 58%          │
│  Trend:       ████████ 91   Top Platform:   Amazon          │
├─────────────────────────────────────────────────────────────┤
│  SUGGESTED NEXT STEP                                         │
│  "View 3 suppliers on Alibaba →"   "See how to list this →" │
└─────────────────────────────────────────────────────────────┘
```

#### Card Content Spec

| Field | Description |
|---|---|
| Product Name | Generic product category name (not brand) |
| Overall Score | 0–100 composite score |
| Why This Product | 3–5 plain-English bullet points, no jargon |
| Score Breakdown | Visual bar per dimension |
| Quick Stats | Avg sell price, estimated COGS, gross margin %, top platform |
| Risk Flags | Yellow ⚠️ warnings (seasonal, regulatory, competition spike) |
| Suggested Next Step | CTA linking to sourcing or listing creation workflow |

---

## 6. User Flow

```
[User opens OneSell Scout desktop client]
        │
        ▼
[Preference Wizard — 6 steps, ~2 min]
  Step 1: SELECT YOUR MARKET  ← NEW FIRST STEP
  (🇺🇸 US / 🇨🇳 China / 🇮🇩 SEA / 🇬🇧 UK / 🇩🇪 EU / 🇯🇵 Japan / 🇦🇺 AU)
  Steps 2–6: budget / target platform (market-filtered) / product type / category / time
        │
        ▼
  [UI language switches to match selected market]
  [Platform list in next steps shows only market-relevant platforms]
        │
        ▼
[Data Sources Screen]
  User sees list of supported platforms.
  For each platform they want to use:
    → Click "Connect" → embedded browser panel opens
    → User logs in with their own credentials
    → Green checkmark appears: "Connected ✓"
  User enters keyword/category focus (e.g. "home organization")
  User clicks "Start Extraction"
        │
        ▼
[Extraction Progress Screen]
  Client navigates pages within each authenticated session:
  "Reading Amazon bestsellers in Home & Kitchen... ✓"
  "Reading Alibaba supplier prices... ✓"
  "Reading Google Trends for 12 months... ✓"
  "Reading TikTok trending products... ✓"
  (~1–3 min depending on platforms connected)
        │
        ▼
[Agent Analysis Screen]
  Extracted data sent to LLM agent.
  Live status shown:
  "Agent creating analysis plan..."
  "Calculating margins for 47 products..."
  "Evaluating competition for top candidates..."
  "Writing your product recommendations..."
  (~30–60 sec)
        │
        ▼
[Results Page: Ranked Product Cards (5–10 results)]
        │
    ┌───┴────────────────────────┐
    │                            │
    ▼                            ▼
[Save to My List]        [Re-run with different
    │                     keyword / add more platforms]
    ▼
[Explore Product Detail]
    │
    ▼
[Proceed to Sourcing Module →]   (future module)
[Proceed to Listing Module →]    (future module)
```

---

## 7. Key Screens

### Screen 1: Preference Wizard
- Clean, minimal, step-by-step (6 questions)
- **Step 1 — Market Selection** is a full-screen card with large flag + market name tiles:
  ```
  ┌──────────────────────────────────────────────────────────┐
  │  Which market are you selling in?                        │
  │                                                          │
  │   🇺🇸 United States    🇨🇳 China (Taobao/JD/PDD)        │
  │   🇮🇩 Southeast Asia   🇬🇧 United Kingdom               │
  │   🇩🇪 Germany / EU     🇯🇵 Japan                        │
  │   🇦🇺 Australia                                         │
  │                                                          │
  │  [ This determines which platforms and data sources     │
  │    will be available in the next steps ]                │
  └──────────────────────────────────────────────────────────┘
  ```
- On market selection, UI language switches immediately (e.g., selecting China → UI renders in Simplified Chinese)
- Steps 2–6 auto-populate with market-specific options
- Progress bar at top
- Skip option available (sensible defaults applied)
- Desktop-first (Electron app window), responsive layout

### Screen 2: Data Sources & Connection
- Platform cards displayed are **filtered to the selected market only** — a Chinese user sees Taobao/JD/1688 cards; a US user sees Amazon/eBay/Alibaba cards
- Each card shows: platform name, login status, what data will be extracted
- Embedded browser panel (in-app) slides in when user clicks Connect — authenticates naturally
- Keyword/category input field (user types what they want to research, in local language)
- "What data will be collected?" expandable section per platform for transparency
- "Start Extraction" CTA button (enabled only when ≥ 1 platform connected)

### Screen 3: Extraction Progress
- Per-platform progress rows with animated status, **platform names localized to market**:
  - US example: `Extracting Amazon bestsellers...` → `Done (124 products found) ✓`
  - China example: `正在读取淘宝热销榜单...` → `完成（找到 87 个商品）✓`
  - SEA example: `Extracting Shopee top products...` → `Done (101 products found) ✓`
- User can cancel at any time
- Shows data summary count on completion before proceeding
- "Analyze Now" button becomes active when extraction completes

### Screen 4: Agent Analysis Progress
- Shows live agent reasoning steps as they execute:
  ```
  Planning analysis...                              ✓
  Filtering by budget ($200)...                     ✓  
  Calculating margins for 47 products...            ✓
  Evaluating competition landscape...               ✓  
  Checking trend signals...                         ✓
  Flagging beginner risks...                        ✓
  Writing recommendations...                        ⟳
  ```
- Builds user trust and understanding of how the AI is working
- Non-cancellable once started (fast: ~30–60 sec)

### Screen 5: Results Dashboard
- Ranked product card list (5–10 cards, scrollable)
- Sort/filter bar: sort by Margin / Competition / Trend / Agent Rank
- "How did the AI decide this?" link opens agent reasoning log per product
- Save/bookmark per card
- Export shortlist as PDF or CSV
- "Run new search" button

### Screen 6: Product Detail Drill-Down
- Full data sourced from the user's own extraction session
- Trend graph (12-month Google Trends line chart)
- Competition snapshot: top 5 Amazon listings (name, review count, price, BSR)
- Margin calculator: user can manually adjust sell price, COGS, fees → live margin update
- Raw supplier pricing table (from Alibaba extraction if connected)
- Agent reasoning log: full plain-English explanation of why this product was chosen

---

## 8. Technical Architecture (High-Level)

```
┌──────────────────────────────────────────────────────────────────┐
│                    CLIENT  (Electron Desktop App)                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  UI Layer  (React + Electron renderer)                  │    │
│  │  Wizard · Platform Connect · Progress · Results         │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │  Embedded Browser Engine  (Electron BrowserView)        │    │
│  │  User logs into platforms in-app                        │    │
│  │  DOM extraction scripts injected per platform           │    │
│  │  Session cookies stay LOCAL — never sent to OneSell     │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │  Extraction Manager  (Node.js main process)             │    │
│  │  Orchestrates per-platform extraction scripts           │    │
│  │  Normalizes raw DOM data → structured JSON payload      │    │
│  │  Packages payload with user preferences                 │    │
│  └────────────────────────┬────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTPS (TLS 1.3)
                           │  POST /analysis  {payload: {...}}
┌──────────────────────────▼───────────────────────────────────────┐
│                    BACKEND  (Cloud)                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  API Gateway                                            │    │
│  │  Auth (JWT) · Rate Limiting · Payload Validation        │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │  Agent Service                                          │    │
│  │                                                         │    │
│  │  ┌──────────┐   ┌───────────┐   ┌──────────────────┐   │    │
│  │  │ PLANNER  │ → │ EXECUTOR  │ → │  SYNTHESIZER     │   │    │
│  │  │  (LLM)   │   │ (LLM +    │   │  (LLM)           │   │    │
│  │  │          │   │  Tools)   │   │  Writes cards    │   │    │
│  │  └──────────┘   └─────┬─────┘   └──────────────────┘   │    │
│  │                       │                                  │    │
│  │              ┌────────▼──────────┐                      │    │
│  │              │  Tool Functions   │                      │    │
│  │              │  calc_margin      │                      │    │
│  │              │  rank_competition │                      │    │
│  │              │  score_trend      │                      │    │
│  │              │  flag_risk        │                      │    │
│  │              │  compare_products │                      │    │
│  │              └───────────────────┘                      │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │  User Service                                           │    │
│  │  Account · Preferences · Saved Lists · Session History  │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │  Data Layer                                             │    │
│  │  PostgreSQL — User data, saved lists, session history   │    │
│  │  Redis      — Active analysis session state (TTL 1h)    │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

LLM Provider: OpenAI GPT-4o (or equivalent) via server-side API key
  — API key never exposed to client
  — All LLM calls made from Agent Service only
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Client type | Electron desktop app | DOM extraction requires running inside an authenticated browser context; PWA/mobile cannot reliably do this |
| Browser engine | Electron BrowserView (Chromium) | Full browser rendering; no headless detection issues since user is genuinely present |
| Credentials handling | Stay in client only | Session cookies and login state **never leave the user's machine**; extraction scripts read DOM, not credentials |
| LLM provider | Server-side only (API Gateway → Agent Service) | API keys never in client; all LLM calls proxied through backend |
| Analysis state | Redis with 1h TTL | Analysis sessions are ephemeral; no long-term storage of raw extracted data |
| Extraction scripts | Per-platform, versioned | Each platform (Amazon, Alibaba, etc.) has its own extraction module; easy to update independently when site structures change |

---

## 9. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Extraction time (all platforms) | < 3 minutes per analysis session |
| Agent analysis response time | < 90 seconds from payload receipt to results |
| Client app startup time | < 5 seconds |
| Backend availability | 99.5% uptime SLA |
| Platform | Windows 10+ and macOS 12+ (Electron); Linux stretch goal |
| Localization | UI language and all output text follow selected market; Chinese market fully rendered in Simplified Chinese |
| Market switching | Switching market after wizard resets platform connections and clears prior extraction data |
| Security — credentials | Session cookies never transmitted to OneSell servers |
| Security — LLM calls | All OpenAI/LLM API calls made server-side only; no API key in client binary |
| Security — payload transit | TLS 1.3 for all client-to-backend communication |
| Security — data retention | Raw extracted data purged from backend within 1 hour of session end |
| Accessibility | Keyboard-navigable UI; WCAG 2.1 AA for results and wizard screens |
| Extraction script resilience | Graceful degradation if a platform changes its DOM (error message, not crash) |

---

## 10. Monetization Model

| Tier | Price | Access |
|---|---|---|
| Free | $0/mo | 1 analysis per week, top 3 results only, no detail drill-down |
| Starter | $9/mo | 5 analyses per week, full 10 results, basic drill-down |
| Pro | $29/mo | Unlimited analyses, full drill-down, margin calculator, supplier links, export to CSV |
| Business | $79/mo | Everything in Pro + API access + team sharing + custom category tracking |

---

## 11. Out of Scope (v1)

- Automated product ordering or supplier connection (Phase 2)
- Listing creation or copywriting (Phase 2)
- Ad campaign recommendations (Phase 3)
- Custom branded store setup (Phase 3)
- Cross-market arbitrage analysis (selling a Chinese-sourced product on Amazon US) — Phase 2
- Traditional Chinese / full i18n beyond the 7 launch markets (post-launch)
- Middle East, Latin America, Africa markets (Phase 3)

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Platform site structure changes break extraction scripts | High | High | Versioned extraction modules; automated detection of extraction failures + fast patch pipeline; graceful fallback message to user |
| Chinese platform extraction rate-limited (Taobao/JD/PDD anti-automation measures) | High | High | Extraction runs inside the user's real authenticated session — not a bot; mitigate with human-like navigation delays and graceful retry logic; test on real accounts before launch |
| LLM produces inaccurate numerical claims (hallucination) | Medium | High | All numbers (margin, review counts, prices) come from deterministic tool functions, not LLM text generation; LLM only writes reasoning around verified numbers |
| Users find the client install friction too high | Medium | High | Streamlined installer (one-click .exe/.dmg); consider browser extension variant as v1.5 alternative |
| Desktop-only excludes mobile-first users | Medium | Medium | v1 desktop only; plan browser extension for v2 to broaden reach |
| LLM API costs at scale | Medium | Medium | Aggressive prompt optimization; cache agent outputs for identical payloads; monitor cost per analysis |
| Recommendation quality perceived as generic | Medium | High | Agent prompt engineering with strong personalization based on preference wizard; thumbs up/down feedback loop to improve prompts |
| User confusion about what data is being extracted | Low | High | Explicit "what will be collected" disclosure per platform; extraction log visible to user; easy opt-out per platform |

---

## 13. Open Questions

1. **Electron vs. Browser Extension**: Electron gives full DOM access but requires a desktop install. A browser extension is lighter but has more restricted access to cross-origin pages and session state. Should v1 be Electron only, or pursue extension as an alternative?
2. **LLM model selection**: GPT-4o offers best reasoning quality but higher cost (~$0.01–0.03 per analysis). Chinese market output requires a model with strong Simplified Chinese capability — confirm GPT-4o quality vs. a Chinese-native model (e.g., Qwen, DeepSeek) for the China market. At what user volume does cost optimization become a priority?
3. **Extraction script maintenance**: Platform DOM structures change frequently — especially on Chinese platforms (Taobao, JD, PDD update very regularly). Should we build an internal monitoring system for extraction failures, or rely on user error reports? What's the acceptable SLA per market?
4. **Market launch priority**: Which market should be v1 launch focus — US (larger addressable market, more stable platforms) or China (huge seller population, potentially faster growth, but harder extraction)? Recommendation: launch US first, add China in v1.1.
5. **China-specific LLM prompts**: Should China market system prompts reference Chinese e-commerce concepts natively (直播带货, 类目坑产, 爆款 etc.) for better reasoning quality? Requires a subject-matter expert to author and validate.
6. **Feedback loop**: How do we capture whether users actually sold a recommended product successfully? Consider an optional 30-day follow-up prompt, localized per market.
7. **Prompt versioning**: The agent's system prompt is a core product asset, with separate prompt variants per market. What's the process for testing, versioning, and rolling back market-specific prompt changes in production?

---

## 14. Appendix: Competitive Landscape

| Tool | What it does | Why OneSell Scout is different |
|---|---|---|
| Jungle Scout | Amazon-specific product research for experienced sellers | Complex UI; requires Amazon knowledge; expensive ($49+/mo) |
| Helium 10 | Advanced Amazon seller suite | Overwhelming for beginners; no guided workflow |
| Exploding Topics | Trend discovery only | No margin/competition/sourcing analysis; no e-commerce workflow |
| Google Trends | Demand signal only | Raw data; no interpretation; no product recommendations |
| Sell The Trend | Dropshipping product finder | Dropship-only; no multi-platform; no beginner guidance |
| **OneSell Scout** | **End-to-end guided product selection for beginners** | **Plain-language reasoning, beginner-first UX, multi-platform, all signals unified** |

---

*Next Steps: Validate with 10 target users (Persona A/B interviews) → Prioritize top 3 open questions → Technical spike on data ingestion costs → UI prototype (Figma) by end of Sprint 2*
