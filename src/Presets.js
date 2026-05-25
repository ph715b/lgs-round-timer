// ============================================================
// Presets.js
// Manages game presets (name + duration) stored in localStorage.
// Presets survive page refreshes and browser restarts.
// ============================================================

// The key we use to store presets in localStorage
const STORAGE_KEY = 'lgs-timer-presets';

/**
 * Default presets that ship with the app.
 * Add more common LGS games here as needed!
 * durations are in seconds.
 */
const DEFAULT_PRESETS = [
  { id: 'mtg',       name: 'Magic: The Gathering', duration: 3000 }, // 50 min
  { id: 'pokemon',   name: 'Pokémon TCG',          duration: 1800 }, // 30 min
  { id: 'yugioh',    name: 'Yu-Gi-Oh!',            duration: 2400 }, // 40 min
  { id: 'fab',       name: 'Flesh and Blood',      duration: 3000 }, // 50 min
  { id: 'lorcana',   name: 'Disney Lorcana',       duration: 1800 }, // 30 min
  { id: 'dbs',       name: 'Dragon Ball Super CG', duration: 1800 }, // 30 min
  { id: 'swu',       name: 'Star Wars Unlimited',  duration: 1800 }, // 30 min
  { id: 'custom',    name: 'Custom',               duration: 1800 }, // editable
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
  const defaultIds = DEFAULT_PRESETS.map(p => p.id);
  if (defaultIds.includes(id)) {
    console.warn('[Presets] Cannot delete a default preset.');
    return false;
  }

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