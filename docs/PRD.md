# Product Requirements Document: 3D Space Rocks

## 1. Overview

**Product Name:** 3D Space Rocks

**Summary:** A browser-based, offline-capable 3D asteroids game built with Babylon.js. The player controls a spaceship from a third-person perspective within a bounded play area, destroying asteroids across waves. Each area contains 3 waves of asteroids. Completing all 3 waves changes the arena barriers from their default color to green, signaling the player can advance to the next area where a new wave cycle begins with increased difficulty.

**Target Platform:** Modern web browsers (Chrome, Firefox, Edge, Safari)

**Offline Support:** The game must be fully playable without an internet connection after initial load, using Service Workers and local asset caching.

---

## 2. Research Findings

### 2.1 Why Babylon.js

Babylon.js is the recommended engine for this project for the following reasons:

- **WebGL/WebGPU Rendering:** Babylon.js supports both WebGL 2.0 and WebGPU, providing high-performance 3D rendering directly in the browser without plugins.
- **Built-in Physics:** Integrates with physics engines (Havok, Cannon.js, Ammo.js). For offline bundling and simplicity, **Cannon.js** (via `cannon-es`) is recommended as it is lightweight and can be fully bundled.
- **Camera System:** Babylon.js provides `ArcRotateCamera` and `FollowCamera` out of the box, both suitable for third-person perspectives. `FollowCamera` is ideal as it automatically tracks a target mesh with configurable radius, height offset, and rotation offset.
- **Particle System:** Built-in GPU particle system for explosions, thruster effects, and debris.
- **Material System:** PBR and Standard materials with emissive, diffuse, and alpha properties — needed for glowing barriers and color transitions.
- **Sound Engine:** Built-in `Sound` class for spatial audio, supporting `.mp3`, `.wav`, and `.ogg` formats.
- **Asset Management:** `AssetsManager` and `SceneLoader` for preloading all assets before gameplay begins.
- **Tree Shaking:** The `@babylonjs/core` ES module package supports tree shaking, keeping bundle size manageable for offline caching.

### 2.2 Third-Person Camera Analysis

| Camera Type | Pros | Cons | Recommendation |
|---|---|---|---|
| `FollowCamera` | Auto-tracks target, smooth follow, configurable distance/height | Less manual control over cinematic angles | **Best for gameplay** — provides smooth, predictable tracking |
| `ArcRotateCamera` | Orbital control, zoom support | Requires manual target updates, player-controlled rotation can disorient | Good for menus or debug views |
| Custom Camera Rig | Full control over behavior | More development effort | Use if FollowCamera doesn't meet needs |

**Decision:** Use `FollowCamera` as the primary gameplay camera. Configure it with:
- `radius`: 20 units behind the ship
- `heightOffset`: 8 units above the ship
- `rotationOffset`: 180 degrees (behind the ship)
- `cameraAcceleration`: 0.05 (smooth follow, not instant)
- `maxCameraSpeed`: 10

### 2.3 Offline Play Strategy

For full offline capability:

1. **Service Worker:** Register a service worker that caches all HTML, JS, CSS, and game assets (models, textures, sounds) using a cache-first strategy.
2. **Bundling:** Use a bundler (Vite recommended) to produce a single-page application with all assets inlined or referenced from a local `/assets` directory.
3. **No External CDN Dependencies at Runtime:** All Babylon.js modules and dependencies must be bundled into the application. Do not use CDN `<script>` tags for production.
4. **Web App Manifest:** Include a `manifest.json` to allow the game to be installed as a Progressive Web App (PWA).

### 2.4 Gameplay Best Practices for Arcade-Style 3D Games

Based on established game design principles:

- **Immediate Feedback:** Every player action (shooting, being hit, destroying an asteroid) must have visual and audio feedback within 100ms.
- **Progressive Difficulty:** Each area should increase asteroid count, speed, and introduce new asteroid sizes.
- **Clear Visual Communication:** Barrier color changes, wave counters, and health indicators must be immediately readable.
- **Forgiving Controls:** Ship movement should feel responsive but not twitchy. Use acceleration/deceleration rather than instant velocity changes.
- **Respawn Grace Period:** After taking damage, provide a brief invulnerability window (1.5 seconds) with a visual flashing effect.
- **Screen Shake:** Subtle camera shake on impacts to increase game feel.
- **Consistent Physics:** All objects should behave predictably. Asteroids should have consistent mass-based collision responses.
- **Minimalist HUD:** Show only essential information — wave number, health/lives, score. Don't clutter the viewport.

---

## 3. Game Concept

### 3.1 Core Loop

```
Start Game
  → Enter Area 1 (barriers are default color)
    → Wave 1: Destroy all asteroids
    → Wave 2: Destroy all asteroids (more/faster)
    → Wave 3: Destroy all asteroids (most challenging)
    → All waves complete → Barriers turn GREEN
    → Player flies through the green barrier exit to next area
  → Enter Area 2 (barriers reset to default color, difficulty increases)
    → Waves 1-3 repeat with higher difficulty
  → Continue for subsequent areas...
```

### 3.2 Win/Lose Conditions

- **Wave Complete:** All asteroids in the current wave are destroyed.
- **Area Complete:** All 3 waves in the current area are cleared. Barriers turn green. An exit opening appears or the barriers become passable.
- **Game Over:** Player loses all lives (3 lives by default).
- **Victory / Endless:** The game can define a set number of areas for a win condition, or continue endlessly with scaling difficulty. **Recommendation:** Start with 3 areas (9 total waves) as a complete game session, with a victory screen after Area 3.

---

## 4. Technical Architecture

### 4.1 Technology Stack

| Component | Technology | Version / Notes |
|---|---|---|
| Game Engine | Babylon.js (`@babylonjs/core`) | ^7.0 (latest stable) |
| Physics | Cannon.js (via `cannon-es`) | Lightweight, fully offline-bundleable |
| Language | TypeScript | Strict mode for type safety |
| Bundler | Vite | Fast dev server, optimized production builds |
| Offline | Service Worker + Cache API | Cache-first strategy |
| PWA | Web App Manifest | Installable on desktop and mobile |
| Package Manager | npm | Standard Node.js package management |

### 4.2 Project Structure

```
3d-space-rocks/
├── public/
│   ├── assets/
│   │   ├── models/          # .glb or .babylon mesh files
│   │   ├── textures/        # Skybox, asteroid textures
│   │   └── sounds/          # SFX and music (.mp3 or .ogg)
│   ├── manifest.json        # PWA manifest
│   └── sw.js                # Service Worker
├── src/
│   ├── main.ts              # Entry point, engine + scene init
│   ├── game/
│   │   ├── Game.ts          # Main game state machine
│   │   ├── Player.ts        # Ship mesh, movement, shooting
│   │   ├── Asteroid.ts      # Asteroid entity (sizes, health, splitting)
│   │   ├── Projectile.ts    # Bullet/laser entity
│   │   ├── Arena.ts         # Play area barriers, color transitions
│   │   ├── WaveManager.ts   # Wave spawning, progression, area transitions
│   │   └── HUD.ts           # UI overlay (score, lives, wave info)
│   ├── systems/
│   │   ├── InputManager.ts  # Keyboard/gamepad input handling
│   │   ├── PhysicsSetup.ts  # Physics engine initialization
│   │   ├── AudioManager.ts  # Sound loading and playback
│   │   └── CameraSetup.ts   # FollowCamera configuration
│   └── utils/
│       ├── Constants.ts     # Game balance constants
│       └── MathHelpers.ts   # Utility math functions
├── index.html               # Single-page entry
├── tsconfig.json
├── vite.config.ts
├── package.json
└── docs/
    └── PRD.md               # This document
```

### 4.3 Key Babylon.js APIs to Use

| Feature | Babylon.js API |
|---|---|
| Engine Setup | `new Engine(canvas, true)` |
| Scene | `new Scene(engine)` |
| Camera | `new FollowCamera("camera", startPos, scene)` |
| Ship Mesh | `MeshBuilder.CreateBox` or imported `.glb` model |
| Asteroids | `MeshBuilder.CreateIcoSphere` with random vertex displacement |
| Barriers | `MeshBuilder.CreateBox` (thin wall meshes) with `StandardMaterial` |
| Barrier Glow | `StandardMaterial.emissiveColor` for color transitions |
| Physics | `CannonJSPlugin` + `PhysicsImpostor` on all interactive meshes |
| Collisions | `mesh.physicsImpostor.registerOnPhysicsCollide()` |
| Particles | `ParticleSystem` for explosions and thruster effects |
| Skybox | `MeshBuilder.CreateBox` with `CubeTexture` and `BackFaceCulling = false` |
| HUD | Babylon.js GUI (`@babylonjs/gui`) `AdvancedDynamicTexture.CreateFullscreenUI` |
| Sound | `new Sound("name", "url", scene, onReady, options)` |
| Asset Loading | `AssetsManager` for preloading all assets with a loading screen |

---

## 5. Functional Requirements

### 5.1 Player Ship

| ID | Requirement | Priority |
|---|---|---|
| P-01 | The player controls a spaceship rendered as a 3D mesh | Must |
| P-02 | Ship movement uses thrust-based forward acceleration (W or Up Arrow) | Must |
| P-03 | Ship rotates left/right using A/D or Left/Right Arrow keys | Must |
| P-04 | Ship can pitch up/down for vertical movement in 3D space | Should |
| P-05 | Ship fires projectiles forward on Spacebar press | Must |
| P-06 | Ship has a visible thruster particle effect when accelerating | Should |
| P-07 | Ship has 3 lives by default | Must |
| P-08 | Ship becomes briefly invulnerable (1.5s) after taking damage, with a flashing visual effect | Must |
| P-09 | Ship has a maximum velocity cap to prevent uncontrollable speeds | Must |
| P-10 | Ship experiences gradual deceleration (drag) when not accelerating | Must |

### 5.2 Asteroids

| ID | Requirement | Priority |
|---|---|---|
| A-01 | Asteroids are 3D meshes (icospheres with vertex noise for irregular shapes) | Must |
| A-02 | Asteroids come in 3 sizes: Large, Medium, Small | Must |
| A-03 | Destroying a Large asteroid spawns 2 Medium asteroids | Must |
| A-04 | Destroying a Medium asteroid spawns 2 Small asteroids | Must |
| A-05 | Destroying a Small asteroid removes it completely | Must |
| A-06 | Asteroids rotate slowly on random axes for visual interest | Should |
| A-07 | Asteroids move in random directions at spawn with constant velocity | Must |
| A-08 | Asteroids bounce off arena barriers | Must |
| A-09 | Asteroid-player collision causes the player to lose a life | Must |
| A-10 | Asteroid destruction triggers a particle explosion effect | Should |

### 5.3 Play Area / Arena

| ID | Requirement | Priority |
|---|---|---|
| AR-01 | The play area is a rectangular 3D box (e.g., 200 × 200 × 100 units) | Must |
| AR-02 | The arena is bounded by 6 visible, semi-transparent barrier walls (top, bottom, left, right, front, back) | Must |
| AR-03 | Barriers use `StandardMaterial` with configurable `diffuseColor`, `emissiveColor`, and `alpha` | Must |
| AR-04 | Default barrier color is a neutral/warning color (e.g., red-orange, `#FF4500`) | Must |
| AR-05 | When all 3 waves are cleared, barrier color transitions to green (`#00FF00`) over 1 second | Must |
| AR-06 | After barriers turn green, an exit zone or gate appears on one wall | Must |
| AR-07 | The player flying through the exit triggers the transition to the next area | Must |
| AR-08 | Barriers are opaque enough to be clearly visible but allow the player to see the space environment beyond them faintly | Must |
| AR-09 | Barriers have a subtle pulsing glow effect to make them feel active/energized | Should |
| AR-10 | Arena dimensions may increase slightly in later areas to accommodate more asteroids | Could |

### 5.4 Wave System

| ID | Requirement | Priority |
|---|---|---|
| W-01 | Each area consists of exactly 3 waves | Must |
| W-02 | A wave begins by spawning a set number of Large asteroids at random positions away from the player | Must |
| W-03 | A wave is complete when all asteroids (including split children) are destroyed | Must |
| W-04 | Between waves, display a "Wave X Complete" message for 2 seconds | Must |
| W-05 | After wave 3 of an area, display "Area Complete" and transition barriers to green | Must |
| W-06 | Wave difficulty progression (suggested starting values): | Must |

**Wave Difficulty Table (Area 1 baseline):**

| Wave | Large Asteroids | Asteroid Speed Multiplier |
|---|---|---|
| 1 | 3 | 1.0× |
| 2 | 5 | 1.15× |
| 3 | 7 | 1.3× |

**Area Scaling:** Each subsequent area multiplies asteroid count by 1.25× (rounded) and speed by an additional 1.1×.

| ID | Requirement | Priority |
|---|---|---|
| W-07 | Area transition: when the player enters the exit zone, fade to black, reset arena, reset barriers to default color, start wave 1 of the next area | Must |
| W-08 | Display current area number and wave number in the HUD | Must |

### 5.5 Camera

| ID | Requirement | Priority |
|---|---|---|
| C-01 | The game uses a third-person camera positioned behind and above the player ship | Must |
| C-02 | Camera follows the ship smoothly with configurable acceleration (not instant snapping) | Must |
| C-03 | Camera automatically rotates to match the ship's orientation | Must |
| C-04 | Camera parameters: radius ~20, height offset ~8, rotation offset 180° | Should |
| C-05 | Subtle camera shake effect on player damage and large explosions | Should |

### 5.6 Scoring

| ID | Requirement | Priority |
|---|---|---|
| S-01 | Small asteroid destroyed: 100 points | Must |
| S-02 | Medium asteroid destroyed: 50 points | Must |
| S-03 | Large asteroid destroyed: 25 points | Must |
| S-04 | Wave completion bonus: 500 × wave number | Should |
| S-05 | Area completion bonus: 2000 × area number | Should |
| S-06 | Score is displayed in the HUD at all times | Must |
| S-07 | High score is persisted in `localStorage` | Should |

### 5.7 HUD / UI

| ID | Requirement | Priority |
|---|---|---|
| H-01 | Fullscreen Babylon.js GUI overlay using `AdvancedDynamicTexture` | Must |
| H-02 | Display: Score (top-left), Lives (top-right), Wave/Area (top-center) | Must |
| H-03 | Start screen with game title and "Press ENTER to Start" prompt | Must |
| H-04 | Game Over screen with final score and "Press ENTER to Restart" | Must |
| H-05 | Victory screen after completing the final area | Must |
| H-06 | Wave transition overlay ("Wave X", "Area Complete") | Must |
| H-07 | Loading progress bar during asset preloading | Should |
| H-08 | Pause menu on Escape key with Resume and Restart options | Should |

### 5.8 Audio

| ID | Requirement | Priority |
|---|---|---|
| AU-01 | Thruster sound when accelerating (looped) | Should |
| AU-02 | Shooting sound effect on each projectile fired | Should |
| AU-03 | Explosion sound on asteroid destruction | Should |
| AU-04 | Player damage / death sound | Should |
| AU-05 | Wave complete jingle | Could |
| AU-06 | Background ambient space music (looped) | Could |
| AU-07 | All audio files bundled locally for offline play | Must (if audio is implemented) |

### 5.9 Offline / PWA

| ID | Requirement | Priority |
|---|---|---|
| O-01 | A Service Worker caches all application files on first load | Must |
| O-02 | The game is fully playable after going offline | Must |
| O-03 | A `manifest.json` enables "Add to Home Screen" / PWA install | Should |
| O-04 | Cache versioning strategy to allow updates when online | Should |

---

## 6. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NF-01 | Maintain 60 FPS on mid-range hardware (e.g., integrated GPU from 2020+) | Must |
| NF-02 | Total bundled asset size should be under 15 MB for fast caching | Should |
| NF-03 | Initial load time under 5 seconds on broadband | Should |
| NF-04 | Game window is responsive and fills the browser viewport | Must |
| NF-05 | Works in latest versions of Chrome, Firefox, Edge, and Safari | Must |
| NF-06 | No runtime errors or unhandled promise rejections during normal gameplay | Must |
| NF-07 | TypeScript strict mode with no `any` types in game logic | Should |

---

## 7. Controls

| Action | Keyboard | Gamepad (if supported) |
|---|---|---|
| Thrust Forward | W / Up Arrow | Left Stick Up / Right Trigger |
| Rotate Left | A / Left Arrow | Left Stick Left |
| Rotate Right | D / Right Arrow | Left Stick Right |
| Pitch Up | Shift + W (or R) | Left Stick Up + Modifier |
| Pitch Down | Shift + S (or F) | Left Stick Down + Modifier |
| Fire | Spacebar | A Button |
| Pause | Escape | Start Button |

Gamepad support is a **Could** priority. Keyboard controls are **Must**.

---

## 8. Visual Style

- **Space Environment:** Dark skybox with stars. Optionally a subtle nebula texture.
- **Ship:** Simple geometric mesh (low-poly wedge/arrow shape) or a loaded `.glb` model. Glowing thruster at the rear.
- **Asteroids:** Irregular icospheres with a rocky gray-brown texture or procedural vertex coloring. Subtle bump map if performance allows.
- **Barriers:** Semi-transparent colored walls with emissive glow. Default color: red-orange. Complete color: green. Should feel like energy shields/force fields.
- **Projectiles:** Small glowing elongated meshes (capsule or cylinder) with emissive material in a bright color (cyan or yellow).
- **Explosions:** Particle systems with bright flashes fading to orange/red, then dissipating. Particle count kept reasonable for performance.

---

## 9. Game State Machine

```
[LOADING] → [MENU] → [PLAYING] → [WAVE_TRANSITION] → [PLAYING] → ...
                                → [AREA_COMPLETE] → [AREA_TRANSITION] → [PLAYING]
                                → [GAME_OVER] → [MENU]
                                → [VICTORY] → [MENU]
              [PLAYING] → [PAUSED] → [PLAYING]
```

| State | Description |
|---|---|
| `LOADING` | Assets being preloaded. Show progress bar. |
| `MENU` | Title screen. Awaiting player input to start. |
| `PLAYING` | Active gameplay. Player can move, shoot, and interact. |
| `WAVE_TRANSITION` | Brief pause between waves. Show wave completion message. |
| `AREA_COMPLETE` | All 3 waves cleared. Barriers turn green. Exit opens. Player must fly to exit. |
| `AREA_TRANSITION` | Fade to black, reset arena, load next area. |
| `PAUSED` | Game paused. Show pause menu. |
| `GAME_OVER` | Player has 0 lives. Show score and restart option. |
| `VICTORY` | Player completed the final area. Show victory screen. |

---

## 10. Implementation Phases

### Phase 1: Foundation
- [ ] Initialize Vite + TypeScript project with Babylon.js dependencies
- [ ] Set up basic scene: engine, canvas, skybox, lighting
- [ ] Implement `FollowCamera` for third-person view
- [ ] Create player ship mesh with keyboard movement (thrust, rotate)
- [ ] Implement arena with 6 barrier walls and basic collision

### Phase 2: Core Gameplay
- [ ] Add physics engine (Cannon.js) integration
- [ ] Create asteroid meshes with random shapes and movement
- [ ] Implement projectile firing and asteroid-projectile collision
- [ ] Implement asteroid splitting (Large → Medium → Small)
- [ ] Add player-asteroid collision and life system
- [ ] Implement scoring system

### Phase 3: Wave & Area System
- [ ] Build `WaveManager` with 3-wave-per-area logic
- [ ] Implement wave spawn parameters and difficulty scaling
- [ ] Implement barrier color transition (default → green) on area completion
- [ ] Create exit zone mechanic after area completion
- [ ] Implement area transition (fade, reset, new area)

### Phase 4: UI & Polish
- [ ] Build HUD with Babylon.js GUI (score, lives, wave/area display)
- [ ] Create menu, game over, and victory screens
- [ ] Add particle effects (explosions, thruster)
- [ ] Add camera shake on impacts
- [ ] Add invulnerability flash effect on player damage
- [ ] Add sound effects and background music

### Phase 5: Offline & Distribution
- [ ] Create Service Worker with cache-first strategy
- [ ] Create `manifest.json` for PWA support
- [ ] Optimize bundle size (tree shaking, asset compression)
- [ ] Test offline functionality
- [ ] Cross-browser testing

---

## 11. Acceptance Criteria

The game is considered complete when:

1. **Playable:** The player can control a ship in third-person view, shoot projectiles, and destroy asteroids.
2. **Waves Work:** Each area has exactly 3 waves with increasing numbers of asteroids.
3. **Barrier System:** Arena barriers are visible and opaque. They change to green when all 3 waves in an area are completed.
4. **Area Progression:** After barriers turn green, an exit is available. Flying through it loads the next area with reset barriers and harder waves.
5. **Offline:** After the first load, the game is fully functional without an internet connection.
6. **Performance:** The game runs at 60 FPS on target hardware.
7. **No Crashes:** No runtime errors during normal play sessions.

---

## 12. Open Questions

| # | Question | Default Assumption |
|---|---|---|
| 1 | How many total areas before victory? | 3 areas (9 waves total) |
| 2 | Should the ship have a health bar or a lives system? | Lives system (3 lives) |
| 3 | Should asteroids have textures or be procedurally colored? | Procedurally colored (simpler, smaller bundle) |
| 4 | Should there be power-ups? | No — keep scope minimal for v1 |
| 5 | Should the ship model be custom or geometric primitives? | Geometric primitives for v1, model import as enhancement |
| 6 | Fire rate limiting on projectiles? | Yes, 200ms cooldown between shots |
| 7 | Maximum number of projectiles on screen? | 10 active projectiles |

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Area** | A play session containing 3 waves. Each area has its own arena instance with barriers. |
| **Wave** | A single round of asteroids that must be fully destroyed to progress. |
| **Barrier** | A visible wall bounding the play area. Changes color to indicate area completion. |
| **Exit Zone** | A region on one barrier wall that becomes passable after all waves are cleared, allowing the player to transition to the next area. |
| **Asteroid Splitting** | The mechanic where destroying a larger asteroid spawns smaller ones. |
| **Invulnerability Frame (i-frame)** | A brief period after taking damage where the player cannot be hit again. |
