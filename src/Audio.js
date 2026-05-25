// ============================================================
// Audio.js
// Handles all alarm sounds using the Web Audio API.
// No external files or libraries needed — pure browser audio.
// ============================================================

/**
 * Creates and returns a shared AudioContext.
 * We reuse one context across all sounds to avoid hitting browser limits.
 */
let _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

/**
 * Plays a simple beep tone.
 * @param {number} frequency - Hz of the tone (default 880 = high A)
 * @param {number} duration  - How long in seconds (default 1.5s)
 * @param {string} type      - Oscillator wave type: 'sine' | 'square' | 'triangle' | 'sawtooth'
 */
export function playBeep(frequency = 880, duration = 1.5, type = 'sine') {
  try {
    const ctx = getAudioContext();

    // Oscillator generates the actual tone
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;

    // GainNode lets us fade the volume out smoothly instead of a harsh cut
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    // Wire: oscillator → gain → speakers
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    // Audio can fail silently (e.g. browser autoplay policy) — just log it
    console.warn('[Audio] Could not play beep:', err);
  }
}

/**
 * Plays the "round over" alarm — three descending tones.
 * Called when a timer hits 00:00.
 */
export function playRoundEndAlarm() {
  try {
    const ctx = getAudioContext();

    // Three beeps: high → mid → low, spaced 0.4s apart
    const tones = [
      { freq: 880, start: 0.0 },
      { freq: 660, start: 0.4 },
      { freq: 440, start: 0.8 },
    ];

    tones.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Each tone fades out over 0.3 seconds
      gain.gain.setValueAtTime(0.9, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.35);
    });
  } catch (err) {
    console.warn('[Audio] Could not play alarm:', err);
  }
}

/**
 * Plays a short "warning" tick — a softer single beep.
 * Used when a timer hits the low-time warning threshold.
 */
export function playWarningBeep() {
  playBeep(660, 0.3, 'triangle');
}