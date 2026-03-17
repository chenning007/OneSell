# ADR-004: China Platform Anti-Automation Mitigations (Taobao/JD/PDD)

**Status**: Proposed
**Date**: 2026-03-17
**Author**: Architect
**Linked Issue**: #47

---

## Context

OneSell Scout's China market (`marketId: 'cn'`) targets 8 platforms:

| Platform | Auth | Anti-Automation Profile |
|---|---|---|
| **Taobao/Tmall** | Required | Slider CAPTCHA (滑块验证), TLS fingerprinting, request cadence analysis, WebDriver detection (`navigator.webdriver`), Canvas/WebGL fingerprinting |
| **JD.com** | Required | Risk-control engine (京东风控), device fingerprinting, mouse-movement behavioral analysis, IP reputation scoring |
| **Pinduoduo** | Required | Aggressive anti-bot (拼多多反爬), slider verification, IP-based throttling, short session windows, DOM obfuscation |
| **1688.com** | Optional | Shares Alibaba infra — same slider CAPTCHA as Taobao (less aggressive for logged-in users) |
| **Douyin Shop** | Optional | Rate limiting on API endpoints, device-ID tracking, WebSocket heartbeat monitoring |
| **Xiaohongshu** | Optional | API signature verification, request-interval analysis, user-agent validation |
| **Kuaishou Shop** | Optional | Token-based API gating, session expiry, behavioral fingerprint |
| **Baidu Index** | Public | Minimal — standard rate limiting on public endpoints |

Chinese platforms are significantly more aggressive than Western platforms in detecting automated browsing. Their anti-automation systems analyze:

1. **Navigation cadence** — uniform timing between page loads is a red flag
2. **DOM interaction patterns** — headless browsers lack mouse movement, scrolling, focus events
3. **Browser fingerprint** — WebDriver flag, missing plugins, Canvas hash anomalies
4. **Request concurrency** — multiple simultaneous requests from one session

However, OneSell Scout has a critical architectural advantage: **extraction runs inside a real Electron BrowserView where the user has genuinely logged in with their own credentials**. The user navigated to the page themselves. We are not a headless scraper — we are reading DOM elements visible on the user's screen.

### Constraints

- **P1 (Privacy-First)**: No credentials leave the client. No credential storage.
- **P5 (Graceful Degradation)**: Extraction must handle failures without crashing.
- **P6 (Isolated Plugins)**: Each platform's mitigation logic is self-contained in its extraction script.
- **P8 (Config Over Hardcoding)**: Delay ranges, retry limits, and detection patterns are configurable.
- **P9 (Security by Default)**: No evasion techniques. No fingerprint spoofing. No ToS violations.

---

## Decision

**OneSell Scout does NOT bypass, circumvent, or spoof anti-automation systems.** We operate as a normal user browsing pages in a real browser. Extraction is passive — reading DOM elements already rendered for the logged-in user.

Our mitigation strategy is defensive, not evasive:

1. **Human-like pacing** — random delays between navigation actions
2. **Sequential-only extraction** — never parallel requests to the same platform
3. **CAPTCHA detection + graceful exit** — detect, notify user, return `null`
4. **Single retry with backoff** — max 1 retry after a longer delay, then fail gracefully
5. **No fingerprint manipulation** — we do not modify `navigator.webdriver`, Canvas, WebGL, or any browser APIs
6. **ToS compliance posture** — we read publicly visible DOM content from an authenticated session; we do not forge requests, intercept APIs, or replay cookies

---

## Options Considered

| Option | Pros | Cons |
|---|---|---|
| **A — Defensive pacing + graceful degradation (chosen)** | ToS-compliant, low detection risk (real browser + real user), simple implementation, aligns with P1/P5/P9 | Slower extraction (2–5s delays per page), fails on CAPTCHA (user must solve manually) |
| **B — Headless browser with fingerprint spoofing** | Faster, no user interaction needed | Violates P1 (needs stored credentials), violates P9 (active evasion), high detection risk on Chinese platforms, legal/ToS risk |
| **C — API interception (intercept XHR/fetch responses)** | Fast, structured data | Violates ToS, signature verification will block forged requests, fragile against API changes, potential legal exposure in China |
| **D — Third-party scraping service** | Offloads complexity | Violates P1 (credentials leave machine), violates P2 (data collection on backend), cost per query, single point of failure |

---

## Implementation Guidelines for Dev

### 1. `humanDelay()` Utility Function

Every China extraction script MUST use this utility between navigation actions. It lives in a shared module imported by all CN platform scripts.

```typescript
// onesell-client/src/main/extraction/scripts/_shared/delays.ts

export interface DelayConfig {
  readonly minMs: number;
  readonly maxMs: number;
}

/** Platform-specific default delay configurations (P8 — config over hardcoding) */
export const PLATFORM_DELAYS: Record<string, DelayConfig> = {
  'taobao':      { minMs: 2500, maxMs: 5000 },
  'jd':          { minMs: 2000, maxMs: 4500 },
  'pinduoduo':   { minMs: 3000, maxMs: 6000 },  // PDD is most aggressive
  '1688':        { minMs: 2000, maxMs: 4000 },
  'douyin-shop': { minMs: 1500, maxMs: 3500 },
  'xiaohongshu': { minMs: 1500, maxMs: 3500 },
  'kuaishou':    { minMs: 1500, maxMs: 3500 },
  'baidu-index': { minMs: 1000, maxMs: 2000 },   // Public, minimal risk
};

/**
 * Random delay between minMs and maxMs (inclusive).
 * Uses crypto.getRandomValues for uniform distribution — not Math.random().
 * Called between page navigations, NOT inside extractFromPage() (which is sync/DOM-only).
 */
export function humanDelay(config: DelayConfig): Promise<void> {
  const range = config.maxMs - config.minMs;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const delay = config.minMs + (array[0] % (range + 1));
  return new Promise((resolve) => setTimeout(resolve, delay));
}
```

**Usage** — in ExtractionManager or the extraction runner, between `getNavigationTargets()` page loads:

```typescript
const delayConfig = PLATFORM_DELAYS[script.platformId] ?? { minMs: 2000, maxMs: 4000 };
for (const url of urls) {
  await humanDelay(delayConfig);
  await view.webContents.loadURL(url);
  // ... extract after page load
}
```

### 2. CAPTCHA Detection Patterns

Each China extraction script MUST check for CAPTCHA or risk-control interstitials before attempting extraction. Detection runs inside `extractFromPage()` — if a CAPTCHA is detected, return `null` immediately.

```typescript
// CAPTCHA detection selectors per platform — used inside extractFromPage()

const CAPTCHA_PATTERNS = {
  taobao: [
    '#nocaptcha',                          // Alibaba slider CAPTCHA container
    '.nc-container',                       // NoCaptcha slider
    '#baxia-dialog',                       // Baxia risk control dialog
    '.login-error',                        // Login verification page
    '[class*="slider-verify"]',            // Generic slider verify
    'iframe[src*="captcha"]',              // Embedded CAPTCHA iframe
  ],
  jd: [
    '#JDJRV-wrap-loginsubmit',             // JD verification dialog
    '.verify-wrap',                        // JD slider verification
    '#slider_verify',                      // Slider container
    '.risk-control',                       // Risk control interstitial
    '[class*="jd-verify"]',                // Generic JD verify
  ],
  pinduoduo: [
    '.verification-wrapper',               // PDD verification overlay
    '#captcha-container',                  // CAPTCHA container
    '.slider-verify-panel',                // Slider panel
    '[class*="anti-content"]',             // Anti-bot content gate
    '.risk-verify',                        // Risk verification
  ],
  '1688': [
    '#nocaptcha',                          // Same Alibaba CAPTCHA infra as Taobao
    '.nc-container',
    '#baxia-dialog',
  ],
};

// Inside extractFromPage():
function isCaptchaPresent(document: Document, patterns: string[]): boolean {
  return patterns.some((selector) => document.querySelector(selector) !== null);
}
```

### 3. Error Categorization

All extraction failures MUST be categorized for the progress UI and telemetry. Define a standard error type:

```typescript
// onesell-client/src/shared/types/ExtractionError.ts

export type ExtractionErrorCategory =
  | 'captcha'       // CAPTCHA or risk-control interstitial detected
  | 'rate-limit'    // HTTP 429, or platform-specific rate-limit page
  | 'dom-change'    // Expected DOM selectors not found (script needs update)
  | 'network'       // Timeout, DNS failure, connection reset
  | 'auth-expired'  // Session expired, login required
  | 'unknown';      // Unclassified failure

export interface ExtractionError {
  readonly platformId: string;
  readonly category: ExtractionErrorCategory;
  readonly message: string;
  readonly url: string;
  readonly timestamp: string;  // ISO 8601
}
```

**Mapping rules for China platforms:**

| Signal | Category |
|---|---|
| CAPTCHA selector present in DOM | `captcha` |
| HTTP 429 or "频繁" / "频率" (too frequent) in page text | `rate-limit` |
| Expected listing container missing, page otherwise loaded | `dom-change` |
| Network timeout or `ERR_CONNECTION_RESET` | `network` |
| Redirect to login page when previously authenticated | `auth-expired` |
| Everything else | `unknown` |

### 4. Retry Policy

```
Attempt 1:  Execute extraction
  ↓ failure?
Wait:       humanDelay(config) × 2  (double the normal inter-page delay)
  ↓
Attempt 2:  Retry extraction (same URL)
  ↓ failure?
STOP:       Return null + ExtractionError to caller
```

**Rules:**
- Max **1 retry** (total 2 attempts) per URL
- Retry delay is **2× the platform's configured humanDelay range** (e.g., Taobao: 5–10s on retry)
- **No retry on `captcha`** — user must solve manually; emit a notification via IPC
- **No retry on `auth-expired`** — user must re-authenticate; redirect BrowserView to `homeUrl`
- Retry on `rate-limit`, `dom-change`, `network`, `unknown`

### 5. Sequential Extraction (No Concurrency)

The extraction runner (`useExtractionRunner.ts`) already iterates platforms sequentially. For China platforms, an additional constraint applies:

> **Within a single platform's extraction, navigation targets MUST be visited sequentially with `humanDelay()` between each. No `Promise.all()` or concurrent page loads.**

This is architecturally enforced because each platform has exactly one BrowserView (managed by `ExtractionManager`), making parallel requests physically impossible at the BrowserView level. The `humanDelay()` between pages is the additional defensive measure.

### 6. Rate-Limit Page Detection (Chinese Text Patterns)

Some platforms show a rate-limit page instead of returning HTTP 429. Detection requires scanning visible text:

```typescript
// Chinese-language rate-limit indicators — check document.body.innerText
const RATE_LIMIT_TEXT_PATTERNS = [
  '操作过于频繁',     // "Operations too frequent"
  '请稍后再试',       // "Please try again later"
  '访问频率过高',     // "Visit frequency too high"
  '系统繁忙',         // "System busy"
  '请求过多',         // "Too many requests"
  '稍后重试',         // "Retry later"
  '网络异常',         // "Network abnormal" (often used for rate limits)
];

function isRateLimitPage(document: Document): boolean {
  const text = document.body?.innerText ?? '';
  return RATE_LIMIT_TEXT_PATTERNS.some((pattern) => text.includes(pattern));
}
```

### 7. User Notification on CAPTCHA

When a CAPTCHA is detected, the extraction script returns `null` and the ExtractionManager MUST notify the user via IPC so the progress UI can display an actionable message:

```
Platform: 淘宝 (Taobao)
Status: ⚠️ Verification required
Action: Please switch to the Taobao browser tab and complete the slider verification, then retry extraction.
```

The progress UI shows a "Retry" button per platform. The user solves the CAPTCHA in the BrowserView, then clicks Retry to re-run extraction for that platform only.

### 8. Platform-Specific Notes

#### Taobao/Tmall
- Most common trigger: > 3 search pages within 30 seconds
- Slider CAPTCHA (nocaptcha) is Alibaba's unified verification — same on 1688
- Logged-in users with purchase history have higher trust scores → less frequent CAPTCHAs
- `extractFromPage` must check for `#nocaptcha` BEFORE any DOM extraction

#### JD.com
- Risk control escalates on price-comparison-like behaviour (rapid product page visits)
- Device fingerprint is session-persistent — our BrowserView maintains this naturally
- JD occasionally redirects to a "verify-human" page — detect via URL pattern `/risk/`

#### Pinduoduo
- Most aggressive anti-bot among the three
- DOM is heavily obfuscated (class names are hashed, change between deployments)
- Extraction selectors must use stable structural patterns (`nth-child`, `data-*` attributes) rather than class names
- Recommended: extract from search results page only (listing pages change too frequently)

#### 1688.com
- Shares Alibaba anti-bot infra with Taobao but is less strict for logged-in suppliers
- Wholesale price and MOQ are visible on search result cards — prefer search-page extraction

#### Douyin/Xiaohongshu/Kuaishou
- Social commerce platforms have lighter anti-bot on web (they focus anti-bot on mobile APIs)
- Web versions are limited — extraction scope is narrower (trending, not full product data)
- Rate limits are per-session, not per-IP — maintaining the BrowserView session is sufficient

#### Baidu Index
- Public data, minimal anti-bot
- Standard rate limiting (< 1 req/sec is safe)
- No CAPTCHA unless massive volume

---

## Consequences

### What Becomes Easier
- **ToS compliance** — We are not bypassing anything. If challenged, our posture is defensible: real user, real browser, reading visible content.
- **Maintenance** — No fragile evasion code to maintain as platforms update their anti-bot systems.
- **User trust** — Users see exactly what the app is doing (BrowserView is visible). No hidden automation.
- **P5 alignment** — Graceful degradation is built into the design. A CAPTCHA on one platform doesn't crash the session.

### What Becomes Harder
- **Extraction speed** — China platform extraction is 2–6× slower than Western platforms due to mandatory delays.
- **User effort** — Users may need to solve CAPTCHAs manually on high-risk platforms (Taobao, PDD).
- **Coverage reliability** — On aggressive days (e.g., 618, Double 11 sales events), platforms may tighten controls, causing more `null` returns.

### Architectural Constraints Imposed
1. **No `Promise.all()` for page navigation** within a single platform's extraction sequence.
2. **Every CN extraction script** must import and use `humanDelay()` from `_shared/delays.ts`.
3. **Every CN extraction script** must check CAPTCHA patterns as the first operation in `extractFromPage()`.
4. **ExtractionManager** must support a per-platform IPC notification for CAPTCHA events.
5. **Progress UI** must render per-platform retry buttons and CAPTCHA guidance in zh-CN.
6. **`ExtractionError`** type must be added to shared types and used by all extraction scripts.

---

## Compliance

### How We Verify This Decision Is Followed

| Check | Method | Owner |
|---|---|---|
| `humanDelay()` called between page navigations | Code review: every CN extraction script PR | Architect |
| No `Promise.all` on navigation URLs | Lint rule or code review | Dev + Architect |
| CAPTCHA detection in every CN `extractFromPage()` | Unit test: mock DOM with CAPTCHA selector → assert `null` | Tester |
| Retry policy: max 1 retry, no retry on `captcha` | Unit test: mock failure sequence → assert 2 attempts max | Tester |
| No fingerprint spoofing code | `grep -r "navigator.webdriver\|Object.defineProperty.*navigator" --include="*.ts"` returns 0 results in client source | CI + Tester |
| Error categorization used | All CN extraction errors carry `ExtractionErrorCategory` | Code review |
| Delay configs are in `PLATFORM_DELAYS` constant, not hardcoded in scripts | Code review + integration test | Dev + Tester |

### What Breaks If This ADR Is Violated

- **Fingerprint spoofing** → Platform bans user's real account (not just our tool — their personal shopping account)
- **Removing delays** → Rapid CAPTCHA triggers → extraction success rate drops to ~0%
- **Parallel navigation** → Immediate rate-limiting or session termination
- **Ignoring CAPTCHA detection** → Script attempts extraction on CAPTCHA page → garbage data in `AnalysisPayload`
- **Hardcoded delays** → Can't tune per-platform without code changes (violates P8)
