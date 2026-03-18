import { BrowserView, BrowserWindow, session } from 'electron';
import type { RawPlatformData } from '../../shared/types/ExtractionScript.js';
import { registry } from './ExtractionScriptRegistry.js';
import { MARKET_CONFIGS } from '../../renderer/config/markets.js';

/** Bounds rectangle for attaching a BrowserView to a region. */
export interface ViewBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Callback for emitting pipeline/progress IPC events. */
export interface ExtractionEventEmitter {
  pipelineUpdate(platformId: string, update: Record<string, unknown>): void;
  progressEvent(platformId: string, message: string, field?: string): void;
}

/** Callback for per-field progress events from extraction scripts (E-19, #273). */
export interface ExtractionProgressCallback {
  (event: { field: string; value?: string; status: 'done' | 'in-progress' | 'pending' }): void;
}

/** URL patterns indicating a login/auth page (E-21, #275). */
const LOGIN_URL_PATTERNS = ['login', 'signin', 'sign-in', 'auth', 'passport', 'sign_in'];

/** Platforms that require user authentication before extraction. */
const AUTH_REQUIRED_PLATFORMS: ReadonlySet<string> = new Set([
  'amazon-us', 'amazon-uk', 'amazon-de', 'amazon-jp', 'amazon-au',
  'ebay-us', 'ebay-uk', 'ebay-de', 'ebay-au',
  'etsy', 'otto', 'catch',
  'taobao', 'jd', 'pinduoduo', 'douyin-shop',
  'shopee', 'tokopedia', 'lazada',
  'rakuten', 'mercari-jp',
]);

/**
 * ExtractionManager — manages BrowserView lifecycle per platform.
 *
 * Each platform gets one persistent BrowserView with its own isolated session
 * (persist:platformId partition) so cookies/credentials never leave the client (P1).
 * ExtractionManager does not know platform internals — it delegates to registry (P6).
 * Graceful degradation: extractFromView returns null for unrecognized pages (P5).
 *
 * v2 additions (E-13, #249):
 * - attachToRegion(platformId, bounds): positions BrowserView within given bounds
 * - startAutonomousExtraction(marketId, emitter): orchestrates extraction sequence
 */
export class ExtractionManager {
  private views = new Map<string, BrowserView>();
  private regionBounds = new Map<string, ViewBounds>();
  /** Active did-navigate listeners for login detection (E-21, #275). */
  private loginListeners = new Map<string, (...args: unknown[]) => void>();

  constructor(private mainWindow: BrowserWindow) {}

  /** Create (or reuse) an isolated BrowserView for a platform and show it. */
  openView(platformId: string): void {
    console.log('[ExtractionManager] openView called for:', platformId);
    let view = this.views.get(platformId);
    if (!view) {
      console.log('[ExtractionManager] Creating new BrowserView for:', platformId);
      view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // sandbox: false required for executeJavaScript to work in BrowserView (P9 note)
          sandbox: false,
          session: session.fromPartition(`persist:${platformId}`, { cache: true }),
        },
      });
      this.views.set(platformId, view);

      // Navigate to the platform's home/login page on first open
      const script = registry.get(platformId);
      console.log('[ExtractionManager] Script found for', platformId, ':', script ? `homeUrl=${script.homeUrl}` : 'NOT FOUND in registry');
      if (script?.homeUrl) {
        console.log('[ExtractionManager] Loading URL:', script.homeUrl);
        void view.webContents.loadURL(script.homeUrl);
      }
    } else {
      console.log('[ExtractionManager] Reusing existing BrowserView for:', platformId);
    }
    this.mainWindow.addBrowserView(view);
    this.sizeView(view);
    console.log('[ExtractionManager] BrowserView added to main window for:', platformId);
  }

  /** Hide the BrowserView while keeping the session (cookies) alive. */
  hideView(platformId: string): void {
    const view = this.views.get(platformId);
    if (view) {
      this.mainWindow.removeBrowserView(view);
    }
  }

  /** Close and fully destroy the BrowserView, resetting its session. */
  closeView(platformId: string): void {
    const view = this.views.get(platformId);
    if (view) {
      this.mainWindow.removeBrowserView(view);
      // @ts-expect-error — destroy() exists at runtime but is not in Electron typedefs
      view.webContents.destroy();
      this.views.delete(platformId);
    }
  }

  /**
   * Run the registered ExtractionScript against the current page of the view.
   * Returns null (does NOT throw) if the page is unrecognized (P5 graceful degradation).
   * @param onProgress — Optional callback for per-field progress events (E-19, #273).
   */
  async extractFromView(
    platformId: string,
    onProgress?: ExtractionProgressCallback,
  ): Promise<RawPlatformData | null> {
    const view = this.views.get(platformId);
    const script = registry.get(platformId);

    if (!view) {
      console.error(`[ExtractionManager] extractFromView(${platformId}): no BrowserView found`);
      return null;
    }
    if (!script) {
      console.error(`[ExtractionManager] extractFromView(${platformId}): no script registered`);
      console.log('[ExtractionManager] Registered scripts:', [...registry.getAll().map(s => s.platformId)]);
      return null;
    }

    const url = view.webContents.getURL();
    console.log(`[ExtractionManager] extractFromView(${platformId}): page URL = ${url}`);

    // Serialize extractFromPage to run in the page context
    const extractFnSrc = script.extractFromPage.toString();
    const js = `
      (() => {
        const extractFromPage = ${extractFnSrc};
        try {
          const result = extractFromPage(document, ${JSON.stringify(url)});
          if (result === null || result === undefined) {
            return JSON.stringify({ __debug_null: true, reason: 'extractFromPage returned null/undefined' });
          }
          return JSON.stringify({ __debug_null: false, payload: result });
        } catch (e) {
          return JSON.stringify({ __debug_null: true, reason: 'extractFromPage threw: ' + (e && e.message ? e.message : String(e)), stack: e && e.stack ? e.stack : '' });
        }
      })()
    `;

    try {
      const raw: string | null = await view.webContents.executeJavaScript(js);
      console.log(`[ExtractionManager] executeJavaScript raw result (first 500 chars):`, raw?.slice(0, 500));

      if (raw === null || raw === undefined) {
        console.error(`[ExtractionManager] extractFromView(${platformId}): executeJavaScript returned null/undefined`);
        return null;
      }

      const wrapper = JSON.parse(raw);

      if (wrapper.__debug_null) {
        console.error(`[ExtractionManager] extractFromView(${platformId}): extraction returned null — ${wrapper.reason}`);
        if (wrapper.stack) console.error(`[ExtractionManager] stack:`, wrapper.stack);
        return null;
      }

      const result = wrapper.payload as RawPlatformData;
      const dataKeys = result.data ? Object.keys(result.data) : [];
      const listingCount = Array.isArray((result.data as Record<string, unknown>)['listings'])
        ? ((result.data as Record<string, unknown>)['listings'] as unknown[]).length
        : 'N/A';
      console.log(`[ExtractionManager] extractFromView(${platformId}): SUCCESS — dataKeys=[${dataKeys}], listings=${listingCount}`);
      return result;
    } catch (err) {
      console.error(`[ExtractionManager] extractFromView(${platformId}): executeJavaScript FAILED:`, err);
      return null;
    }
  }

  /** Return the current URL loaded in the view (or empty string if view not found). */
  getCurrentUrl(platformId: string): string {
    const view = this.views.get(platformId);
    return view ? view.webContents.getURL() : '';
  }

  /** Check whether a BrowserView exists for the given platform. */
  hasView(platformId: string): boolean {
    return this.views.has(platformId);
  }

  /** Return the list of platformIds that currently have an open BrowserView. */
  getOpenPlatforms(): string[] {
    return Array.from(this.views.keys());
  }

  /** Hide all open BrowserViews (removes from window, keeps sessions alive). */
  hideAll(): void {
    for (const [, view] of this.views) {
      this.mainWindow.removeBrowserView(view);
    }
  }

  /** Destroy all BrowserViews — call on main window close. */
  destroyAll(): void {
    for (const [platformId] of this.views) {
      this.closeView(platformId);
    }
  }

  /**
   * Position BrowserView within given bounds (for tab panel area).
   * v2 (E-13): replaces full-window overlay with region-specific positioning.
   */
  attachToRegion(platformId: string, bounds: ViewBounds): void {
    this.regionBounds.set(platformId, bounds);
    const view = this.views.get(platformId);
    if (view) {
      view.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.w),
        height: Math.round(bounds.h),
      });
    }
  }

  /**
   * Orchestrate autonomous extraction for all platforms in a market.
   * v2 (E-13): public-first, queue auth-required, sequential execution.
   * Emits pipeline-update and progress-event IPC events via the provided emitter.
   * Handles partial failures gracefully — one platform error doesn't stop others (P5).
   */
  async startAutonomousExtraction(
    marketId: string,
    emitter: ExtractionEventEmitter,
  ): Promise<Map<string, RawPlatformData | null>> {
    const config = MARKET_CONFIGS[marketId];
    if (!config) {
      console.error(`[ExtractionManager] Unknown market: ${marketId}`);
      return new Map();
    }

    const platforms = config.platforms;
    const results = new Map<string, RawPlatformData | null>();

    // Separate public and auth-required platforms
    const publicPlatforms = platforms.filter((p) => !AUTH_REQUIRED_PLATFORMS.has(p));
    const authPlatforms = platforms.filter((p) => AUTH_REQUIRED_PLATFORMS.has(p));

    // Queue auth-required platforms as needs-login
    for (const platformId of authPlatforms) {
      emitter.pipelineUpdate(platformId, { status: 'needs-login' });
    }

    // Run public platforms sequentially (avoids resource contention)
    for (const platformId of publicPlatforms) {
      emitter.pipelineUpdate(platformId, { status: 'active' });
      emitter.progressEvent(platformId, `Starting extraction for ${platformId}`);

      try {
        this.openView(platformId);

        // Wait for page load
        const view = this.views.get(platformId);
        if (view) {
          await new Promise<void>((resolve) => {
            const onFinish = (): void => { resolve(); };
            view.webContents.once('did-finish-load', onFinish);
            // Timeout: don't wait forever
            setTimeout(() => {
              view.webContents.removeListener('did-finish-load', onFinish);
              resolve();
            }, 15_000);
          });
        }

        emitter.progressEvent(platformId, 'Page loaded, extracting data...', 'page-load');

        // E-19 (#273): Wire onProgress callback to forward events via IPC
        const onProgress: ExtractionProgressCallback = (event) => {
          emitter.progressEvent(platformId, `${event.field}: ${event.value ?? event.status}`, event.field);
        };

        const data = await this.extractFromView(platformId, onProgress);
        results.set(platformId, data);

        if (data) {
          const listings = Array.isArray((data.data as Record<string, unknown>)['listings'])
            ? ((data.data as Record<string, unknown>)['listings'] as unknown[]).length
            : 0;
          emitter.pipelineUpdate(platformId, {
            status: 'done',
            productCount: listings,
            doneLabel: `Scanned ${platformId}`,
          });
          emitter.progressEvent(platformId, `Extraction complete — ${listings} products found`, 'complete');
        } else {
          emitter.pipelineUpdate(platformId, { status: 'done', productCount: 0, doneLabel: `Scanned ${platformId}` });
          emitter.progressEvent(platformId, 'Extraction returned no data', 'complete');
        }
      } catch (err) {
        // P5: Graceful degradation — log error, mark platform as failed, continue
        console.error(`[ExtractionManager] Extraction error for ${platformId}:`, err);
        results.set(platformId, null);
        emitter.pipelineUpdate(platformId, { status: 'error' });
        emitter.progressEvent(platformId, `Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }

      this.hideView(platformId);
    }

    // Auth-required platforms remain in needs-login until user authenticates
    // (E-21, #275): Watch for login/post-login URL changes
    for (const platformId of authPlatforms) {
      this.openView(platformId);
      this.watchForLogin(platformId, emitter);
      this.hideView(platformId);
      results.set(platformId, null);
    }

    return results;
  }

  /** Size the view to the bottom half of the main window. */
  private sizeView(view: BrowserView): void {
    const bounds = this.mainWindow.getContentBounds();
    const halfHeight = Math.floor(bounds.height / 2);
    view.setBounds({
      x: 0,
      y: halfHeight,
      width: bounds.width,
      height: halfHeight,
    });
  }

  /**
   * Check whether a URL matches login/auth page patterns (E-21, #275).
   * PRD §5.5: Simple URL heuristic for auto-login detection.
   */
  private isLoginUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return LOGIN_URL_PATTERNS.some((pattern) => lower.includes(pattern));
  }

  /**
   * Attach a did-navigate listener for login detection on a platform (E-21, #275).
   * When the view navigates to a login URL → sets needs-login status.
   * When the view navigates away from a login URL → sets queued status.
   */
  watchForLogin(platformId: string, emitter: ExtractionEventEmitter): void {
    const view = this.views.get(platformId);
    if (!view) return;

    // Remove any existing listener for this platform
    this.unwatchLogin(platformId);

    let wasLoginPage = this.isLoginUrl(view.webContents.getURL());

    const listener = (_event: unknown, url: string): void => {
      const isLogin = this.isLoginUrl(url);
      if (isLogin && !wasLoginPage) {
        emitter.pipelineUpdate(platformId, { status: 'needs-login' });
      } else if (!isLogin && wasLoginPage) {
        emitter.pipelineUpdate(platformId, { status: 'queued' });
      }
      wasLoginPage = isLogin;
    };

    view.webContents.on('did-navigate', listener as (...args: unknown[]) => void);
    view.webContents.on('did-navigate-in-page', listener as (...args: unknown[]) => void);
    this.loginListeners.set(platformId, listener as (...args: unknown[]) => void);
  }

  /** Remove login detection listener for a platform (E-21, #275). */
  unwatchLogin(platformId: string): void {
    const view = this.views.get(platformId);
    const listener = this.loginListeners.get(platformId);
    if (view && listener) {
      view.webContents.removeListener('did-navigate', listener);
      view.webContents.removeListener('did-navigate-in-page', listener);
    }
    this.loginListeners.delete(platformId);
  }
}
