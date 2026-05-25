# ⏱ LGS Round Timer

A lightweight desktop app for local game stores (LGS) to manage multiple simultaneous round timers.

---

## Features

- 🎲 **Multiple timers at once** — one card per table, each independently controlled
- 🔔 **Audio alarms** — warning beep at 1 minute, three-tone alarm at time's up
- ⏸ **Pause & resume** — per timer or all at once
- 🗂 **Game presets** — MTG, Pokémon, Yu-Gi-Oh!, Flesh and Blood, Lorcana, and more
- ➕ **Custom presets** — add your own games and round lengths, saved between sessions
- ⧉ **Pop-out windows** — pop any timer into its own resizable window, great for a second monitor or store TV
- 📜 **Round history** — every round is logged with start time, end time, and table label
- 📥 **Export to CSV** — download round history as a spreadsheet
- 🌙 **Dark / light mode** — preference saved between sessions

---

## For Users — Downloading & Installing

1. Go to the [**Releases**](../../releases) page
2. Download the latest **`LGS Round Timer Setup x.x.x.exe`**
3. Run the installer — it will create a desktop shortcut and Start Menu entry
4. Launch **LGS Round Timer** from your desktop

> No browser, Node.js, or any other software required.

---

## For Developers

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or higher
- npm (comes with Node)

### Setup

```bash
git clone https://github.com/ph715b/lgs-round-timer.git
cd lgs-round-timer
npm install
```

### Run in development (Electron window)

```bash
npm run electron:dev
```

### Build the Windows installer

```bash
npm run electron:build
```

Output: `release/LGS Round Timer Setup x.x.x.exe`

### Run in browser (dev only)

```bash
npm run dev
# Opens http://localhost:5173
```

---

## Project Structure

```
lgs-round-timer/
├── index.html              # App shell & layout
├── popout.html             # Standalone pop-out timer window
├── vite.config.js          # Vite build config
├── package.json            # Dependencies & scripts
├── electron/
│   ├── main.cjs            # Electron main process — creates windows
│   └── preload.cjs         # Security preload script
├── src/
│   ├── main.js             # Entry point — wires everything together
│   ├── TimerCard.js        # Single timer: state, tick logic, DOM card
│   ├── TimerManager.js     # Manages all active timers
│   ├── Presets.js          # Game presets (localStorage)
│   ├── History.js          # Round logging & CSV export (localStorage)
│   ├── Audio.js            # Alarm sounds via Web Audio API
│   └── popout.js           # Logic for pop-out timer windows
├── styles/
│   └── main.css            # Full app stylesheet (light + dark theme)
└── .github/
    └── workflows/
        └── release.yml     # Auto-builds .exe on version tag push
```

---

## Releasing a New Version

1. Make your changes
2. Bump `"version"` in `package.json` (e.g. `"1.0.1"`)
3. Commit, tag, and push:

```bash
git add .
git commit -m "Release v1.0.1"
git tag v1.0.1
git push && git push --tags
```

GitHub Actions will automatically build the installer and publish it to the Releases page.

---

## Adding More Game Presets

Open `src/Presets.js` and add to the `DEFAULT_PRESETS` array:

```js
{ id: 'mygame', name: 'My Game Name', duration: 2700 }, // 45 min
```

Or use the **✎ Manage** button in the app to add presets without touching code.

---

## License

MIT — free to use, modify, and distribute.