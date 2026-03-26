# Product Requirements Document: 3D Space Rocks

## 1. Overview

**Product Name:** 3D Space Rocks

**Summary:** A browser-based, offline-capable 3D asteroids game built with Babylon.js. The player controls a spaceship from a third-person perspective within a bounded play area, destroying asteroids across waves. Each area contains 3 waves of asteroids. Completing all 3 waves changes the arena barriers from their default color to green, signaling the player can advance to the next area where a new wave cycle begins with increased difficulty.

**Target Platform:** Modern web browsers (Chrome, Firefox, Edge, Safari)

**Offline Support:** The game must be fully playable without an internet connection after initial load, using Service Workers and local asset caching.

---

## 2. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-01 | — | Initial PRD created with core game concept, technical architecture, and requirements |
| 1.1 | 2026-03-13 | — | Added best-practice sections: version history, goals/non-goals, personas, security, accessibility, testing strategy, analytics, dependencies/risks, future considerations |
| 1.2 | 2026-03-19 | — | Updated controls to mouse-hold-to-rotate scheme; added mouse pitch/yaw; updated asteroid visual requirements to random geometric shapes; updated visual style with transparent barriers, backdrop environment, playful ship design; relaxed Non-Goals mobile note |

---

## 3. Goals and Non-Goals

### 3.1 Goals

- Deliver a fun, replayable arcade-style 3D asteroids game playable entirely in the browser
- Support fully offline play after first load via PWA / Service Worker caching
- Demonstrate Babylon.js capabilities for browser-based 3D game development
- Provide a clear progression system (waves → areas) with increasing difficulty
- Maintain 60 FPS performance on mid-range hardware

### 3.2 Non-Goals

- **Multiplayer:** No networked or local multiplayer support in v1
- **Mobile touch controls:** Touchscreen input is not targeted for v1 (keyboard only)
- **User accounts or cloud saves:** No server-side persistence; high scores are local only
- **Level editor or modding support:** Not in scope for the initial release
- **Monetization:** No ads, in-app purchases, or premium features
- **Narrative or story mode:** The game is purely arcade-style with no storyline

---

## 4. User Stories / Personas

### 4.1 Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Casual Gamer (Alex)** | Plays browser games during breaks. Values quick sessions and simple controls. | Fast load time, intuitive controls, satisfying feedback, short play sessions (5–15 min) |
| **Retro Enthusiast (Sam)** | Loves classic arcade games like Asteroids. Appreciates modern takes on retro concepts. | Faithful asteroid-splitting mechanics, score chasing, progressive difficulty |
| **Offline User (Jordan)** | Has unreliable or no internet access after initial visit. Wants games that work anywhere. | Full offline play, PWA install, no dependency on network after first load |

### 4.2 User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-01 | Casual Gamer | Start playing within seconds of opening the page | I don't lose interest waiting for loads | Must |
| US-02 | Casual Gamer | Understand the controls without a tutorial | I can jump right into the action | Must |
| US-03 | Retro Enthusiast | See asteroids split into smaller pieces when destroyed | The classic mechanic feels satisfying and strategic | Must |
| US-04 | Retro Enthusiast | Track my high score across sessions | I have a reason to replay and improve | Should |
| US-05 | Offline User | Install the game as a PWA on my device | I can play it like a native app without a browser tab | Should |
| US-06 | Offline User | Play the game with no internet connection | I can enjoy the game on planes, commutes, or in low-connectivity areas | Must |
| US-07 | Any Player | See clear visual feedback when I destroy an asteroid or take damage | I always know what's happening in the game | Must |
| US-08 | Any Player | Progress through increasingly difficult areas | The game stays challenging and engaging over time | Must |

---

## 5. Research Findings

### 5.1 Why Babylon.js

Babylon.js is the recommended engine for this project for the following reasons:

- **WebGL/WebGPU Rendering:** Babylon.js supports both WebGL 2.0 and WebGPU, providing high-performance 3D rendering directly in the browser without plugins.
- **Built-in Physics:** Integrates with physics engines (Havok, Cannon.js, Ammo.js). For offline bundling and simplicity, **Cannon.js** (via `cannon-es`) is recommended as it is lightweight and can be fully bundled.
- **Camera System:** Babylon.js provides `ArcRotateCamera` and `FollowCamera` out of the box, both suitable for third-person perspectives. `FollowCamera` is ideal as it automatically tracks a target mesh with configurable radius, height offset, and rotation offset.
- **Particle System:** Built-in GPU particle system for explosions, thruster effects, and debris.
- **Material System:** PBR and Standard materials with emissive, diffuse, and alpha properties — needed for glowing barriers and color transitions.
- **Sound Engine:** Built-in `Sound` class for spatial audio, supporting `.mp3`, `.wav`, and `.ogg` formats.
- **Asset Management:** `AssetsManager` and `SceneLoader` for preloading all assets before gameplay begins.
- **Tree Shaking:** The `@babylonjs/core` ES module package supports tree shaking, keeping bundle size manageable for offline caching.

### 5.2 Third-Person Camera Analysis

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

### 5.3 Offline Play Strategy

For full offline capability:

1. **Service Worker:** Register a service worker that caches all HTML, JS, CSS, and game assets (models, textures, sounds) using a cache-first strategy.
2. **Bundling:** Use a bundler (Vite recommended) to produce a single-page application with all assets inlined or referenced from a local `/assets` directory.
3. **No External CDN Dependencies at Runtime:** All Babylon.js modules and dependencies must be bundled into the application. Do not use CDN `<script>` tags for production.
4. **Web App Manifest:** Include a `manifest.json` to allow the game to be installed as a Progressive Web App (PWA).

### 5.4 Gameplay Best Practices for Arcade-Style 3D Games

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

## 6. Game Concept

### 6.1 Core Loop

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

### 6.2 Win/Lose Conditions

- **Wave Complete:** All asteroids in the current wave are destroyed.
- **Area Complete:** All 3 waves in the current area are cleared. Barriers turn green. An exit opening appears or the barriers become passable.
- **Game Over:** Player loses all lives (3 lives by default).
- **Victory / Endless:** The game can define a set number of areas for a win condition, or continue endlessly with scaling difficulty. **Recommendation:** Start with 3 areas (9 total waves) as a complete game session, with a victory screen after Area 3.

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology | Version / Notes |
|---|---|---|
| Game Engine | Babylon.js (`@babylonjs/core`) | ^7.0 (latest stable) |
| Physics | Cannon.js (via `cannon-es`) | Lightweight, fully offline-bundleable |
| Language | TypeScript | Strict mode for type safety |
| Bundler | Vite | Fast dev server, optimized production builds |
| Offline | Service Worker + Cache API | Cache-first strategy |
| PWA | Web App Manifest | Installable on desktop and mobile |
| Package Manager | npm | Standard Node.js package management |

### 7.2 Project Structure

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

### 7.3 Key Babylon.js APIs to Use

| Feature | Babylon.js API |
|---|---|
| Engine Setup | `new Engine(canvas, true)` |
| Scene | `new Scene(engine)` |
| Camera | `new FollowCamera("camera", startPos, scene)` |
| Ship Mesh | `MeshBuilder.CreateBox` / `CreateCylinder` / `CreateSphere` composited for cockpit + hull + wings |
| Asteroids | Random pick from `MeshBuilder.CreateIcoSphere`, `CreateBox`, `CreatePolyhedron` (types 0/1/2), `CreateCylinder` with procedural vertex displacement noise per asteroid |
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

## 8. Functional Requirements

### 8.1 Player Ship

| ID | Requirement | Priority |
|---|---|---|
| P-01 | The player controls a spaceship rendered as a 3D mesh | Must |
| P-02 | Ship movement uses thrust-based forward/backward acceleration (W/Up Arrow or hold mouse button to aim then thrust) | Must |
| P-03 | Ship rotates left/right and pitches up/down using mouse while mouse button is held | Must |
| P-04 | Releasing the mouse button locks the ship orientation; movement continues until thrust is released | Should |
| P-05 | Ship fires projectiles forward on Spacebar press | Must |
| P-06 | Ship has a visible thruster particle effect when accelerating | Should |
| P-07 | Ship has 3 lives by default | Must |
| P-08 | Ship becomes briefly invulnerable (1.5s) after taking damage, with a flashing visual effect | Must |
| P-09 | Ship has a maximum velocity cap to prevent uncontrollable speeds | Must |
| P-10 | Ship experiences gradual deceleration (drag) when not accelerating | Must |

### 8.2 Asteroids

| ID | Requirement | Priority |
|---|---|---|
| A-01 | Asteroids are 3D meshes rendered as one of several random geometric shapes (icosphere, box, tetrahedron, octahedron, dodecahedron, low-poly prism) with procedural vertex displacement noise applied for a worn, irregular appearance | Must |
| A-02 | Asteroids come in 3 sizes: Large, Medium, Small | Must |
| A-03 | Destroying a Large asteroid spawns 2 Medium asteroids | Must |
| A-04 | Destroying a Medium asteroid spawns 2 Small asteroids | Must |
| A-05 | Destroying a Small asteroid removes it completely | Must |
| A-06 | Asteroids rotate slowly on random axes for visual interest | Should |
| A-07 | Asteroids move in random directions at spawn with constant velocity | Must |
| A-08 | Asteroids bounce off arena barriers | Must |
| A-09 | Asteroid-player collision causes the player to lose a life | Must |
| A-10 | Asteroid destruction triggers a particle explosion effect | Should |

### 8.3 Play Area / Arena

| ID | Requirement | Priority |
|---|---|---|
| AR-01 | The play area is a rectangular 3D box (e.g., 200 × 200 × 100 units) | Must |
| AR-02 | The arena is bounded by 6 visible, semi-transparent barrier walls (top, bottom, left, right, front, back) | Must |
| AR-03 | Barriers use `StandardMaterial` with configurable `diffuseColor`, `emissiveColor`, and `alpha` | Must |
| AR-04 | Default barrier color is a neutral/warning color (e.g., red-orange, `#FF4500`) | Must |
| AR-05 | When all 3 waves are cleared, barrier color transitions to green (`#00FF00`) over 1 second | Must |
| AR-06 | After barriers turn green, an exit zone (a highlighted opening) appears on the front wall (+Z direction) of the arena | Must |
| AR-07 | The player flying through the exit triggers the transition to the next area | Must |
| AR-08 | Barriers are very lightly transparent — predominantly see-through — so they feel like faint force fields. The space environment beyond them should be clearly visible. | Must |
| AR-09 | Barriers have a subtle pulsing glow effect (2-second cycle, emissive intensity varying ±20%) to make them feel active/energized | Should |
| AR-10 | Arena dimensions may increase slightly in later areas to accommodate more asteroids | Could |

### 8.4 Wave System

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

### 8.5 Camera

| ID | Requirement | Priority |
|---|---|---|
| C-01 | The game uses a third-person camera positioned behind and above the player ship | Must |
| C-02 | Camera follows the ship smoothly with configurable acceleration (not instant snapping) | Must |
| C-03 | Camera automatically rotates to match the ship's orientation | Must |
| C-04 | Camera parameters: radius ~20, height offset ~8, rotation offset 180° | Should |
| C-05 | Subtle camera shake effect on player damage and large explosions | Should |

### 8.6 Scoring

| ID | Requirement | Priority |
|---|---|---|
| S-01 | Small asteroid destroyed: 100 points | Must |
| S-02 | Medium asteroid destroyed: 50 points | Must |
| S-03 | Large asteroid destroyed: 25 points | Must |
| S-04 | Wave completion bonus: 500 × wave number | Should |
| S-05 | Area completion bonus: 2000 × area number | Should |
| S-06 | Score is displayed in the HUD at all times | Must |
| S-07 | High score is persisted in `localStorage` | Should |

### 8.7 HUD / UI

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

### 8.8 Audio

| ID | Requirement | Priority |
|---|---|---|
| AU-01 | Thruster sound when accelerating (looped) | Should |
| AU-02 | Shooting sound effect on each projectile fired | Should |
| AU-03 | Explosion sound on asteroid destruction | Should |
| AU-04 | Player damage / death sound | Should |
| AU-05 | Wave complete jingle | Could |
| AU-06 | Background ambient space music (looped) | Could |
| AU-07 | All audio files bundled locally for offline play | Must (if audio is implemented) |

### 8.9 Offline / PWA

| ID | Requirement | Priority |
|---|---|---|
| O-01 | A Service Worker caches all application files on first load | Must |
| O-02 | The game is fully playable after going offline | Must |
| O-03 | A `manifest.json` enables "Add to Home Screen" / PWA install | Should |
| O-04 | Cache versioning strategy to allow updates when online | Should |

---

## 9. Non-Functional Requirements

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

## 10. Security and Privacy

| ID | Requirement | Priority |
|---|---|---|
| SP-01 | The game does not collect, transmit, or store any personal user data | Must |
| SP-02 | All game data (high scores, settings) is stored exclusively in the browser's `localStorage` | Must |
| SP-03 | No third-party analytics, tracking scripts, or external network calls during gameplay | Must |
| SP-04 | The Service Worker must only cache assets from the application's own origin | Must |
| SP-05 | All dependencies must be bundled locally; no runtime CDN loads that could be compromised | Must |
| SP-06 | The Content Security Policy (CSP) should restrict scripts to `self` to prevent XSS | Should |

**Notes:**
- Since the game is entirely client-side with no server communication, the attack surface is minimal.
- The primary security concern is ensuring the Service Worker and cached assets cannot be tampered with and that no user data leaks to external services.

---

## 11. Accessibility

| ID | Requirement | Priority |
|---|---|---|
| ACC-01 | All UI text (HUD, menus, overlays) must meet WCAG 2.1 AA contrast ratio (≥ 4.5:1) | Should |
| ACC-02 | The game must be fully playable using keyboard only (no mouse required) | Must |
| ACC-03 | Interactive UI elements (menu buttons, pause options) must have visible focus indicators | Should |
| ACC-04 | Color is not the sole indicator of state changes — barrier transitions should also include a visual pattern change or text label (e.g., "Area Complete" overlay) | Should |
| ACC-05 | Provide an option to disable or reduce screen shake and flashing effects for motion-sensitive users | Could |
| ACC-06 | Audio cues should have corresponding visual feedback so deaf/hard-of-hearing players receive equivalent information | Should |
| ACC-07 | The game canvas should include an accessible label (`aria-label`) describing the game for screen readers | Should |
| ACC-08 | Font sizes in the HUD should be configurable or at least large enough to be readable at common viewport sizes | Should |

---

## 12. Controls

| Action | Keyboard | Mouse | Gamepad (if supported) |
|---|---|---|---|
| Thrust Forward | W / Up Arrow | — | Left Stick Up / Right Trigger |
| Thrust Backward | S / Down Arrow | — | Left Stick Down |
| Rotate / Pitch | A/D/Arrow keys | Hold left mouse button + move | Left Stick |
| Invert pitch | — | Mouse Y axis (inverted) | — |
| Fire | Spacebar | — | A Button |
| Pause | Escape | — | Start Button |

Gamepad support is a **Could** priority. Keyboard controls are **Must**. Mouse-hold-to-rotate is the primary intended control scheme.

---

### 13. Visual Style

- **Space Environment:** Dark backdrop with a star field, distant procedural planets, and a subtle nebula glow layer surrounding the arena exterior. These environment elements are visible through the transparent arena barriers.
- **Ship:** A playful low-poly design with a distinct cockpit dome, swept wings, and a glowing rear thruster. Bright emissive thruster effect when accelerating.
- **Asteroids:** Randomly selected from 6 geometric base shapes (icosphere, box, tetrahedron, octahedron, dodecahedron, low-poly cylinder/prism). Each has procedural vertex displacement noise applied for a worn, irregular appearance with a rocky gray-brown material. Physics collision shape remains a sphere impostor for consistency.
- **Barriers:** Very lightly transparent semi-transparent walls — predominantly see-through — giving the feel of a faint force field rather than a solid wall. Subtle pulsing emissive glow. Default color: red-orange. Complete color: green.
- **Projectiles:** Small glowing elongated meshes (cylinder) with emissive material in a bright color (cyan). Fired along the ship nose axis.
- **Explosions:** Particle systems with bright flashes fading to orange/red, then dissipating. Particle count kept reasonable for performance.
- **Start Screen:** Displays the title image (`title-screen.png`) on the main menu overlay.

---

## 14. Game State Machine

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

## 15. Implementation Phases

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

## 16. Testing Strategy

### 16.1 Testing Levels

| Level | Scope | Tools / Approach |
|-------|-------|------------------|
| **Unit Tests** | Individual utility functions (`MathHelpers`, `Constants`), scoring calculations, wave difficulty scaling logic | Vitest or Jest with TypeScript |
| **Integration Tests** | Game state machine transitions, wave progression logic, collision response sequences | Vitest with mock Babylon.js scene objects |
| **Manual Playtesting** | Full gameplay loop, controls feel, visual quality, difficulty curve tuning | Developer and peer play sessions |
| **Performance Testing** | FPS measurement across target browsers and hardware | Browser DevTools profiling, Babylon.js Inspector |
| **Offline Testing** | Service Worker caching, PWA install, gameplay after network disconnect | Chrome DevTools Application panel, Lighthouse |
| **Cross-Browser Testing** | Rendering, input, and audio across Chrome, Firefox, Edge, Safari | Manual verification on each browser |

### 16.2 Key Test Scenarios

1. Player can complete all 3 waves in an area and barriers turn green
2. Exiting through the green barrier loads the next area with increased difficulty
3. Asteroid splitting produces the correct number and size of child asteroids
4. Player loses a life on asteroid collision and receives invulnerability frames
5. Game Over triggers at 0 lives with correct final score
6. Victory screen appears after completing the final area
7. Score persists in `localStorage` across sessions
8. Game loads and plays correctly after going offline
9. No runtime errors or unhandled rejections during a full 3-area playthrough
10. 60 FPS maintained with maximum asteroid count on target hardware

---

## 17. Analytics / Success Metrics

Since this is a client-side game with no server-side telemetry, success is measured through local observability and qualitative feedback.

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| **Frame Rate** | ≥ 60 FPS sustained during gameplay | Babylon.js engine FPS counter, browser DevTools |
| **Load Time** | < 5 seconds on broadband, < 3 seconds on repeat visit (cached) | Lighthouse performance audit |
| **Bundle Size** | < 15 MB total cached assets | Build output analysis (`vite build`) |
| **Offline Reliability** | 100% functionality after disconnect | Manual test: load, disconnect, play full session |
| **Completion Rate** | Players can complete all 3 areas without encountering bugs | Playtesting sessions |
| **Session Length** | Average play session of 5–15 minutes for a full 3-area game | Playtesting observation |
| **Browser Compatibility** | Zero critical rendering or input bugs across Chrome, Firefox, Edge, Safari | Cross-browser test matrix |

**Future consideration:** If analytics become desired, a lightweight opt-in event system could log gameplay events (waves completed, score, deaths) to `localStorage` for local review, with no external transmission.

---

## 18. Acceptance Criteria

The game is considered complete when:

1. **Playable:** The player can control a ship in third-person view, shoot projectiles, and destroy asteroids.
2. **Waves Work:** Each area has exactly 3 waves with increasing numbers of asteroids.
3. **Barrier System:** Arena barriers are visible and semi-transparent (clearly visible but allowing the space environment to be faintly seen beyond them). They change to green when all 3 waves in an area are completed.
4. **Area Progression:** After barriers turn green, an exit is available. Flying through it loads the next area with reset barriers and harder waves.
5. **Offline:** After the first load, the game is fully functional without an internet connection.
6. **Performance:** The game runs at 60 FPS on target hardware.
7. **No Crashes:** No runtime errors during normal play sessions.

---

## 19. Dependencies and Risks

### 19.1 Dependencies

| Dependency | Type | Risk if Unavailable | Mitigation |
|------------|------|---------------------|------------|
| Babylon.js (`@babylonjs/core` ^7.0) | npm package | Cannot render 3D scene | Pin version in `package.json`; bundle locally |
| Babylon.js GUI (`@babylonjs/gui`) | npm package | No HUD or menu screens | Pin version; bundle locally |
| cannon-es | npm package | No physics simulation | Pin version; bundle locally |
| Vite | Build tool | Cannot bundle or serve locally | Pin version; standard npm tooling |
| Modern browser with WebGL 2.0 | Runtime | Game will not render | Document minimum browser versions; show fallback message |
| Service Worker API | Runtime | No offline support | Graceful degradation; game still works online |

### 19.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Babylon.js bundle size exceeds 15 MB cache budget | Medium | Slow first load, large cache | Aggressive tree shaking; import only used modules |
| Physics performance degrades with many asteroids | Medium | FPS drops below 60 | Cap max active asteroid count; use simple collision shapes |
| WebGPU API inconsistency across browsers | Low | Rendering issues on some browsers | Default to WebGL 2.0; use WebGPU only as enhancement |
| Service Worker cache invalidation fails | Low | Players stuck on old version | Implement cache versioning with skip-waiting strategy |
| Cannon-es physics behavior differs from Havok/Ammo | Low | Unexpected collision responses | Test physics thoroughly; tune impostor parameters |
| Scope creep (power-ups, multiplayer, story mode) | Medium | Delayed delivery | Strict adherence to v1 non-goals |

---

## 20. Future Considerations

The following items are explicitly **out of scope for v1** but are documented here for potential future releases:

| Item | Description | Potential Version |
|------|-------------|-------------------|
| **Power-ups** | Shield, rapid fire, spread shot, slow-motion pickups dropped by asteroids | v2 |
| **Mobile / Touch Controls** | On-screen joystick and fire button for mobile browsers | v2 |
| **Multiplayer** | Local split-screen or networked cooperative/competitive play | v3 |
| **Custom Ship Models** | Import `.glb` ship models to replace geometric primitives | v2 |
| **Leaderboard** | Online high-score leaderboard with optional username submission | v2 |
| **Sound Settings** | Volume sliders for SFX and music, mute toggle | v2 |
| **Difficulty Modes** | Easy / Normal / Hard presets affecting asteroid count and speed | v2 |
| **Gamepad Support** | Full gamepad input mapping with button prompts | v2 |
| **Level Editor** | User-created wave configurations and arena layouts | v3 |
| **Narrative Mode** | Mission briefings, boss encounters, story progression | v3 |
| **Analytics / Telemetry** | Opt-in gameplay event logging for difficulty tuning | v2 |

---

## 21. Open Questions

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

## 22. Glossary

| Term | Definition |
|---|---|
| **Area** | A play session containing 3 waves. Each area has its own arena instance with barriers. |
| **Wave** | A single round of asteroids that must be fully destroyed to progress. |
| **Barrier** | A visible wall bounding the play area. Changes color to indicate area completion. |
| **Exit Zone** | A region on one barrier wall that becomes passable after all waves are cleared, allowing the player to transition to the next area. |
| **Asteroid Splitting** | The mechanic where destroying a larger asteroid spawns smaller ones. |
| **Invulnerability Frame (i-frame)** | A brief period after taking damage where the player cannot be hit again. |
