// ============================================================
// electron/main.cjs
// The Electron "main process" — creates windows, handles the
// app lifecycle, and controls how pop-out windows behave.
// ============================================================

const { app, BrowserWindow, shell, powerSaveBlocker } = require('electron');
const path = require('path');

// ── Prevent timer throttling ──────────────────────────────────
// Electron/Chromium throttles setInterval when a window is minimised
// or loses focus. powerSaveBlocker prevents the app from being
// put into a low-power state, keeping timers running at full speed.
let powerSaveId = null;

// ── Window factory ────────────────────────────────────────────

function createMainWindow() {
  const win = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    title:     'LGS Round Timer',

    // icon: path.join(__dirname, '../assets/icon.ico'),

    webPreferences: {
      preload:              path.join(__dirname, 'preload.cjs'),
      contextIsolation:     true,
      nodeIntegration:      false,
      sandbox:              false,
      // Prevent Chromium from throttling timers when window is not focused
      backgroundThrottling: false,
    },
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Press F12 to open DevTools in development
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') win.webContents.openDevTools();
    });
  }

  // ── Stop throttling when window is hidden/minimised ──────────
  // 'prevent-app-suspension' stops Chromium from throttling
  // background timers so countdowns keep ticking accurately.
  win.on('hide',    startPowerBlock);
  win.on('minimize', startPowerBlock);
  win.on('show',    stopPowerBlock);
  win.on('restore', stopPowerBlock);
  win.on('focus',   stopPowerBlock);

  // ── Pop-out window handler ────────────────────────────────────
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
          preload:              path.join(__dirname, 'preload.cjs'),
          contextIsolation:     true,
          nodeIntegration:      false,
          sandbox:              false,
          backgroundThrottling: false,
        },
      },
    };
  });

  return win;
}

/** Starts the power save blocker if not already running. */
function startPowerBlock() {
  if (powerSaveId === null) {
    powerSaveId = powerSaveBlocker.start('prevent-app-suspension');
  }
}

/** Stops the power save blocker when the window is active again. */
function stopPowerBlock() {
  if (powerSaveId !== null && powerSaveBlocker.isStarted(powerSaveId)) {
    powerSaveBlocker.stop(powerSaveId);
    powerSaveId = null;
  }
}

// ── App lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  // Start blocker immediately so timers work from the first second
  startPowerBlock();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopPowerBlock();
  if (process.platform !== 'darwin') app.quit();
});
