// ============================================================
// TimerManager.js
// Manages the collection of all active TimerCards.
// Handles adding, removing, and broadcasting controls
// (e.g. "pause all timers at once").
// ============================================================

import { TimerCard } from './TimerCard.js';

export class TimerManager {
  /**
   * @param {HTMLElement} container - The DOM element where timer cards are rendered
   */
  /**
   * @param {HTMLElement} container - The DOM element where timer cards are rendered
   * @param {Function}   onRemove  - Optional callback fired when any card is removed,
   *                                 so main.js can update the UI count immediately.
   */
  constructor(container, onRemove) {
    this.container = container;
    this.timers = new Map();
    this._tableCounter = 1;
    // Notify main.js whenever a card is removed so it can call updateUI()
    this._onRemove = onRemove || null;
  }

  /**
   * Creates a new TimerCard and appends it to the container.
   * @param {string} game         - Game name
   * @param {string} label        - Timer name (optional, auto-generated if empty)
   * @param {number} totalSeconds - Round duration in seconds
   * @returns {TimerCard}
   */
  addTimer(game, label, totalSeconds, image) {
    const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Auto-generate a timer name if none was provided
    const resolvedLabel = label?.trim() || `Timer ${this._tableCounter++}`;

    const card = new TimerCard({
      id,
      game,
      label: resolvedLabel,
      totalSeconds,
      image: image || null,
      // When the card removes itself, tell the manager to clean up
      onRemove: (removedId) => this._removeTimer(removedId),
    });

    this.timers.set(id, card);
    this.container.appendChild(card.element);

    // Trigger a CSS animation so the new card slides in
    requestAnimationFrame(() => {
      card.element.classList.add('timer-card--visible');
    });

    return card;
  }

  /**
   * Internal cleanup when a card signals it has been removed.
   * @param {string} id
   */
  _removeTimer(id) {
    this.timers.delete(id);
    // Tell main.js a card was removed so the count badge updates immediately
    if (this._onRemove) this._onRemove();
  }

  /**
   * Pauses all currently running timers.
   * Useful for announcing things at the event.
   */
  pauseAll() {
    this.timers.forEach(card => {
      if (card.status === 'running') card.pause();
    });
  }

  /**
   * Resumes all paused timers.
   */
  resumeAll() {
    this.timers.forEach(card => {
      if (card.status === 'paused') card.start();
    });
  }

  /**
   * Resets all timers to idle.
   */
  resetAll() {
    this.timers.forEach(card => card.reset());
  }

  /**
   * Returns how many timers are currently in each status.
   * Useful for the dashboard summary line.
   * @returns {{ running: number, paused: number, idle: number, expired: number }}
   */
  getStatusSummary() {
    const summary = { running: 0, paused: 0, idle: 0, expired: 0 };
    this.timers.forEach(card => {
      if (summary[card.status] !== undefined) summary[card.status]++;
    });
    return summary;
  }

  /** Returns the total number of active timer cards. */
  get count() {
    return this.timers.size;
  }
}