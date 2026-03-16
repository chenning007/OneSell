import { app, BrowserWindow } from 'electron';
import path from 'path';
import os from 'os';
import { ExtractionManager } from './extraction/ExtractionManager.js';
import { PayloadBuilder } from './extraction/PayloadBuilder.js';
import { registerIpcHandlers } from './ipc/handlers.js';
// Import extraction scripts so they self-register with the registry on startup
import './extraction/scripts/amazon-us/index.js';
import './extraction/scripts/google-trends/index.js';
import './extraction/scripts/alibaba/index.js';
import './extraction/scripts/ebay-us/index.js';
import './extraction/scripts/etsy/index.js';
import './extraction/scripts/tiktok-shop-us/index.js';

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
    win.webContents.openDevTools();
  } else {
    // Production: load built renderer
    // tsc outputs to dist/main/main/ (rootDir is src, so src/main/* → dist/main/main/*),
    // while Vite outputs the renderer to dist/renderer/.
    void win.loadFile(path.join(__dirname, '../../renderer/index.html'));
    // Open DevTools in production temporarily for debugging
    win.webContents.openDevTools();
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  const manager = new ExtractionManager(win);
  const payloadBuilder = new PayloadBuilder();
  registerIpcHandlers(win, manager, payloadBuilder);

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
