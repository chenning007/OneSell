import { BrowserView, BrowserWindow, session } from 'electron';
import type { RawPlatformData } from '../../shared/types/ExtractionScript.js';
import { registry } from './ExtractionScriptRegistry.js';

/**
 * ExtractionManager — manages BrowserView lifecycle per platform.
 *
 * Each platform gets one persistent BrowserView with its own isolated session
 * (persist:platformId partition) so cookies/credentials never leave the client (P1).
 * ExtractionManager does not know platform internals — it delegates to registry (P6).
 * Graceful degradation: extractFromView returns null for unrecognized pages (P5).
 */
export class ExtractionManager {
  private views = new Map<string, BrowserView>();

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
   */
  async extractFromView(platformId: string): Promise<RawPlatformData | null> {
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
}
