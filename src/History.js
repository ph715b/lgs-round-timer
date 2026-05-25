// ============================================================
// History.js
// Logs completed rounds to localStorage and provides helpers
// to read, clear, and export the history as a CSV.
// ============================================================

const STORAGE_KEY = 'lgs-timer-history';

// Maximum number of entries to keep (prevents localStorage bloat)
const MAX_ENTRIES = 500;

/**
 * Loads the full history log from localStorage.
 * @returns {Array} Array of log entry objects, newest first.
 */
export function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.warn('[History] Failed to load:', err);
    return [];
  }
}

/**
 * Saves the history array to localStorage.
 * Trims to MAX_ENTRIES to prevent runaway storage use.
 * @param {Array} entries
 */
function saveHistory(entries) {
  try {
    // Keep only the most recent MAX_ENTRIES entries
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[History] Failed to save:', err);
  }
}

/**
 * Logs a completed (or manually ended) round to history.
 * @param {object} timerData - The timer object at the time it ended
 * @param {'expired'|'stopped'} reason - Why the round ended
 */
export function logRound(timerData, reason = 'expired') {
  const history = loadHistory();

  // Build a clean log entry — only keep what's useful for the log
  const entry = {
    id:          `log-${Date.now()}`,
    game:        timerData.game,
    label:       timerData.label,
    totalTime:   timerData.totalSeconds,      // original round duration (seconds)
    timeUsed:    timerData.totalSeconds - timerData.remainingSeconds,
    startedAt:   timerData.startedAt ? new Date(timerData.startedAt).toISOString() : null,
    endedAt:     new Date().toISOString(),
    reason,                                    // 'expired' | 'stopped'
  };

  // Prepend so newest entries come first
  history.unshift(entry);
  saveHistory(history);
  return entry;
}

/**
 * Clears the entire history log.
 * Irreversible — use with caution!
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[History] Failed to clear:', err);
  }
}

/**
 * Exports the history as a downloadable CSV file.
 * Triggers a browser download automatically.
 */
export function exportHistoryAsCSV() {
  const history = loadHistory();

  if (history.length === 0) {
    alert('No history to export yet!');
    return;
  }

  // CSV header row
  const headers = ['Game', 'Table/Label', 'Round Duration (min)', 'Time Used (min)', 'Started At', 'Ended At', 'Reason'];

  // Convert each entry to a CSV row
  const rows = history.map(entry => [
    `"${entry.game}"`,
    `"${entry.label || ''}"`,
    (entry.totalTime / 60).toFixed(1),
    (entry.timeUsed / 60).toFixed(1),
    entry.startedAt || '',
    entry.endedAt || '',
    entry.reason,
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');

  // Create a temporary link and click it to trigger the download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `lgs-round-history-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  // Clean up the temporary object URL
  URL.revokeObjectURL(url);
}

/**
 * Formats an ISO date string into a friendly local time string.
 * e.g. "2025-05-10T18:30:00.000Z" → "6:30 PM"
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}