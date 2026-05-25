// ============================================================
// popout.js
// Runs inside the pop-out window. Listens on a BroadcastChannel
// for timer state updates from the main window and renders them.
//
// BroadcastChannel is a browser API that lets same-origin windows
// talk to each other with zero setup — no server, no WebSockets.
// ============================================================

// ── Read our timer ID from the URL query string ───────────────
// The main window opens us as: popout.html?id=timer-abc123
const params  = new URLSearchParams(window.location.search);
const timerId = params.get('id');

// ── DOM refs ─────────────────────────────────────────────────
const wrap    = document.getElementById('popout-wrap');
const waiting = document.getElementById('popout-waiting');
const poLabel  = document.getElementById('po-label');
const poGame   = document.getElementById('po-game');
const poTime   = document.getElementById('po-time');
const poFill   = document.getElementById('po-fill');
const poStatus = document.getElementById('po-status');

// ── BroadcastChannel ─────────────────────────────────────────
// Must use the same channel name as the main window ('lgs-timers')
const channel = new BroadcastChannel('lgs-timers');

// Status label map (same as main app)
const STATUS_LABELS = {
  idle:    'Ready',
  running: 'In Progress',
  paused:  'Paused',
  expired: "Time's Up!",
};

/**
 * Called each time a broadcast message arrives from the main window.
 * Messages are an array of all timer states; we find ours by ID.
 *
 * @param {MessageEvent} event - event.data is TimerState[]
 */
channel.addEventListener('message', event => {
  const allTimers = event.data;

  // Find the state object that matches our timer ID
  const state = allTimers.find(t => t.id === timerId);
  if (!state) return; // our timer isn't in this broadcast (shouldn't happen)

  // First message received — swap from waiting screen to display
  if (wrap.hidden) {
    wrap.hidden    = false;
    waiting.hidden = true;
  }

  render(state);
});

/**
 * Updates all display elements from a timer state snapshot.
 * @param {object} state - { id, game, label, remainingSeconds, totalSeconds, status }
 */
function render(state) {
  // ── Format MM:SS ──────────────────────────────────────────
  const secs = Math.ceil(state.remainingSeconds);
  const m    = Math.floor(secs / 60).toString().padStart(2, '0');
  const s    = (secs % 60).toString().padStart(2, '0');

  poTime.textContent   = `${m}:${s}`;
  poLabel.textContent  = state.label || '';
  poGame.textContent   = state.game;
  poStatus.textContent = STATUS_LABELS[state.status] ?? state.status;

  // ── Progress bar ──────────────────────────────────────────
  const pct = state.totalSeconds > 0
    ? (state.remainingSeconds / state.totalSeconds) * 100
    : 0;
  poFill.style.width = `${Math.max(0, pct)}%`;

  // ── Status class on the wrapper drives all colour changes ─
  wrap.dataset.status = state.status;

  // Warning: < 5 minutes and still running
  const isWarning = state.remainingSeconds <= 300
    && state.remainingSeconds > 0
    && state.status === 'running';
  wrap.classList.toggle('warning', isWarning);

  // ── Update window title so it shows in the taskbar ────────
  document.title = `${m}:${s} — ${state.game}`;
}

// ── Theme sync ────────────────────────────────────────────────
// Mirror the main window's theme preference (saved in localStorage)
function applyTheme() {
  const saved = localStorage.getItem('lgs-theme');
  document.body.classList.toggle('theme-light', saved !== 'dark');
}
applyTheme();

// Re-apply if it changes while the pop-out is open
window.addEventListener('storage', e => {
  if (e.key === 'lgs-theme') applyTheme();
});

// ── Cleanup ───────────────────────────────────────────────────
// Close the channel when the window is closed to free resources
window.addEventListener('beforeunload', () => channel.close());