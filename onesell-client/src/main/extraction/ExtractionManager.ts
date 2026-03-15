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
    let view = this.views.get(platformId);
    if (!view) {
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
    }
    this.mainWindow.addBrowserView(view);
    this.sizeView(view);
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
    if (!view || !script) return null;

    const url = view.webContents.getURL();

    // Serialize extractFromPage to run in the page context
    const extractFnSrc = script.extractFromPage.toString();
    const js = `
      (() => {
        const extractFromPage = ${extractFnSrc};
        try {
          return JSON.stringify(extractFromPage(document, ${JSON.stringify(url)}));
        } catch (e) {
          return null;
        }
      })()
    `;

    const result: string | null = await view.webContents.executeJavaScript(js);
    if (result === null || result === undefined) return null;

    try {
      return JSON.parse(result) as RawPlatformData;
    } catch {
      return null;
    }
  }

  /** Return the current URL loaded in the view (or empty string if view not found). */
  getCurrentUrl(platformId: string): string {
    const view = this.views.get(platformId);
    return view ? view.webContents.getURL() : '';
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
