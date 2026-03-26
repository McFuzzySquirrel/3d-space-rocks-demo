<div align="center">
  <img src="docs/3D Space Rocks title screen.png" alt="3D Space Rocks" width="600" />
</div>

# 3D Space Rocks

A browser-based, offline-capable 3D asteroids game built with [Babylon.js](https://www.babylonjs.com/). Control a spaceship in third-person, blast geometric asteroids across waves, and fly through the barrier exit to reach the next area — all installable and fully playable with no internet connection.

For the behind-the-scenes story of how the agent team built the project, see [docs/agent-journey-story.md](docs/agent-journey-story.md).

[![Built with Babylon.js](https://img.shields.io/badge/Babylon.js-8.x-e0712b?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyTDIgN2wxMCA1IDEwLTV6TTIgMTdsOSA1IDktNS05LTR6Ii8+PC9zdmc+&logoColor=white)](https://www.babylonjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-offline--capable-5a0fc8?logo=googlechrome&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)

---

## Overview

3D Space Rocks is a modern take on the classic Asteroids arcade game, rendered in full 3D using Babylon.js. Each play session consists of 3 areas, each with 3 waves of asteroids. Clear all 3 waves to turn the arena barriers green and fly through the exit to advance.

**Key features:**
- Third-person spaceship controls with mouse-aim rotation and keyboard thrust
- 6 randomised geometric asteroid shapes with procedural vertex displacement
- Classic splitting mechanic: Large → 2 Medium → 2 Small
- Progressive difficulty: more asteroids, faster speeds in each area
- Fully offline-capable as a PWA (installable from the browser)
- Procedural space backdrop with stars, distant planets, and nebula glow
- Camera shake, invulnerability frames, and particle explosion feedback

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm 10+

### Install and run

```bash
git clone https://github.com/McFuzzySquirrel/3d-space-rocks-demo.git
cd 3d-space-rocks-demo
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser, then press **Enter** to start.

### Production build

```bash
npm run build       # type-check + Vite production build
npm run preview     # preview the built app locally
npm run check:bundle  # verify bundle stays within the 15 MB cache budget
```

---

## Controls

| Action | Input |
|---|---|
| Thrust forward | `W` / `↑` |
| Thrust backward | `S` / `↓` |
| Rotate / pitch | Hold **left mouse button** and move mouse |
| Fire | `Spacebar` |
| Pause | `Escape` |

> **Tip:** Hold the mouse button and drag to aim the ship, then release to lock orientation and thrust in that direction.

---

## Gameplay

```
Start → Area 1
  Wave 1 → Wave 2 → Wave 3 (clear all asteroids)
  → Barriers turn green → Fly through exit
→ Area 2 (faster, more asteroids)
  → ...
→ Area 3 complete → Victory
```

- **Lives:** 3 lives. Asteroid impact removes one life and grants ~1.5 s of invulnerability.
- **Scoring:** Small = 100 pts · Medium = 50 pts · Large = 25 pts + wave/area bonuses
- **High score** is saved in `localStorage` between sessions.

---

## Technology Stack

| Layer | Technology |
|---|---|
| 3D Engine | [Babylon.js](https://www.babylonjs.com/) 8.x (`@babylonjs/core` + `@babylonjs/gui`) |
| Physics | [cannon-es](https://github.com/pmndrs/cannon-es) 0.20 |
| Language | TypeScript 5.x (strict mode) |
| Bundler | Vite 8.x |
| Offline | Service Worker (cache-first) + Web App Manifest |

---

## Project Structure

```
src/
├── main.ts              # Entry point — engine, scene, PWA registration
├── game/
│   ├── Game.ts          # State machine and main game loop
│   ├── Player.ts        # Ship mesh, movement, shooting, lives
│   ├── Asteroid.ts      # Entity lifecycle, splitting, physics
│   ├── Arena.ts         # Barrier walls, exit zone, transitions
│   ├── WaveManager.ts   # Wave spawning and progression
│   ├── SceneFactory.ts  # Backdrop stars, planets, nebula
│   └── HUD.ts           # Babylon GUI — score, lives, menus
├── systems/
│   ├── AssetLoader.ts   # Preload all assets before gameplay
│   ├── AudioManager.ts  # SFX and background audio
│   └── CameraSetup.ts   # FollowCamera configuration
└── utils/
    ├── Constants.ts     # All game-balance and config values
    └── MeshFactory.ts   # Procedural asteroid and projectile meshes

public/
├── sw.js                # Service Worker (cache-first, versioned)
├── manifest.webmanifest # PWA manifest
└── icons/               # App icons (SVG, PNG, maskable)

docs/
└── PRD.md               # Full product requirements document
```

---

## Offline / PWA Support

The game registers a versioned Service Worker on first load that caches all app shell files, built assets, and icons using a **cache-first** strategy. After the initial visit, the game runs entirely from cache with no network dependency.

To test offline behaviour, see [docs/offline-test-plan.md](docs/offline-test-plan.md).

> [!NOTE]
> The Service Worker only activates in production builds served over HTTPS (or localhost). Running `npm run dev` uses the live Vite server without caching.

---

## Documentation

- [Agent Journey Story](docs/agent-journey-story.md) — Narrative retrospective of how the agents collaborated, what they decided, and what to learn from the process
- [Product Requirements Document](docs/PRD.md) — Full game spec, architecture, and requirements
- [Offline Test Plan](docs/offline-test-plan.md)
- [Performance & Offline Checklist](docs/perf-offline-checklist.md)
- [Cross-Browser Test Matrix](docs/test-matrix.md)
