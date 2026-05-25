# ⏱ LGS Round Timer

A lightweight, browser-based round timer built for local game stores (LGS). Run multiple simultaneous timers — one per table — each labeled with the game being played.

---

## Features

- 🎲 **Multiple timers at once** — one card per table, each independently controlled
- 🔔 **Audio alarms** — warning beep at 1 minute, three-tone alarm at time's up
- ⏸ **Pause & resume** — per timer or all at once
- 🗂 **Game presets** — MTG, Pokémon, Yu-Gi-Oh!, Flesh and Blood, Lorcana, and more
- ➕ **Custom presets** — add your own games and round lengths, saved between sessions
- 📜 **Round history** — every round is logged with start time, end time, and table label
- 📥 **Export to CSV** — download round history as a spreadsheet
- 🌙 **Dark / light mode** — preference saved between sessions
- 📱 **Responsive** — works on tablets too

---

## For Users (No Code Required)

1. Go to the [**Releases**](../../releases) page
2. Download the latest `lgs-round-timer.zip`
3. Unzip it anywhere on your computer
4. Open `index.html` in your browser — that's it!

> **Note:** Use a modern browser (Chrome, Edge, Firefox). Audio requires a user interaction before it plays — just click anything on the page first.

---

## For Developers

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or higher
- npm (comes with Node)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/lgs-round-timer.git
cd lgs-round-timer
npm install
```

### Development

```bash
npm run dev
# Opens http://localhost:5173 with hot reload
```

### Build for distribution

```bash
npm run build
# Outputs a self-contained app to dist/
```

To create a release ZIP:
```bash
cd dist && zip -r ../lgs-round-timer.zip .
```

---

## Project Structure

```
lgs-round-timer/
├── index.html              # App shell & layout
├── vite.config.js          # Build config
├── src/
│   ├── main.js             # Entry point — wires everything together
│   ├── TimerCard.js        # Single timer: state, tick logic, DOM card
│   ├── TimerManager.js     # Manages the collection of all active timers
│   ├── Presets.js          # Game presets (localStorage)
│   ├── History.js          # Round logging & CSV export (localStorage)
│   └── Audio.js            # Alarm sounds via Web Audio API
└── styles/
    └── main.css            # Full app stylesheet (light + dark theme)
```

---

## Adding More Game Presets

Open `src/Presets.js` and add to the `DEFAULT_PRESETS` array:

```js
{ id: 'mygame', name: 'My Game Name', duration: 2700 }, // 45 min
```

Or just use the **"+ Add new preset..."** option in the app's dropdown — presets are saved automatically to localStorage.

---

## License

MIT — free to use, modify, and distribute.

---

## Building the Desktop App (.exe)

The app can be packaged as a Windows installer using Electron — no browser required.

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or higher

### Steps

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Build the installer
npm run electron:build
```

The installer will be output to `release/LGS Round Timer Setup 1.0.0.exe`.

Staff can run the installer once and then launch the app from the desktop shortcut or Start Menu like any other Windows program.

### Test before building

To preview the app in Electron without packaging:

```bash
npm run electron:dev
```

### Releasing a new version

1. Bump the `"version"` field in `package.json`
2. Run `npm run electron:build`
3. Upload the new `.exe` from `release/` to GitHub Releases