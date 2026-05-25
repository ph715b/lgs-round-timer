// ============================================================
// electron/preload.cjs
// Runs in a privileged context before the renderer page loads.
// Keeps Node.js APIs out of the renderer for security.
//
// Our app doesn't need any special Node APIs in the renderer,
// so this file is intentionally minimal. It exists because
// having a preload script is required for contextIsolation to
// work properly.
// ============================================================

// Nothing to expose — the app only uses browser APIs
// (BroadcastChannel, localStorage, Web Audio API) which are
// all available natively in the Electron renderer.
