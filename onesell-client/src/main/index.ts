import { app, BrowserWindow } from 'electron';
import path from 'path';
import { ExtractionManager } from './extraction/ExtractionManager.js';
import { registerIpcHandlers } from './ipc/handlers.js';

const isDev = process.env['NODE_ENV'] === 'development';

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

  if (isDev) {
    // Development: load from Vite dev server (hot-reload)
    void win.loadURL('http://localhost:5173');
  } else {
    // Production: load built renderer
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  const manager = new ExtractionManager(win);
  registerIpcHandlers(win, manager);

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
