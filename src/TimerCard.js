// ============================================================
// TimerCard.js
// Represents a single timer — its data, its tick logic,
// and the DOM card it renders into.
// ============================================================

import { playRoundEndAlarm, playWarningBeep, stopAlarm } from './Audio.js';
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
  constructor({ id, game, label, totalSeconds, image, onRemove }) {
    // ── State ──────────────────────────────────────────────
    this.id               = id;
    this.game             = game;
    this.label            = label;
    this.image            = image || null; // base64 data URL for the event logo
    this.totalSeconds     = totalSeconds;
    this.remainingSeconds = totalSeconds;
    this.overtimeSeconds  = 0;       // counts UP after time hits zero
    this.status           = 'idle';  // 'idle' | 'running' | 'paused' | 'expired' | 'overtime'
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

    // ── Event logo (optional) ─────────────────────────────
    this.imageEl = document.createElement('img');
    this.imageEl.className = 'timer-card__image';
    this.imageEl.alt = '';
    if (this.image) {
      this.imageEl.src = this.image;
    } else {
      this.imageEl.hidden = true;
    }

    this.gameEl = document.createElement('span');
    this.gameEl.className = 'timer-card__game';
    this.gameEl.textContent = this.game;

    this.labelEl = document.createElement('span');
    this.labelEl.className = 'timer-card__label';
    this.labelEl.textContent = this.label || '';
    // Show full name on hover in case it's been truncated
    if (this.label) this.labelEl.title = this.label;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'timer-card__remove';
    removeBtn.title = 'Remove this timer';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => this._handleRemove());

    // ── Pop-out button — lives in the header corner next to remove ──
    this.popoutBtn = document.createElement('button');
    this.popoutBtn.className = 'timer-card__popout';
    this.popoutBtn.title = 'Pop out into its own window';
    this.popoutBtn.textContent = '⧉';
    this.popoutBtn.addEventListener('click', () => {
      if (typeof window.__lgsOpenPopout === 'function') {
        window.__lgsOpenPopout(this.id);
      }
    });

    header.append(this.imageEl, this.gameEl, this.labelEl, this.popoutBtn, removeBtn);

    // ── Time display ──────────────────────────────────────
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.className = 'timer-card__time';
    this.timeDisplay.textContent = this._formatTime(this.remainingSeconds);

    // Progress bar (shrinks as time runs out, stays empty in overtime)
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

    controls.append(this.startPauseBtn, this.resetBtn);

    // ── Time adjustment buttons ───────────────────────────
    // Four quick-tap buttons: -5, -1, +1, +5 minutes.
    // Works in any state except idle (no point adjusting a timer that hasn't started).
    const timeAdj = document.createElement('div');
    timeAdj.className = 'timer-card__time-adj';

    const adjBtns = [
      { label: '−5m', delta: -300 },
      { label: '−1m', delta:  -60 },
      { label: '+1m', delta:   60 },
      { label: '+5m', delta:  300 },
    ];

    adjBtns.forEach(({ label, delta }) => {
      const btn = document.createElement('button');
      btn.className = `btn--adj ${delta < 0 ? 'btn--adj-minus' : 'btn--adj-plus'}`;
      btn.textContent = label;
      btn.title = delta > 0
        ? `Add ${Math.abs(delta / 60)} minute${Math.abs(delta) > 60 ? 's' : ''}`
        : `Subtract ${Math.abs(delta / 60)} minute${Math.abs(delta) > 60 ? 's' : ''}`;
      btn.addEventListener('click', () => this._adjustTime(delta));
      timeAdj.appendChild(btn);
    });

    // ── Assemble card ─────────────────────────────────────
    card.append(header, this.timeDisplay, this.progressBar, this.statusBadge, controls, timeAdj);
    return card;
  }

  // ── Timer Logic ──────────────────────────────────────────

  /** Starts or resumes the timer. */
  start() {
    if (this.status === 'running' || this.status === 'overtime') return;

    // Re-entering from paused-during-overtime
    if (this.status === 'paused' && this.remainingSeconds <= 0) {
      this.status    = 'overtime';
    } else {
      this.status    = 'running';
    }

    this.startedAt = Date.now();
    this.intervalId = setInterval(() => this._tick(), 250);
    this._updateDisplay();
  }

  /** Pauses the timer — works in both running and overtime states. */
  pause() {
    if (this.status !== 'running' && this.status !== 'overtime') return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.accumulatedMs += Date.now() - this.startedAt;
    this.startedAt = null;
    this.status = 'paused';
    stopAlarm(); // silence any playing alarm when paused
    this._updateDisplay();
  }

  /** Resets the timer fully back to idle. */
  reset() {
    clearInterval(this.intervalId);
    this.intervalId       = null;
    this.status           = 'idle';
    this.startedAt        = null;
    this.accumulatedMs    = 0;
    this.remainingSeconds = this.totalSeconds;
    this.overtimeSeconds  = 0;
    this.hasWarnedBeep    = false;
    stopAlarm(); // silence any playing alarm on reset
    this._updateDisplay();
  }

  /**
   * Internal tick — called every 250ms.
   * Handles both the countdown phase and the overtime count-up phase.
   */
  _tick() {
    if (this.status !== 'running' && this.status !== 'overtime') return;

    const elapsedMs      = this.accumulatedMs + (Date.now() - this.startedAt);
    const elapsedSeconds = elapsedMs / 1000;

    if (this.status === 'running') {
      // ── Countdown phase ───────────────────────────────
      this.remainingSeconds = Math.max(0, this.totalSeconds - elapsedSeconds);

      // Warning beep at 1 minute remaining
      if (!this.hasWarnedBeep && this.remainingSeconds <= WARNING_BEEP_THRESHOLD) {
        playWarningBeep();
        this.hasWarnedBeep = true;
      }

      // Time just hit zero — switch to overtime
      if (this.remainingSeconds <= 0) {
        this._startOvertime();
        return;
      }

    } else if (this.status === 'overtime') {
      // ── Overtime phase — count upward from zero ────────
      // elapsedMs includes all time since the last start/resume,
      // so we subtract the original round duration to get pure overtime
      this.overtimeSeconds = Math.max(0, elapsedSeconds - this.totalSeconds);
    }

    this._updateDisplay();
  }

  /**
   * Called the moment the countdown hits zero.
   * Plays the alarm, logs the round, and switches to overtime mode.
   * The interval keeps running — now ticking overtimeSeconds upward.
   */
  _startOvertime() {
    this.remainingSeconds = 0;
    this.overtimeSeconds  = 0;
    this.status           = 'overtime';

    // Reset the time baseline so the tick starts overtime at +00:00 immediately,
    // regardless of whether we got here naturally or via a subtraction adjustment.
    // Without this, accumulatedMs may reflect a time less than totalSeconds,
    // causing the tick to calculate negative overtime (stuck at 0) until real
    // time catches up.
    if (this.intervalId) {
      this.accumulatedMs = this.totalSeconds * 1000;
      this.startedAt     = Date.now();
    }

    logRound(this, 'expired');
    playRoundEndAlarm();
    this._updateDisplay();
  }

  // ── Event Handlers ───────────────────────────────────────

  _handleStartPause() {
    if (this.status === 'running' || this.status === 'overtime') {
      this.pause();
    } else if (this.status === 'idle' || this.status === 'paused') {
      this.start();
    }
  }

  _handleReset() {
    if (this.status === 'running' || this.status === 'paused' || this.status === 'overtime') {
      // Only log as stopped if we haven't already logged it (overtime already logs at expiry)
      if (this.status !== 'overtime') {
        logRound(this, 'stopped');
      }
    }
    this.reset();
  }

  _handleRemove() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.status === 'running' || this.status === 'paused') {
      logRound(this, 'stopped');
    }
    this.element.remove();
    if (this.onRemove) this.onRemove(this.id);
  }

  /**
   * Adjusts the remaining time by delta seconds.
   * Works while running, paused, or in overtime.
   * - Positive delta: adds time (can pull back out of overtime)
   * - Negative delta: subtracts time (floors at 0, entering overtime if running)
   * @param {number} delta - seconds to add (positive) or subtract (negative)
   */
  _adjustTime(delta) {
    // Don't adjust idle timers — nothing is running yet
    if (this.status === 'idle') return;

    if (this.status === 'overtime') {
      // In overtime, adding time reduces overtimeSeconds first,
      // then restores remaining time if we go past zero
      const newOvertime = this.overtimeSeconds - delta;
      if (newOvertime <= 0) {
        // Adding enough time to come back out of overtime
        this.remainingSeconds = Math.abs(newOvertime);
        this.overtimeSeconds  = 0;
        this.status           = this.intervalId ? 'running' : 'paused';
        // Reset the accumulated time baseline so the tick stays accurate
        if (this.intervalId) {
          this.accumulatedMs = this.totalSeconds * 1000 - this.remainingSeconds * 1000;
          this.startedAt     = Date.now();
        }
      } else {
        this.overtimeSeconds = newOvertime;
        // Adjust accumulatedMs so the tick stays accurate.
        // To increase overtime (negative delta) we need MORE elapsed time → subtract delta.
        // To decrease overtime (positive delta) we need LESS elapsed time → subtract delta.
        // Either way: accumulatedMs -= delta * 1000
        if (this.intervalId) {
          this.accumulatedMs -= delta * 1000;
          this.startedAt = Date.now();
        }
      }
    } else {
      // Normal countdown — clamp so we can't go below 0
      const newRemaining = this.remainingSeconds + delta;
      if (newRemaining <= 0 && this.status === 'running') {
        // Subtracting pushed us into overtime mid-run
        this._startOvertime();
        return;
      }
      this.remainingSeconds = Math.max(0, newRemaining);

      // Shift accumulatedMs so the tick recalculates correctly from the new remaining time.
      // We do NOT change totalSeconds — that's the original round length and must stay fixed.
      if (this.intervalId) {
        this.accumulatedMs -= delta * 1000;
        this.startedAt      = Date.now();
      }
    }

    this._updateDisplay();
  }

  // ── Display Updates ──────────────────────────────────────

  /** Syncs all visual elements to current state. */
  _updateDisplay() {
    // ── Time display ──────────────────────────────────────
    if (this.status === 'overtime') {
      // Show +MM:SS counting upward in overtime
      this.timeDisplay.textContent = `+${this._formatTime(this.overtimeSeconds)}`;
    } else {
      this.timeDisplay.textContent = this._formatTime(this.remainingSeconds);
    }

    // ── Progress bar ──────────────────────────────────────
    // Stays at 0% during overtime (round is over)
    const pct = this.status === 'overtime'
      ? 0
      : (this.remainingSeconds / this.totalSeconds) * 100;
    this.progressFill.style.width = `${pct}%`;

    // ── Card status classes ───────────────────────────────
    this.element.dataset.status = this.status;

    const isWarning = this.remainingSeconds <= WARNING_THRESHOLD_SECONDS
      && this.remainingSeconds > 0
      && this.status === 'running';
    this.element.classList.toggle('timer-card--warning',  isWarning);
    this.element.classList.toggle('timer-card--overtime', this.status === 'overtime');

    // ── Status badge ──────────────────────────────────────
    const statusText = {
      idle:     'Ready',
      running:  'In Progress',
      paused:   'Paused',
      overtime: 'Overtime',
    };
    this.statusBadge.textContent = statusText[this.status] ?? '';

    // ── Start/Pause button ────────────────────────────────
    if (this.status === 'running' || this.status === 'overtime') {
      this.startPauseBtn.textContent = 'Pause';
      this.startPauseBtn.disabled = false;
    } else {
      this.startPauseBtn.textContent = this.status === 'paused' ? 'Resume' : 'Start';
      this.startPauseBtn.disabled = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Formats seconds into MM:SS.
   * e.g. 3000 → "50:00" | 65 → "01:05"
   */
  _formatTime(totalSecs) {
    const secs = Math.ceil(Math.abs(totalSecs));
    const m    = Math.floor(secs / 60).toString().padStart(2, '0');
    const s    = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}