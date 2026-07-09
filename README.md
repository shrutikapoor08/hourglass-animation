# Pixel Hourglass Timer

A retro pixel-art hourglass timer built with React, Vite, and GSAP. Pick a duration (30 seconds, 5 minutes, or a Pomodoro-style 25 minutes) and watch the sand drain from the top bulb to the bottom in chunky, grid-snapped pixels — complete with a dotted falling stream, tumbling grains, a crater that deepens as the top bulb empties, and a growing pile below. When the sand runs out, the glass flips itself over and starts again.

<img width="743" height="704" alt="Screenshot 2026-07-09 at 3 28 48 PM" src="https://github.com/user-attachments/assets/018672bd-acaf-4280-ad14-db222336f0dc" />

## Features

- **Three preset durations** — 30s, 5 min, and 25 min timer chips
- **Countdown clock** — a live `MM:SS` readout below the glass
- **Start / Pause / Resume** controls, plus a **Flip & restart** button
- **Auto-flip** — when the timer finishes, the hourglass rotates 180° and restarts on its own
- **Pixel-art animation** — everything snaps to a 12px grid and animates with stepped GSAP easing for an authentic sprite-like feel
- **Respects `prefers-reduced-motion`** — decorative grain animations are disabled for users who opt out of motion

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Scripts

| Command           | What it does                     |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start the Vite dev server        |
| `npm run build`   | Build for production into `dist` |
| `npm run preview` | Preview the production build     |
| `npm run lint`    | Run ESLint                       |

## Tech stack

- [React 19](https://react.dev/) for the UI
- [GSAP](https://gsap.com/) for the sand, grain, and flip animations
- [Vite](https://vite.dev/) for dev server and bundling
- Hand-built SVG rendering — the hourglass is drawn as grid-quantized SVG paths, no sprite images
