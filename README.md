# SurTaal — Your Pocket Harmonium

SurTaal is a browser-based Indian harmonium, Sargam practice companion, and melody recorder built with React, TypeScript, and the Web Audio API.

Most web keyboard apps treat Indian classical music as an afterthought—hardcoding `Sa` to `C`, cutting notes off with harsh digital clicks, or wrapping a basic sine wave in a bloated UI. I built SurTaal to feel like an actual instrument you can open on a laptop or phone, set to your vocal scale (`Safed 1` through `Kali 5`), and play immediately with zero backend dependencies.

---

## What It Does

* **Playable Multi-Reed Harmonium:** Supports single-reed (*Khula*), double-reed (*Nar + Mada* detuned celeste), and triple-reed organ voicings, plus dynamic bellows air-pressure filtering, room convolution reverb, and an optional `Sa–Pa` Shruti drone.
* **Movable Tonic (`Sa`) & Sargam Mapping:** In Hindustani music, `Sa` is relative. Changing the tonic shifts all *Mandra*, *Madhya*, and *Taar Saptak* Swara labels (`Sa, re, Re, ga, Ga, Ma, ma, Pa, dha, Dha, ni, Ni`) across the keyboard while keeping underlying MIDI pitches deterministic.
* **Three Unified Input Modes:** Play via laptop keyboard (`A–L` for natural keys, `W–P` for altered keys, `Z/X` for octave shifts), mouse clicks, or multi-touch glissando on mobile screens down to 320px wide.
* **Guided Sargam Riyaaz (Learn Mode):** Step-by-step practice for beginner *Alankars*, *Raag Bhupali*, and *Raag Yaman* phrases with reference playback, slow-tempo mode (60%), and visual next-key highlighting.
* **Song Studio & Local Library:** High-resolution melody recording (`performance.now()`), BPM/tempo scaling, note-level pitch/duration/order editing, full-melody transposition, 10-step undo stack, IndexedDB local persistence, and validated `.json` song import/export.
* **Offline-First PWA:** Installable on Android, iOS, Windows, and macOS. Once loaded once over the network, the app shell and synthesized reed banks work 100% offline.

---

## Tech Stack & Engineering Decisions

* **Frontend:** React 18, TypeScript (strict mode), Vite 5, CSS custom properties (zero runtime CSS-in-JS overhead).
* **Audio Engine:** Native browser **Web Audio API** (`AudioContext`, `AudioBufferSourceNode`, `BiquadFilterNode`, `ConvolverNode`, `DynamicsCompressorNode`).
* **Persistence:** **IndexedDB** (`surtaal_db`) for saved compositions with an automatic `localStorage` fallback if IndexedDB is blocked in private browsing modes.
* **Testing:** **Vitest** (unit & integration logic) + **Playwright** (mobile viewport overflow & E2E recording flows).

### Why Audio Is Decoupled from React State
If a keyboard press waits for a React state update and virtual DOM re-render before triggering audio, you get noticeable input jitter (16–40ms+). In SurTaal, `UnifiedInputController` calls `audioEngine.noteOn(midi)` and `MelodyRecorder.recordNoteOn()` synchronously on the native `keydown` / `pointerdown` event, and only then dispatches the visual highlight state to React.

```text
[Physical Keyboard / Touch / Mouse]
               │
               ▼
   ┌────────────────────────┐
   │ UnifiedInputController │
   └───────────┬────────────┘
               ├──► 1. HarmoniumAudioEngine.noteOn()  (Immediate Web Audio scheduling)
               ├──► 2. MelodyRecorder.recordNoteOn()  (High-res performance.now() timestamp)
               └──► 3. React UI State                 (Active key highlight & Swara badge)
```

### Canonical Composition Data Model
Every recorded note in `SongStudio` stores both:
1. `midi`: The absolute MIDI pitch (`36` to `96`).
2. `relativeOffset`: The semitone distance from the composition's `tonic` (`Madhya Sa`).

This prevents ambiguity when transposing a melody multiple times or opening a song recorded in `Kali 1 (C#)` while your current instrument is set to `Safed 2 (D)`.

---

## Project Structure

```text
surtaal/
├── e2e/                          # Playwright browser tests
├── public/
│   ├── icons/                    # PWA vector icons
│   └── audio/harmonium/          # Optional custom WAV sample directory
├── src/
│   ├── app/App.tsx               # Top-level mode router & keyboard lifecycle wiring
│   ├── features/
│   │   ├── harmonium/
│   │   │   ├── audio/            # AudioEngine, SampleBank, VoiceManager (12-voice polyphony)
│   │   │   ├── keyboard/         # Key geometry & UnifiedInputController
│   │   │   ├── music/            # Pure MIDI, frequency, and Sargam math
│   │   │   └── components/       # HarmoniumKeyboard, InstrumentControls, KeyMapModal
│   │   ├── learn/                # Alankar & Raag practice exercises + LearnMode UI
│   │   └── studio/               # MelodyRecorder, CompositionPlayer, JSON validator, SongStudio UI
│   ├── storage/                  # IndexedDB composition repo & localStorage settings repo
│   ├── styles/                   # Design tokens & 4 cultural themes
│   └── tests/                    # Vitest unit & integration test suite
├── playwright.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## Local Development Setup (Windows PowerShell + VS Code)

### Prerequisites
* **Node.js** v18.18+ or v20+ (`node -v`)
* **npm** v9+ (`npm -v`)

### 1. Install Dependencies
Open PowerShell in your project folder (`C:\SurTaaal`) and run:

```powershell
npm install
```

### 2. Start the Development Server
```powershell
npm run dev
```
Open `http://localhost:5173` in Chrome, Edge, or Firefox. Press any key on the on-screen harmonium or press `A S D F G H J K` on your laptop keyboard to unlock the browser `AudioContext` and start playing.

### 3. Run Type Checks & Unit Tests
```powershell
# Run strict TypeScript compiler checks
npm run typecheck

# Run Vitest unit & integration suite
npm run test
```

### 4. Run End-to-End Browser Tests (Playwright)
First-time setup requires installing the Chromium browser binary for Playwright:

```powershell
npx playwright install chromium
npm run test:e2e
```

### 5. Build & Preview Production Bundle
```powershell
npm run build
npm run preview
```
Vite compiles and minifies the static production bundle into the `./dist` directory and serves it locally at `http://localhost:4173`.

---

## Audio Engine & Asset Licensing

### How Sound Is Generated Out of the Box
To keep the repository lightweight, 100% offline-capable, and free of copyright restrictions, `SampleBank.ts` synthesizes phase-aligned, click-free looping `AudioBuffer` instances directly in memory on initialization (`synthesized-reed-bank` mode).

Each buffer models the harmonic series of brass free-reeds inside a wooden chamber, combining:
* **Nar (8' Base Reed):** Fundamental + 10 weighted harmonics.
* **Mada (8' Celeste Reed):** Slightly detuned secondary reed for authentic acoustic warmth.
* **Taar (4' Octave Reed):** Engaged when **Triple Reed** voicing is selected.
* **Anti-Click Envelopes:** 18ms linear attack ramp and 110ms exponential release decay, managed by a 12-voice polyphonic voice stealer (`VoiceManager.ts`).

All procedural audio synthesis code is original to this project and licensed under the MIT License.

### How to Replace the Synth Engine with Recorded WAV Samples
If you record or acquire CC0 / CC-BY licensed harmonium samples:
1. Place `.wav` files named by MIDI note number inside `public/audio/harmonium/` (for example, `60.wav` for C4, `61.wav` for C#4).
2. In `src/features/harmonium/audio/SampleBank.ts`, update `warmUp()` to `fetch('/audio/harmonium/${midi}.wav')`, pass the `ArrayBuffer` into `ctx.decodeAudioData()`, and store the resulting `AudioBuffer` in `this.bufferCache`.
3. Document the sample creator and license in `docs/AUDIO_ASSETS.md`.

---

## Storage, Privacy & Sharing Compositions

* **Zero Tracking / Zero Cloud Lock-in:** SurTaal does not use analytics, cookies, user accounts, or external API keys.
* **Where Data Lives:**
  * Theme, tonic, volume, and reed settings are stored in `localStorage` under `surtaal_preferences_v1`.
  * Recorded compositions are stored in your browser's **IndexedDB** database (`surtaal_db` -> `compositions` object store).
* **Backing Up & Sharing Songs with a Friend:**
  * Because local storage stays on your device, use **Song Studio -> Export JSON** to download your composition as a `.json` file.
  * Send the `.json` file over WhatsApp, Telegram, or email to your friend. They can open SurTaal on their device, go to **Song Studio -> Import JSON**, and play or edit your exact arrangement.
  * All imported files are strictly validated by `validateCompositionPayload()` before loading to prevent malformed pitches, negative durations, or XSS payloads.

---

## Installing as an App (PWA) & Offline Usage

SurTaal includes a Web App Manifest and Workbox Service Worker via `vite-plugin-pwa`:
* **Desktop (Chrome / Edge):** Click the **Install SurTaal** icon on the right side of the address bar to run it in a standalone window.
* **Mobile (Android Chrome / iOS Safari):** Open the deployed URL, tap **Share** (iOS) or the **three-dot menu** (Android), and select **Add to Home Screen**.
* **Offline Behavior:** After you open the deployed app at least once with an internet connection, the service worker caches the HTML, CSS, JS bundle, and icons. Subsequent launches work completely offline. *(Note: Your very first visit requires an internet connection so the browser can download the initial application bundle).*

---

## Deploying to Vercel or Netlify (Share with a Friend)

SurTaal is a static single-page application. No backend server or database setup is required.

### Option 1: Deploy via Vercel CLI (Fastest from PowerShell)
```powershell
# Run inside C:\SurTaaal
npx vercel
```
When prompted, accept the defaults:
* **Build Command:** `npm run build`
* **Output Directory:** `dist`

Once complete, run `npx vercel --prod` to get your permanent public HTTPS URL (e.g., `https://surtaal.vercel.app`) that you can share with friends.

### Option 2: Deploy via GitHub + Vercel / Netlify Dashboard
1. Push this repository to GitHub:
   ```powershell
   git init
   git add .
   git commit -m "feat: initial release of SurTaal pocket harmonium"
   git branch -M main
   git remote add origin [https://github.com/](https://github.com/)<your-username>/surtaal.git
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com) or [Netlify](https://netlify.com) and click **Add New Project -> Import Git Repository**.
3. Verify the build settings:
   * **Framework Preset:** `Vite`
   * **Build Command:** `npm run build`
   * **Publish / Output Directory:** `dist`
4. Click **Deploy**. In ~45 seconds you will receive a live shareable link.

---

## How to Extend SurTaal

### Adding a New Visual Theme
1. Open `src/styles/themes.css` and add a new `[data-theme='your-theme-id']` selector defining the CSS variables (`--bg-page`, `--wood-frame`, `--accent-primary`, etc.).
2. Add `'your-theme-id'` to the `ThemeId` union type in `src/storage/settingsRepository.ts`.
3. Add an `<option value="your-theme-id">` entry to the theme dropdown in `src/app/App.tsx`.

### Adding a New Practice Melody / Exercise
Open `src/features/learn/practiceData.ts` and append a new `PracticeExercise` object to the `PRACTICE_EXERCISES` array using relative semitone offsets from `Madhya Sa` (`0 = Sa`, `2 = Re`, `4 = Ga`, `5 = Ma`, `6 = Tivra Ma`, `7 = Pa`, `9 = Dha`, `11 = Ni`, `12 = Taar Sa`). Learn Mode will automatically render it in the exercise selector and wire up reference playback.

---

## License

MIT License. Built with care for music learners and web audio enthusiasts.