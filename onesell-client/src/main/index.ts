import { app, BrowserWindow } from 'electron';
import path from 'path';
import os from 'os';
import { ExtractionManager } from './extraction/ExtractionManager.js';
import { PayloadBuilder } from './extraction/PayloadBuilder.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { LocalStore } from './store/LocalStore.js';
import { ApiKeyManager } from './store/ApiKeyManager.js';
import { initAutoUpdater } from './updater.js';
// Import extraction scripts so they self-register with the registry on startup
// M1 — US platform scripts
import './extraction/scripts/amazon-us/index.js';
import './extraction/scripts/google-trends/index.js';
import './extraction/scripts/alibaba/index.js';
import './extraction/scripts/ebay-us/index.js';
import './extraction/scripts/etsy/index.js';
import './extraction/scripts/tiktok-shop-us/index.js';
// M4 — China platform scripts
import './extraction/scripts/taobao/index.js';
import './extraction/scripts/jd/index.js';
import './extraction/scripts/pinduoduo/index.js';
import './extraction/scripts/douyin-shop/index.js';
import './extraction/scripts/kuaishou-shop/index.js';
import './extraction/scripts/xiaohongshu/index.js';
import './extraction/scripts/1688/index.js';
import './extraction/scripts/baidu-index/index.js';
// M6 — Regional platform scripts
import './extraction/scripts/shopee/index.js';
import './extraction/scripts/tokopedia/index.js';
import './extraction/scripts/lazada/index.js';
import './extraction/scripts/tiktok-shop-sea/index.js';
import './extraction/scripts/amazon-uk/index.js';
import './extraction/scripts/amazon-de/index.js';
import './extraction/scripts/amazon-jp/index.js';
import './extraction/scripts/rakuten/index.js';
import './extraction/scripts/mercari-jp/index.js';
import './extraction/scripts/amazon-au/index.js';
import './extraction/scripts/ebay-regional/index.js';

const isDev = process.env['NODE_ENV'] === 'development';

// Log unhandled errors in the main process
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});

// Point user data to a writable temp location to avoid GPU cache permission errors
// on machines where the default AppData path is restricted.
app.setPath('userData', path.join(os.tmpdir(), 'onesell-scout'));

// Suppress GPU cache errors on restricted Windows environments
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // P9 — security by default: contextIsolation + sandbox, no nodeIntegration
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Forward renderer console output to the main-process terminal for debugging
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const tag = ['[renderer:verbose]', '[renderer:info]', '[renderer:warn]', '[renderer:error]'][level] ?? '[renderer]';
    console.log(`${tag} ${message}  (${sourceId}:${line})`);
  });

  // Log renderer crashes and navigation failures
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process gone:', details.reason, 'exitCode:', details.exitCode);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] Failed to load: ${validatedURL} — ${errorDescription} (code ${errorCode})`);
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[main] Preload error in ${preloadPath}:`, error);
  });

  if (isDev) {
    // Development: load from Vite dev server (hot-reload)
    void win.loadURL('http://localhost:5173');
    if (process.env['SHOW_DEVTOOLS'] === 'true') {
      win.webContents.openDevTools();
    }
  } else {
    // Production: load built renderer
    // tsc outputs to dist/main/main/ (rootDir is src, so src/main/* → dist/main/main/*),
    // while Vite outputs the renderer to dist/renderer/.
    void win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  const manager = new ExtractionManager(win);
  const payloadBuilder = new PayloadBuilder();
  const localStore = new LocalStore();
  const apiKeyManager = new ApiKeyManager();

  // Initialize async stores before registering IPC handlers
  void Promise.all([localStore.ready(), apiKeyManager.ready()]).then(() => {
    registerIpcHandlers(win, manager, payloadBuilder, undefined, localStore, apiKeyManager);
  });

  // Initialize auto-updater (F-17, #293) — graceful failure in dev
  initAutoUpdater(win);

  win.on('closed', () => {
    manager.destroyAll();
  });

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked with no open windows
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS apps stay in the dock until the user explicitly quits (Cmd+Q)
  if (process.platform !== 'darwin') app.quit();
});
