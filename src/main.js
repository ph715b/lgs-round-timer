// ============================================================
// main.js
// App entry point. Wires together the TimerManager, Presets,
// History panel, and all UI interactions.
// ============================================================

import { TimerManager } from './TimerManager.js';
import { saveCustomAlarm, getCustomAlarm, clearCustomAlarm, playRoundEndAlarm } from './Audio.js';
import { loadPresets, addPreset, deletePreset, updatePresetImage, formatDuration } from './Presets.js';
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

// Timer image upload
const timerImageInput   = document.getElementById('timer-image-input');
const timerImageBtn     = document.getElementById('timer-image-btn');
const timerImageName    = document.getElementById('timer-image-name');
const timerImageClear   = document.getElementById('timer-image-clear');
const timerImagePreview = document.getElementById('timer-image-preview');
const timerImagePreviewImg = document.getElementById('timer-image-preview-img');

// Holds the base64 data URL of the selected image, or null
let _pendingTimerImage = null;

// Alarm sound
const alarmSoundName  = document.getElementById('alarm-sound-name');
const alarmFileInput  = document.getElementById('alarm-file-input');
const alarmUploadBtn  = document.getElementById('alarm-upload-btn');
const alarmTestBtn    = document.getElementById('alarm-test-btn');
const alarmClearBtn   = document.getElementById('alarm-clear-btn');

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

// Restore saved alarm sound label
initAlarmSound();

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
    customDuration.value = Math.round(selected.dataset.dur / 60);
  }

  // Auto-fill the event logo from the selected preset
  fillImageFromPreset();
}

presetSelect.addEventListener('change', syncDurationToPreset);

/**
 * Fills the image upload field from the currently selected preset's saved image.
 * Call this any time the preset selection changes OR after adding a timer
 * so the logo is always ready for the next one.
 */
function fillImageFromPreset() {
  const presets = loadPresets();
  const preset  = presets.find(p => p.id === presetSelect.value);
  if (preset?.image) {
    _pendingTimerImage         = preset.image;
    timerImagePreviewImg.src   = preset.image;
    timerImagePreview.hidden   = false;
    timerImageName.textContent = 'From preset';
    timerImageClear.hidden     = false;
  } else {
    _pendingTimerImage         = null;
    timerImagePreviewImg.src   = '';
    timerImagePreview.hidden   = true;
    timerImageName.textContent = 'No image';
    timerImageClear.hidden     = true;
  }
}

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

  manager.addTimer(game, label, Math.round(durationMinutes * 60), _pendingTimerImage);

  // Clear label, then refill image from preset so it's ready for the next timer
  tableLabelInput.value = '';
  fillImageFromPreset();

  updateUI();
});

// Also allow pressing Enter in the label field to add a timer
tableLabelInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTimerBtn.click();
});

// ── Timer Image Upload ────────────────────────────────────────────────────────

timerImageBtn.addEventListener('click', () => timerImageInput.click());

timerImageInput.addEventListener('change', () => {
  const file = timerImageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    _pendingTimerImage       = reader.result;
    timerImageName.textContent = file.name;
    timerImageClear.hidden   = false;
    timerImagePreviewImg.src = _pendingTimerImage;
    timerImagePreview.hidden = false;
  };
  reader.readAsDataURL(file);
  timerImageInput.value = ''; // allow re-selecting same file
});

timerImageClear.addEventListener('click', () => {
  _pendingTimerImage         = null;
  timerImageName.textContent = 'No image';
  timerImageClear.hidden     = true;
  timerImagePreview.hidden   = true;
  timerImagePreviewImg.src   = '';
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

  presetManagerList.innerHTML = '';

  if (presets.length === 0) {
    presetManagerList.innerHTML = '<p class="preset-manager-empty">No presets found.</p>';
    return;
  }

  presets.forEach(preset => {
    const row = document.createElement('div');
    row.className = 'preset-row';

    // Left side: thumbnail (if any) + game name + duration
    const info = document.createElement('div');
    info.className = 'preset-row__info';
    info.innerHTML = `
      ${preset.image ? `<img src="${preset.image}" class="preset-row__thumb" alt="" />` : ''}
      <div>
        <span class="preset-row__name">${preset.name}</span>
        <span class="preset-row__dur">${formatDuration(preset.duration)}</span>
      </div>
    `;

    // Right side: delete button for every preset
    const action = document.createElement('div');
    action.className = 'preset-row__action';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--danger btn--sm preset-row__delete';
    deleteBtn.textContent = '× Delete';
    deleteBtn.title = `Delete "${preset.name}"`;

    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete the preset "${preset.name}"?`)) return;
      deletePreset(preset.id);
      renderPresetManagerList();
      populatePresetDropdown();
    });

    // Image upload button for this preset
    const imageInput = document.createElement('input');
    imageInput.type   = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';

    const imageBtn = document.createElement('button');
    imageBtn.className   = 'btn btn--secondary btn--sm';
    imageBtn.textContent = preset.image ? '🖼 Change' : '🖼 Add logo';
    imageBtn.title       = 'Attach an event logo to this preset';

    imageBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        updatePresetImage(preset.id, reader.result);
        renderPresetManagerList();
        populatePresetDropdown();
      };
      reader.readAsDataURL(file);
    });

    // Clear image button — only shown if preset has one
    if (preset.image) {
      const clearImg = document.createElement('button');
      clearImg.className   = 'btn btn--danger btn--sm';
      clearImg.textContent = '✕';
      clearImg.title       = 'Remove logo from this preset';
      clearImg.addEventListener('click', () => {
        updatePresetImage(preset.id, null);
        renderPresetManagerList();
        populatePresetDropdown();
      });
      action.appendChild(clearImg);
    }

    action.appendChild(imageInput);
    action.appendChild(imageBtn);
    action.appendChild(deleteBtn);

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

// ── Alarm Sound ──────────────────────────────────────────────────────────────

/** Updates the alarm UI to reflect the currently saved sound. */
function initAlarmSound() {
  const alarm = getCustomAlarm();
  if (alarm) {
    alarmSoundName.textContent = alarm.name;
    alarmClearBtn.hidden = false;
  } else {
    alarmSoundName.textContent = 'Default beep';
    alarmClearBtn.hidden = true;
  }
}

// Clicking "Upload sound" opens the hidden file picker
alarmUploadBtn.addEventListener('click', () => alarmFileInput.click());

// When a file is selected, save it and update the UI
alarmFileInput.addEventListener('change', async () => {
  const file = alarmFileInput.files[0];
  if (!file) return;

  try {
    const name = await saveCustomAlarm(file);
    alarmSoundName.textContent = name;
    alarmClearBtn.hidden = false;
    // Reset the input so the same file can be re-selected if needed
    alarmFileInput.value = '';
  } catch (err) {
    alert(err.message);
  }
});

// Test button toggles between playing and stopping the alarm
let _testAudio = null;

alarmTestBtn.addEventListener('click', () => {
  // If something is already playing, stop it
  if (_testAudio) {
    _testAudio.pause();
    _testAudio.currentTime = 0;
    _testAudio = null;
    alarmTestBtn.textContent = '▶ Test';
    return;
  }

  const alarm = getCustomAlarm();
  if (alarm) {
    // Custom sound — track the Audio object so we can stop it
    _testAudio = new Audio(alarm.dataUrl);
    alarmTestBtn.textContent = '⏹ Stop';
    _testAudio.play().catch(err => console.warn('[Audio] Test failed:', err));
    // Reset button when sound finishes naturally
    _testAudio.addEventListener('ended', () => {
      _testAudio = null;
      alarmTestBtn.textContent = '▶ Test';
    });
  } else {
    // Generated beep — can't stop mid-play but it's short so just play it
    playRoundEndAlarm();
  }
});

// Clear button removes the custom sound and reverts to default
alarmClearBtn.addEventListener('click', () => {
  clearCustomAlarm();
  alarmSoundName.textContent = 'Default beep';
  alarmClearBtn.hidden = true;
});

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

// ── BroadcastChannel: live state publisher via Web Worker ────────────────────
// We use a Web Worker for the broadcast loop so it keeps running at full
// speed even when the main window is minimised or loses focus.
// Chromium throttles setInterval on inactive windows, which caused the
// popout to appear paused — the worker thread is never throttled.

const broadcastWorker = new Worker(
  new URL('./broadcastWorker.js', import.meta.url),
  { type: 'module' }
);

/**
 * Collects a plain-object snapshot from every active TimerCard and
 * sends it to the worker, which rebroadcasts it every 500ms.
 */
function broadcastTimerStates() {
  const states = [];
  manager.timers.forEach(card => {
    states.push({
      id:               card.id,
      game:             card.game,
      label:            card.label,
      image:            card.image,
      status:           card.status,
      remainingSeconds: card.remainingSeconds,
      overtimeSeconds:  card.overtimeSeconds,
      totalSeconds:     card.totalSeconds,
    });
  });
  broadcastWorker.postMessage({ type: 'UPDATE_STATES', states });
}

// Send fresh state to the worker every 250ms — the worker broadcasts
// to popouts at its own 500ms pace from its unthrottled thread
setInterval(broadcastTimerStates, 250);

// Clean up when the main window closes
window.addEventListener('beforeunload', () => broadcastWorker.terminate());

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