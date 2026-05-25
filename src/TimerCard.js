// ============================================================
// TimerCard.js
// Represents a single timer — its data, its tick logic,
// and the DOM card it renders into.
// ============================================================

import { playRoundEndAlarm, playWarningBeep } from './Audio.js';
import { logRound } from './History.js';

// How many seconds before zero we show the low-time warning
const WARNING_THRESHOLD_SECONDS = 300; // 5 minutes

// How many seconds before zero we play a warning beep
const WARNING_BEEP_THRESHOLD = 60; // 1 minute

export class TimerCard {
  /**
   * @param {object} options
   * @param {string}   options.id            - Unique ID for this timer
   * @param {string}   options.game          - Game name (e.g. "MTG")
   * @param {string}   options.label         - Table label (e.g. "Table 3")
   * @param {number}   options.totalSeconds  - Round duration in seconds
   * @param {Function} options.onRemove      - Callback when the card is removed
   */
  constructor({ id, game, label, totalSeconds, onRemove }) {
    // ── State ──────────────────────────────────────────────
    this.id               = id;
    this.game             = game;
    this.label            = label;
    this.totalSeconds     = totalSeconds;
    this.remainingSeconds = totalSeconds;
    this.status           = 'idle';  // 'idle' | 'running' | 'paused' | 'expired'
    this.startedAt        = null;    // timestamp (ms) when the timer last started/resumed
    this.accumulatedMs    = 0;       // ms already elapsed before current run segment
    this.intervalId       = null;    // setInterval handle
    this.hasWarnedBeep    = false;   // prevent duplicate warning beeps
    this.onRemove         = onRemove;

    // ── Build DOM ──────────────────────────────────────────
    this.element = this._buildElement();
    this._updateDisplay();
  }

  // ── DOM Builder ──────────────────────────────────────────

  /**
   * Creates and returns the full card DOM element.
   * All sub-elements are stored as instance properties for easy updates.
   */
  _buildElement() {
    const card = document.createElement('div');
    card.className = 'timer-card';
    card.dataset.id = this.id;

    // Header: game name + label + remove button
    const header = document.createElement('div');
    header.className = 'timer-card__header';

    this.gameEl  = document.createElement('span');
    this.gameEl.className = 'timer-card__game';
    this.gameEl.textContent = this.game;

    this.labelEl = document.createElement('span');
    this.labelEl.className = 'timer-card__label';
    this.labelEl.textContent = this.label || '';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'timer-card__remove';
    removeBtn.title = 'Remove this timer';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => this._handleRemove());

    header.append(this.gameEl, this.labelEl, removeBtn);

    // ── Time display ──────────────────────────────────────
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.className = 'timer-card__time';
    this.timeDisplay.textContent = this._formatTime(this.remainingSeconds);

    // Progress bar (shrinks as time runs out)
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'timer-card__progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'timer-card__progress-fill';
    this.progressFill = progressFill;
    this.progressBar.appendChild(progressFill);

    // ── Status badge ──────────────────────────────────────
    this.statusBadge = document.createElement('div');
    this.statusBadge.className = 'timer-card__status';
    this.statusBadge.textContent = 'Ready';

    // ── Control buttons ───────────────────────────────────
    const controls = document.createElement('div');
    controls.className = 'timer-card__controls';

    this.startPauseBtn = document.createElement('button');
    this.startPauseBtn.className = 'btn btn--primary';
    this.startPauseBtn.textContent = 'Start';
    this.startPauseBtn.addEventListener('click', () => this._handleStartPause());

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'btn btn--secondary';
    this.resetBtn.textContent = 'Reset';
    this.resetBtn.addEventListener('click', () => this._handleReset());

    // ── Pop-out button ────────────────────────────────────
    // Opens this timer in its own resizable window via BroadcastChannel.
    // window.__lgsOpenPopout is registered by main.js after the
    // BroadcastChannel publisher is set up.
    this.popoutBtn = document.createElement('button');
    this.popoutBtn.className = 'btn btn--ghost btn--popout';
    this.popoutBtn.title = 'Pop out into its own window';
    this.popoutBtn.textContent = '⧉';
    this.popoutBtn.addEventListener('click', () => {
      if (typeof window.__lgsOpenPopout === 'function') {
        window.__lgsOpenPopout(this.id);
      }
    });

    controls.append(this.startPauseBtn, this.resetBtn, this.popoutBtn);

    // ── Assemble card ─────────────────────────────────────
    card.append(header, this.timeDisplay, this.progressBar, this.statusBadge, controls);
    return card;
  }

  // ── Timer Logic ──────────────────────────────────────────

  /**
   * Starts or resumes the timer.
   * We track real wall-clock time so the timer stays accurate
   * even if the tab is backgrounded or the interval fires late.
   */
  start() {
    if (this.status === 'running' || this.status === 'expired') return;

    this.status    = 'running';
    this.startedAt = Date.now(); // record when this run segment began

    // Tick every 250ms for smooth display
    this.intervalId = setInterval(() => this._tick(), 250);

    this._updateDisplay();
  }

  /** Pauses the timer and accumulates elapsed time. */
  pause() {
    if (this.status !== 'running') return;

    clearInterval(this.intervalId);
    this.intervalId = null;

    // Save how much time has elapsed in this run segment
    this.accumulatedMs += Date.now() - this.startedAt;
    this.startedAt = null;
    this.status = 'paused';

    this._updateDisplay();
  }

  /** Resets the timer back to full duration in idle state. */
  reset() {
    clearInterval(this.intervalId);
    this.intervalId       = null;
    this.status           = 'idle';
    this.startedAt        = null;
    this.accumulatedMs    = 0;
    this.remainingSeconds = this.totalSeconds;
    this.hasWarnedBeep    = false;

    this._updateDisplay();
  }

  /**
   * Internal tick — called every 250ms while running.
   * Calculates remaining time from real elapsed time.
   */
  _tick() {
    if (this.status !== 'running') return;

    // Total elapsed = already accumulated + current run segment
    const elapsedMs      = this.accumulatedMs + (Date.now() - this.startedAt);
    const elapsedSeconds = elapsedMs / 1000;

    this.remainingSeconds = Math.max(0, this.totalSeconds - elapsedSeconds);

    // ── Warning beep at 1 minute remaining ────────────────
    if (!this.hasWarnedBeep && this.remainingSeconds <= WARNING_BEEP_THRESHOLD) {
      playWarningBeep();
      this.hasWarnedBeep = true;
    }

    // ── Timer expired ─────────────────────────────────────
    if (this.remainingSeconds <= 0) {
      this._expire();
      return;
    }

    this._updateDisplay();
  }

  /** Called when the timer runs out. Plays alarm, logs round. */
  _expire() {
    clearInterval(this.intervalId);
    this.intervalId       = null;
    this.status           = 'expired';
    this.remainingSeconds = 0;

    // Log to history before updating display
    logRound(this, 'expired');

    playRoundEndAlarm();
    this._updateDisplay();
  }

  // ── Event Handlers ───────────────────────────────────────

  _handleStartPause() {
    if (this.status === 'running') {
      this.pause();
    } else if (this.status === 'idle' || this.status === 'paused') {
      this.start();
    }
    // expired timers ignore this button (user must reset first)
  }

  _handleReset() {
    // If timer was running or paused, log it as manually stopped
    if (this.status === 'running' || this.status === 'paused') {
      logRound(this, 'stopped');
    }
    this.reset();
  }

  _handleRemove() {
    // Clean up the interval if running
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    // Log if it was active
    if (this.status === 'running' || this.status === 'paused') {
      logRound(this, 'stopped');
    }
    // Remove DOM element
    this.element.remove();
    // Notify TimerManager
    if (this.onRemove) this.onRemove(this.id);
  }

  // ── Display Updates ──────────────────────────────────────

  /**
   * Syncs all visual elements to current state.
   * Called after every state change.
   */
  _updateDisplay() {
    // ── Time text ──────────────────────────────────────────
    this.timeDisplay.textContent = this._formatTime(this.remainingSeconds);

    // ── Progress bar fill ─────────────────────────────────
    const pct = (this.remainingSeconds / this.totalSeconds) * 100;
    this.progressFill.style.width = `${pct}%`;

    // ── Card color state ──────────────────────────────────
    this.element.dataset.status = this.status;

    // Low-time warning class (red tint) when under threshold
    const isWarning = this.remainingSeconds <= WARNING_THRESHOLD_SECONDS
      && this.remainingSeconds > 0
      && this.status === 'running';
    this.element.classList.toggle('timer-card--warning', isWarning);
    this.element.classList.toggle('timer-card--expired', this.status === 'expired');

    // ── Status badge text ──────────────────────────────────
    const statusText = {
      idle:    'Ready',
      running: 'In Progress',
      paused:  'Paused',
      expired: 'Time\'s Up!',
    };
    this.statusBadge.textContent = statusText[this.status] ?? '';

    // ── Start/Pause button label ───────────────────────────
    if (this.status === 'running') {
      this.startPauseBtn.textContent = 'Pause';
      this.startPauseBtn.disabled = false;
    } else if (this.status === 'expired') {
      this.startPauseBtn.textContent = 'Expired';
      this.startPauseBtn.disabled = true;
    } else {
      this.startPauseBtn.textContent = this.status === 'paused' ? 'Resume' : 'Start';
      this.startPauseBtn.disabled = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Converts a raw seconds value into MM:SS display string.
   * e.g. 3000 → "50:00" | 65 → "01:05"
   * @param {number} totalSecs
   * @returns {string}
   */
  _formatTime(totalSecs) {
    const secs = Math.ceil(totalSecs); // ceil so we don't show 0 a tick early
    const m    = Math.floor(secs / 60).toString().padStart(2, '0');
    const s    = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}