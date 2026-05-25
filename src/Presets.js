// ============================================================
// Presets.js
// Manages game presets (name + duration) stored in localStorage.
// Presets survive page refreshes and browser restarts.
// ============================================================

// The key we use to store presets in localStorage
const STORAGE_KEY = 'lgs-timer-presets';

/**
 * Default presets that ship with the app.
 * Keep this minimal — stores add their own via the Manage Presets menu.
 * Durations are in seconds.
 */
const DEFAULT_PRESETS = [
  { id: 'default', name: 'Custom', duration: 3000 }, // 50 min — edit as needed
];

/**
 * Loads all presets from localStorage.
 * If nothing is stored yet, returns and saves the defaults.
 * @returns {Array} Array of preset objects { id, name, duration }
 */
export function loadPresets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.warn('[Presets] Failed to load from localStorage:', err);
  }

  // First run — seed with defaults
  savePresets(DEFAULT_PRESETS);
  return DEFAULT_PRESETS;
}

/**
 * Saves the full presets array to localStorage.
 * @param {Array} presets
 */
export function savePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.warn('[Presets] Failed to save to localStorage:', err);
  }
}

/**
 * Adds a new preset and persists it.
 * @param {string} name     - Display name (e.g. "My Custom Game")
 * @param {number} duration - Duration in seconds
 * @returns {object} The new preset object
 */
export function addPreset(name, duration) {
  const presets = loadPresets();
  const newPreset = {
    id: `preset-${Date.now()}`, // unique enough for our purposes
    name: name.trim(),
    duration,
  };
  presets.push(newPreset);
  savePresets(presets);
  return newPreset;
}

/**
 * Removes a preset by its id and persists the change.
 * Default presets (hard-coded ids) cannot be deleted.
 * @param {string} id
 * @returns {boolean} true if deleted, false if protected or not found
 */
export function deletePreset(id) {
  // Protect the built-in defaults from deletion
  // No protected presets — users can delete anything

  const presets = loadPresets();
  const filtered = presets.filter(p => p.id !== id);
  savePresets(filtered);
  return true;
}

/**
 * Formats a duration in seconds into a human-readable string.
 * e.g. 3000 → "50 min" | 90 → "1 min 30 sec"
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}