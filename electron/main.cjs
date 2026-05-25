// ============================================================
// electron/main.cjs
// The Electron "main process" — creates windows, handles the
// app lifecycle, and controls how pop-out windows behave.
// ============================================================

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// ── Window factory ────────────────────────────────────────────

/**
 * Creates the main app window.
 * Loads dist/index.html — the Vite-built app — directly from disk.
 */
function createMainWindow() {
  const win = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    title:     'LGS Round Timer',

    // Uncomment once you have an icon file at assets/icon.ico:
    // icon: path.join(__dirname, '../assets/icon.ico'),

    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false, // needed for BroadcastChannel across windows
    },
  });

  // Load the built app from disk (file:// protocol)
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Press F12 to open DevTools in development
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') win.webContents.openDevTools();
    });
  }

  // ── Pop-out window handler ──────────────────────────────────
  // Intercepts window.open() calls from the ⧉ button and opens
  // them as real desktop windows instead of browser tabs.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.includes('popout.html')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width:       420,
        height:      300,
        minWidth:    280,
        minHeight:   200,
        resizable:   true,
        minimizable: true,
        maximizable: true,
        title:       'Timer — LGS Round Timer',

        // icon: path.join(__dirname, '../assets/icon.ico'),

        webPreferences: {
          preload:          path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration:  false,
          sandbox:          false,
        },
      },
    };
  });

  return win;
}

// ── App lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Quit when all windows are closed (Windows/Linux standard behaviour)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
