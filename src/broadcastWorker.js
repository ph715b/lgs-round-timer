// ============================================================
// src/broadcastWorker.js
// Runs on a separate thread via Web Worker.
// Receives timer state from main.js and rebroadcasts it on a
// BroadcastChannel every 500ms — unaffected by window focus
// or minimisation, unlike setInterval on the main thread.
// ============================================================

// Open the same channel that popout.js listens on
const channel = new BroadcastChannel('lgs-timers');

let latestStates = [];

// Main thread sends us updated states whenever timers change
self.addEventListener('message', (e) => {
  if (e.data.type === 'UPDATE_STATES') {
    latestStates = e.data.states;
  }
});

// Broadcast at 500ms — this interval is never throttled in a worker
setInterval(() => {
  if (latestStates.length > 0) {
    channel.postMessage(latestStates);
  }
}, 500);

// Clean up when the worker is terminated
self.addEventListener('close', () => channel.close());