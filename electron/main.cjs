// ============================================================
// electron/main.cjs
// The Electron "main process" — this is the Node.js side of
// the desktop app. It creates windows, handles the app
// lifecycle, and controls how pop-out windows behave.
//
// We use .cjs (CommonJS) so this file stays compatible with
// all Electron versions, while the rest of the project uses
// ES modules via Vite.
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
    title: 'LGS Round Timer',

    // Uncomment once you have an icon file at assets/icon.ico:
    // icon: path.join(__dirname, '../assets/icon.ico'),

    webPreferences: {
      // Preload runs before the page, in a privileged context
      preload: path.join(__dirname, 'preload.cjs'),

      // Security: keep Node APIs out of the renderer
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,  // needed for BroadcastChannel across windows
    },
  });

  // Load the built app from disk (file:// protocol)
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // ── Pop-out window handler ──────────────────────────────────
  // When the renderer calls window.open() (the ⧉ button),
  // Electron intercepts it here and opens a real desktop window
  // instead of a browser tab.
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow pop-outs to our own popout.html — block everything else
    if (!url.includes('popout.html')) {
      // If somehow an external URL is requested, open it in the
      // system browser instead of inside the app
      shell.openExternal(url);
      return { action: 'deny' };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width:      420,
        height:     300,
        minWidth:   280,
        minHeight:  200,
        resizable:  true,
        minimizable: true,
        maximizable: true,
        title: 'Timer — LGS Round Timer',

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

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Quit when all windows are closed (standard on Windows/Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
