---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0002"
  title: Centralized Game State Machine in Game.ts with Guarded Transitions
  date: 2026-03-18
  status: accepted
  session_id: ejs-session-2026-03-18-02
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-18-02.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: product owner
  agents:
    - id: gameplay-engineer
      role: architect / implementer
    - id: copilot
      role: orchestrator

context:
  repo: 3d-space-rocks-demo
  branch: demos/prep
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-03-18-02.md`

# Context

Phase 3 introduced wave progression, area transitions, pause, game over, and
victory flows. This required a formal mechanism for coordinating the full game
lifecycle across multiple async event sources (`waveManagerEvents`,
`arenaEvents`, `playerEvents`, keyboard input).

Three key design questions needed to be resolved:

1. **Where do phase transitions live?** — WaveManager, Game.ts, or both?
2. **Where do timing delays live?** — Wave transition delay (2s), area complete
   hold, area transition fade?
3. **How do consumers (HUD, VFX, audio) observe state changes?** — Pull
   (polling) or push (observables)?

---

# Session Intent

Implement a complete game state machine covering all 9 states (MENU, LOADING,
PLAYING, WAVE_TRANSITION, AREA_COMPLETE, AREA_TRANSITION, PAUSED, GAME_OVER,
VICTORY) with deterministic, testable transitions and clean observable contracts
for downstream consumers.

---

# Collaboration Summary

`gameplay-engineer` evaluated two competing approaches. The initial assumption
was that `WaveManager` would own wave-completion timing (emit after delay). The
agent identified that this caused duplicate timer authority when `Game.ts` also
needed to gate state changes. The recommendation to move all timing into
state-entry handlers within `Game.ts` was adopted without modification.

The `ui-hud-developer` independently confirmed this was the correct contract
boundary by implementing HUD as a pure subscriber with no callbacks into game
internals.

---

# Decision Trigger / Significance

**Criteria met:**
- Introduces a new system boundary (state machine as the coordination layer
  between physics loop, wave system, UI, and VFX)
- Changes the public contract of `Game.ts` (exports `gameStateEvents.*`
  observables consumed by HUD, audio, VFX)
- Requires choosing among credible alternatives with meaningful trade-offs
- Has long-lived, hard-to-reverse consequences — all future features
  (audio, Phase 4 polish, Phase 5 PWA telemetry) depend on this contract

---

# Considered Options

## Option A — Centralized state machine in Game.ts (ADOPTED)
All 9 states represented as a `GameState` enum. A guarded transition map
enforces allowed state paths. All timing delays (wave transition, area hold,
area fade) live in state-entry `setTimeout` handlers within `Game.ts`.
`WaveManager` emits events but has no timers. Downstream consumers
(HUD, VFX, audio) subscribe to `gameStateEvents.*` observables — they never
call `Game.ts` methods directly.

## Option B — Distributed timing (WaveManager owns wave timing)
`WaveManager` emits `waveComplete$` after its internal `waveTransitionDelayMs`
timer. `Game.ts` listens and transitions state in response. Timing for
area-complete, area-transition, and pause live in different modules.

## Option C — Polling/callback HUD
HUD receives a reference to `Game.ts` and polls state on each render frame, or
`Game.ts` calls `hud.showWaveTransition()` directly on state change.

---

# Decision

**Option A — Centralized state machine in Game.ts with guarded transitions.**

All game phase timing is owned by `Game.ts` state-entry handlers. `WaveManager`
and `Arena` emit domain events; `Game.ts` is the sole authority that decides
when and how the game state advances. All consumers subscribe to
`gameStateEvents.*` push observables.

---

# Rationale

- **Option B** was rejected because having `WaveManager` own wave timing and
  `Game.ts` own area timing created two separate timing authorities. In practice
  this caused ordering races during stress-testing of rapid wave completions —
  the wave-complete event fired while `Game.ts` was still mid-transition.

- **Option C** was rejected because polling couples HUD render timing to game
  state, and direct method calls from `Game.ts` to HUD create bidirectional
  coupling that makes unit testing, mocking, and future agent contribution
  significantly harder.

- **Option A** gives a single, auditable transition log. Any state change can
  be traced to one `setState()` call in one file. The `gameStateEvents.stateChanged$`
  stream is a permanent audit trail. Downstream consumers (HUD, audio, VFX) are
  pure subscribers with no coupling to game internals.

---

# Consequences

### Positive
- Single source of truth for all game phase timing (no race conditions).
- `gameStateEvents.*` provides a permanent, typed observable contract for all
  current and future consumers (audio-engineer, Phase 4 VFX, Phase 5 telemetry).
- Guarded transition map makes invalid state jumps impossible — fail-fast with
  a console warning.
- HUD, VFX, and audio agents can be developed and tested independently against
  the observable contract without needing a running game loop.
- Easy to extend: adding a new state (e.g., CUTSCENE) only requires adding it
  to the `GameState` enum and the transition map.

### Negative / Trade-offs
- All timing constants must be maintained in `Constants.ts` and `Game.ts` —
  cannot tune wave transition delay inside `WaveManager` in isolation.
- `Game.ts` grows larger as the coordination hub; discipline is required to
  avoid embedding gameplay logic (should delegate to entity methods).
- Downstream agents must know to subscribe to `gameStateEvents.*` rather than
  inspecting `Game` state directly — documentation dependency.

---

# Key Learnings

- In RxJS-driven architectures, timer authority must be singular. Two modules
  both emitting "ready to advance" signals for the same state transition will
  cause ordering races that are hard to reproduce and fix.
- Inversion of control (spawn callback injection into `WaveManager`) is more
  maintainable than direct imports when the caller owns lifecycle and the callee
  should remain independent.
- Returning observable references from modules (rather than callback registration)
  makes subscription patterns composable and testable.

---

# Agent Guidance

- **gameplay-engineer**: The `setState()` method in `Game.ts` is the single
  authority. All game phase changes must go through it. Never call `setState()`
  from entity classes (Asteroid, Player, Arena) — they emit events, Game.ts
  reacts.
- **audio-engineer**: Subscribe to `gameStateEvents.stateChanged$` for music
  and ambient transitions. Subscribe to `playerEvents.died$` and
  `asteroidEvents.destroyed$` for SFX. Never poll `Game.ts` state directly.
- **vfx-artist**: Subscribe to `gameStateEvents.*`, `waveManagerEvents.*`, and
  `arenaEvents.*`. Return `ParticleSystem` handles from looping VFX factories
  so callers in `Game.ts` can control lifecycle.
- **ui-hud-developer**: HUD must remain a passive subscriber. Never accept a
  `Game` reference in the HUD constructor. Use `gameStateEvents.*` + score/wave
  observables exclusively.
- **pwa-specialist**: `gameStateEvents.stateChanged$` can be used to pause
  game loop and flush analytics/telemetry before service worker cache updates.

---

# Reuse Signals

```yaml
reuse:
  patterns:
    - Centralized state machine with guarded transition map
    - Observable contract for cross-module state communication
    - Inversion of control via callback injection for spawn/lifecycle
  prompts:
    - "All state transitions must go through Game.ts setState(). Emit domain events from entities; Game.ts reacts."
    - "HUD is a passive subscriber — subscribe to gameStateEvents.*, never accept a Game reference."
  anti_patterns:
    - Distributed timing authority across WaveManager + Game.ts
    - Direct method calls from Game.ts to HUD (bidirectional coupling)
    - Physics triggers for simple zone-proximity checks (use per-frame position check)
  future_considerations:
    - CUTSCENE state for area-intro animations (add to enum + transition map)
    - Telemetry hook on stateChanged$ for Phase 5 analytics
    - Replay system could subscribe to stateChanged$ stream for event recording
```
