// ============================================================
// main.js
// App entry point. Wires together the TimerManager, Presets,
// History panel, and all UI interactions.
// ============================================================

import { TimerManager } from './TimerManager.js';
import { loadPresets, addPreset, deletePreset, formatDuration } from './Presets.js';
import { loadHistory, clearHistory, exportHistoryAsCSV, formatTime } from './History.js';

// ── DOM References ────────────────────────────────────────────────────────────
const timerGrid          = document.getElementById('timer-grid');
const emptyState         = document.getElementById('empty-state');
const presetSelect       = document.getElementById('preset-select');
const customDuration     = document.getElementById('custom-duration');
const tableLabelInput    = document.getElementById('table-label');
const addTimerBtn        = document.getElementById('add-timer-btn');
const pauseAllBtn        = document.getElementById('pause-all-btn');
const resumeAllBtn       = document.getElementById('resume-all-btn');
const resetAllBtn        = document.getElementById('reset-all-btn');
const historyPanel       = document.getElementById('history-panel');
const historyList        = document.getElementById('history-list');
const historyToggle      = document.getElementById('history-toggle');
const clearHistoryBtn    = document.getElementById('clear-history-btn');
const exportCsvBtn       = document.getElementById('export-csv-btn');
const timerCountEl       = document.getElementById('timer-count');
const themeToggle        = document.getElementById('theme-toggle');

// Manage Presets modal
const managePresetsBtn   = document.getElementById('manage-presets-btn');
const presetsModalBdrop  = document.getElementById('presets-modal-backdrop');
const closeModalBtn      = document.getElementById('close-modal-btn');
const presetManagerList  = document.getElementById('preset-manager-list');
const newPresetNameInput = document.getElementById('new-preset-name');
const newPresetMinsInput = document.getElementById('new-preset-mins');
const saveNewPresetBtn   = document.getElementById('save-new-preset-btn');

// ── Init ──────────────────────────────────────────────────────────────────────

// Create the manager — pass updateUI so the count badge refreshes when a card is removed
const manager = new TimerManager(timerGrid, () => updateUI());

// Populate preset dropdown on load
populatePresetDropdown();

// Render history panel on load
renderHistory();

// Restore saved theme preference
applySavedTheme();

// ── Preset Dropdown ───────────────────────────────────────────────────────────

/** Fills the <select> with current presets from localStorage. */
function populatePresetDropdown() {
  // Remember which preset was selected so we can restore it after a rebuild
  const previousValue = presetSelect.value;

  const presets = loadPresets();
  presetSelect.innerHTML = '';

  presets.forEach(preset => {
    const option       = document.createElement('option');
    option.value       = preset.id;
    option.dataset.dur = preset.duration;
    option.textContent = `${preset.name}  (${formatDuration(preset.duration)})`;
    presetSelect.appendChild(option);
  });

  // Add a divider + "Add custom preset..." option at the bottom
  const divider       = document.createElement('option');
  divider.disabled    = true;
  divider.textContent = '──────────────';
  presetSelect.appendChild(divider);

  const addCustom       = document.createElement('option');
  addCustom.value       = '__add_custom__';
  addCustom.textContent = '+ Add new preset...';
  presetSelect.appendChild(addCustom);

  // Try to restore the previously selected preset; fall back to first
  const match = [...presetSelect.options].find(o => o.value === previousValue);
  if (match) presetSelect.value = previousValue;

  // Sync the duration input to whatever is currently selected
  syncDurationToPreset();
}

/**
 * When the user picks a preset, update the duration input to match.
 * If they pick "Add custom preset...", redirect them to the modal instead.
 */
function syncDurationToPreset() {
  const selected = presetSelect.options[presetSelect.selectedIndex];

  if (presetSelect.value === '__add_custom__') {
    // Open the manage modal rather than using old browser prompts
    presetSelect.selectedIndex = 0;
    openPresetsModal();
    return;
  }

  if (selected?.dataset.dur) {
    customDuration.value = Math.round(selected.dataset.dur / 60); // convert to minutes
  }
}

presetSelect.addEventListener('change', syncDurationToPreset);

// ── Add Timer ─────────────────────────────────────────────────────────────────

addTimerBtn.addEventListener('click', () => {
  const durationMinutes = parseFloat(customDuration.value);
  if (!durationMinutes || durationMinutes <= 0) {
    alert('Please enter a valid duration in minutes.');
    return;
  }

  // Resolve the game name from the selected preset (fallback to raw input)
  const selectedOption = presetSelect.options[presetSelect.selectedIndex];
  const game = selectedOption?.textContent?.split('(')[0].trim() || 'Custom Game';

  const label = tableLabelInput.value.trim();

  manager.addTimer(game, label, Math.round(durationMinutes * 60));

  // Clear label input for the next timer
  tableLabelInput.value = '';

  updateUI();
});

// Also allow pressing Enter in the label field to add a timer
tableLabelInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTimerBtn.click();
});

// ── Global Controls ───────────────────────────────────────────────────────────

pauseAllBtn.addEventListener('click', () => manager.pauseAll());
resumeAllBtn.addEventListener('click', () => manager.resumeAll());
resetAllBtn.addEventListener('click', () => {
  if (manager.count === 0) return;
  if (confirm('Reset all timers?')) {
    manager.resetAll();
    renderHistory(); // history may have new stopped entries
  }
});

// ── Manage Presets Modal ──────────────────────────────────────────────────────

/** Opens the modal and renders the current preset list inside it. */
function openPresetsModal() {
  presetsModalBdrop.hidden = false;
  // Small delay so the browser paints the element before animating it in
  requestAnimationFrame(() => presetsModalBdrop.classList.add('modal-backdrop--visible'));
  renderPresetManagerList();
  newPresetNameInput.focus();
}

/** Closes the modal with a fade-out animation. */
function closePresetsModal() {
  presetsModalBdrop.classList.remove('modal-backdrop--visible');
  // Wait for the CSS transition to finish before hiding the element
  presetsModalBdrop.addEventListener('transitionend', () => {
    presetsModalBdrop.hidden = true;
  }, { once: true });
}

managePresetsBtn.addEventListener('click', openPresetsModal);
closeModalBtn.addEventListener('click', closePresetsModal);

// Clicking the dark backdrop (outside the modal box) also closes it
presetsModalBdrop.addEventListener('click', e => {
  if (e.target === presetsModalBdrop) closePresetsModal();
});

// Escape key closes the modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !presetsModalBdrop.hidden) closePresetsModal();
});

/**
 * Renders all presets into the modal list.
 * Built-in/default presets show a 🔒 lock icon instead of a delete button.
 * Custom presets show a red × delete button.
 */
function renderPresetManagerList() {
  const presets = loadPresets();

  // IDs that belong to the hard-coded defaults (cannot be deleted)
  const defaultIds = ['mtg', 'pokemon', 'yugioh', 'fab', 'lorcana', 'dbs', 'swu', 'custom'];

  presetManagerList.innerHTML = '';

  if (presets.length === 0) {
    presetManagerList.innerHTML = '<p class="preset-manager-empty">No presets found.</p>';
    return;
  }

  presets.forEach(preset => {
    const isDefault = defaultIds.includes(preset.id);

    const row = document.createElement('div');
    row.className = 'preset-row';

    // Left side: game name + duration
    const info = document.createElement('div');
    info.className = 'preset-row__info';
    info.innerHTML = `
      <span class="preset-row__name">${preset.name}</span>
      <span class="preset-row__dur">${formatDuration(preset.duration)}</span>
    `;

    // Right side: lock icon (default) OR delete button (custom)
    const action = document.createElement('div');
    action.className = 'preset-row__action';

    if (isDefault) {
      // Default presets are locked — show a tooltip explaining why
      const lock = document.createElement('span');
      lock.className = 'preset-row__lock';
      lock.title = 'Built-in preset — cannot be deleted';
      lock.textContent = '🔒';
      action.appendChild(lock);
    } else {
      // Custom presets can be deleted
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn--danger btn--sm preset-row__delete';
      deleteBtn.textContent = '× Delete';
      deleteBtn.title = `Delete "${preset.name}"`;

      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete the preset "${preset.name}"?`)) return;

        deletePreset(preset.id);

        // Refresh both the modal list and the sidebar dropdown
        renderPresetManagerList();
        populatePresetDropdown();
      });

      action.appendChild(deleteBtn);
    }

    row.append(info, action);
    presetManagerList.appendChild(row);
  });
}

/**
 * Handles saving a brand-new custom preset from the modal form.
 * Validates the inputs, saves, and refreshes both the list and dropdown.
 */
function handleSaveNewPreset() {
  const name = newPresetNameInput.value.trim();
  const mins = parseInt(newPresetMinsInput.value, 10);

  if (!name) {
    newPresetNameInput.focus();
    newPresetNameInput.classList.add('form-input--error');
    return;
  }
  if (!mins || mins <= 0) {
    newPresetMinsInput.focus();
    newPresetMinsInput.classList.add('form-input--error');
    return;
  }

  // Clear any previous error states
  newPresetNameInput.classList.remove('form-input--error');
  newPresetMinsInput.classList.remove('form-input--error');

  // Save to localStorage and refresh UI
  const newPreset = addPreset(name, mins * 60);
  renderPresetManagerList();
  populatePresetDropdown();

  // Select the newly created preset in the sidebar dropdown
  const newOption = [...presetSelect.options].find(o => o.value === newPreset.id);
  if (newOption) {
    presetSelect.value = newPreset.id;
    syncDurationToPreset();
  }

  // Clear the form for the next entry
  newPresetNameInput.value = '';
  newPresetMinsInput.value = '';
  newPresetNameInput.focus();
}

saveNewPresetBtn.addEventListener('click', handleSaveNewPreset);

// Allow pressing Enter in either field to save
newPresetNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSaveNewPreset(); });
newPresetMinsInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSaveNewPreset(); });

// ── History Panel ─────────────────────────────────────────────────────────────

/** Toggles the history panel open/closed. */
historyToggle.addEventListener('click', () => {
  const isOpen = historyPanel.classList.toggle('history-panel--open');
  historyToggle.textContent = isOpen ? 'Hide History' : 'Show History';
  if (isOpen) renderHistory();
});

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear all round history? This cannot be undone.')) {
    clearHistory();
    renderHistory();
  }
});

exportCsvBtn.addEventListener('click', () => exportHistoryAsCSV());

/** Renders history log entries into the history panel. */
function renderHistory() {
  const entries = loadHistory();
  historyList.innerHTML = '';

  if (entries.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No rounds logged yet.</p>';
    return;
  }

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'history-entry';

    // Pill-style badge for how the round ended
    const reasonClass = entry.reason === 'expired' ? 'badge--expired' : 'badge--stopped';

    row.innerHTML = `
      <div class="history-entry__game">${entry.game}</div>
      <div class="history-entry__label">${entry.label || '—'}</div>
      <div class="history-entry__meta">
        <span>${formatTime(entry.startedAt)} → ${formatTime(entry.endedAt)}</span>
        <span class="badge ${reasonClass}">${entry.reason}</span>
      </div>
    `;
    historyList.appendChild(row);
  });
}

// Keep history up to date when timers expire (poll every 5s)
setInterval(() => {
  if (historyPanel.classList.contains('history-panel--open')) {
    renderHistory();
  }
}, 5000);

// ── Theme Toggle ──────────────────────────────────────────────────────────────

themeToggle.addEventListener('click', () => {
  // Toggle the class and read back whether it's now on or off
  const nowDark = document.body.classList.toggle('theme-dark');
  localStorage.setItem('lgs-theme', nowDark ? 'dark' : 'light');
  themeToggle.textContent = nowDark ? '🌙 Dark mode' : '☀ Light mode';
});

/**
 * Reads the saved theme from localStorage on startup and applies it.
 * Defaults to light mode if nothing has been saved yet.
 */
function applySavedTheme() {
  const isDark = localStorage.getItem('lgs-theme') === 'dark';
  if (isDark) document.body.classList.add('theme-dark');
  themeToggle.textContent = isDark ? '🌙 Dark mode' : '☀ Light mode';
}

// ── UI State Sync ─────────────────────────────────────────────────────────────

/**
 * Updates the empty state message and timer count badge.
 * Called after adding/removing timers.
 */
function updateUI() {
  const count = manager.count;
  timerCountEl.textContent = count === 1 ? '1 timer' : `${count} timers`;
  emptyState.style.display = count === 0 ? 'flex' : 'none';
}

// Initial UI state
updateUI();

// ── BroadcastChannel: live state publisher ────────────────────────────────────
// Broadcasts every timer's current state every 500ms so any open pop-out
// windows stay in sync. BroadcastChannel works across windows/tabs on the
// same origin with zero config — no server or WebSockets needed.

const broadcast = new BroadcastChannel('lgs-timers');

/**
 * Collects a plain-object snapshot from every active TimerCard and
 * posts it to the channel. Each pop-out window filters by its own ID.
 */
function broadcastTimerStates() {
  const states = [];
  manager.timers.forEach(card => {
    states.push({
      id:               card.id,
      game:             card.game,
      label:            card.label,
      status:           card.status,
      remainingSeconds: card.remainingSeconds,
      totalSeconds:     card.totalSeconds,
    });
  });
  broadcast.postMessage(states);
}

// Broadcast every 500ms — smooth enough for a countdown display
setInterval(broadcastTimerStates, 500);

// Clean up when the main window closes
window.addEventListener('beforeunload', () => broadcast.close());

// ── Pop-out windows ───────────────────────────────────────────────────────────
// Tracks open pop-out windows so clicking ⧉ twice focuses rather than
// opening a duplicate.
const popoutWindows = new Map(); // timerId → Window reference

/**
 * Opens a pop-out window for the given timer ID.
 * If one is already open for that timer, focuses it instead.
 * @param {string} timerId
 */
function openPopout(timerId) {
  // If a window for this timer is already open, just bring it to focus
  const existing = popoutWindows.get(timerId);
  if (existing && !existing.closed) {
    existing.focus();
    return;
  }

  // Build the popout URL — works in both Vite dev (relative) and Electron (file://)
  // window.location.href gives us the correct base in both environments
  const base    = window.location.href.replace(/[^/]*$/, '');
  const popUrl  = `${base}popout.html?id=${timerId}`;

  const win = window.open(
    popUrl,
    `timer-popout-${timerId}`,
    'width=400,height=280,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no,popup=yes'
  );

  if (!win) {
    alert('Pop-out was blocked! Please allow pop-ups for this page in your browser settings, then try again.');
    return;
  }

  popoutWindows.set(timerId, win);
}

// Expose openPopout globally so TimerCard's ⧉ button can call it
// (TimerCard has no direct reference to main.js, so we use window)
window.__lgsOpenPopout = openPopout;