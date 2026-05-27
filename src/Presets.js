// ============================================================
// Presets.js
// Manages game presets (name + duration + optional image)
// stored in localStorage.
// ============================================================

const STORAGE_KEY = 'lgs-timer-presets';

/**
 * Default presets that ship with the app.
 * Keep this minimal — stores add their own via the Manage Presets menu.
 * Durations are in seconds.
 */
const DEFAULT_PRESETS = [
  { id: 'default', name: 'Custom', duration: 3000, image: null },
];

/**
 * Loads all presets from localStorage.
 * If nothing is stored yet, returns and saves the defaults.
 * @returns {Array} Array of preset objects { id, name, duration, image }
 */
export function loadPresets() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const presets = JSON.parse(stored);
      // Backfill image: null for any old presets that don't have it
      return presets.map(p => ({ image: null, ...p }));
    }
  } catch (err) {
    console.warn('[Presets] Failed to load from localStorage:', err);
  }

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
 * @param {string}      name     - Display name
 * @param {number}      duration - Duration in seconds
 * @param {string|null} image    - Base64 data URL for the event logo (optional)
 * @returns {object} The new preset object
 */
export function addPreset(name, duration, image = null) {
  const presets = loadPresets();
  const newPreset = {
    id:    `preset-${Date.now()}`,
    name:  name.trim(),
    duration,
    image,
  };
  presets.push(newPreset);
  savePresets(presets);
  return newPreset;
}

/**
 * Updates an existing preset's image.
 * @param {string}      id    - Preset ID to update
 * @param {string|null} image - New base64 image, or null to clear
 */
export function updatePresetImage(id, image) {
  const presets = loadPresets();
  const preset  = presets.find(p => p.id === id);
  if (!preset) return;
  preset.image = image;
  savePresets(presets);
}

/**
 * Removes a preset by its id and persists the change.
 * @param {string} id
 * @returns {boolean}
 */
export function deletePreset(id) {
  const presets  = loadPresets();
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