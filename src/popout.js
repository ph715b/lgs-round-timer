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
const poImage  = document.getElementById('po-image');
const poWrap   = document.getElementById('popout-wrap');

// ── BroadcastChannel ─────────────────────────────────────────
// Must use the same channel name as the main window ('lgs-timers')
const channel = new BroadcastChannel('lgs-timers');

// Status label map (same as main app)
const STATUS_LABELS = {
  idle:     'Ready',
  running:  'In Progress',
  paused:   'Paused',
  overtime: 'Overtime',
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
  const isOvertime = state.status === 'overtime';

  // ── Format time display ───────────────────────────────────
  // In overtime show +MM:SS counting up, otherwise show remaining MM:SS
  const rawSecs = isOvertime
    ? Math.ceil(state.overtimeSeconds || 0)
    : Math.ceil(state.remainingSeconds);
  const m = Math.floor(rawSecs / 60).toString().padStart(2, '0');
  const s = (rawSecs % 60).toString().padStart(2, '0');

  poTime.textContent   = isOvertime ? `+${m}:${s}` : `${m}:${s}`;
  poLabel.textContent  = state.label || '';
  poGame.textContent   = state.game;

  // ── Event logo ────────────────────────────────────────────
  if (state.image) {
    poImage.src    = state.image;
    poImage.hidden = false;
    poWrap.classList.remove('no-image');
  } else {
    poImage.hidden = true;
    poImage.src    = '';
    poWrap.classList.add('no-image');
  }
  poStatus.textContent = STATUS_LABELS[state.status] ?? state.status;

  // ── Progress bar — stays empty during overtime ────────────
  const pct = isOvertime ? 0
    : state.totalSeconds > 0
      ? (state.remainingSeconds / state.totalSeconds) * 100
      : 0;
  poFill.style.width = `${Math.max(0, pct)}%`;

  // ── Status classes drive all colour changes ───────────────
  wrap.dataset.status = state.status;

  const isWarning = state.remainingSeconds <= 300
    && state.remainingSeconds > 0
    && state.status === 'running';
  wrap.classList.toggle('warning',  isWarning);
  wrap.classList.toggle('overtime', isOvertime);

  // ── Window title ──────────────────────────────────────────
  document.title = isOvertime
    ? `+${m}:${s} OT — ${state.game}`
    : `${m}:${s} — ${state.game}`;
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