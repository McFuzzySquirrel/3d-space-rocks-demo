---
name: implement-ui-screen
description: >
  Implements a Babylon GUI screen or overlay pattern for 3D Space Rocks, including
  keyboard navigation, accessibility checks, and state lifecycle hooks.
---

# Skill: Implement UI Screen

Use this skill to build a consistent screen flow (menu, pause, game-over, victory, transitions, loading).

---

## Process

### Step 1: Identify Screen State and Data Inputs

Define which game state owns the screen and what data it must render.

- Map the screen to one state from the runtime state machine.
- Define input data shape and actions.
- Define keyboard interaction map and focus targets.

### Step 2: Scaffold GUI Components

Build the screen using Babylon GUI controls and a clear mount/unmount lifecycle.

```ts
export interface ScreenController {
  mount(): void;
  unmount(): void;
  update(): void;
}
```

Keep layout constraints and text styles centralized for consistency.

### Step 3: Wire Actions and Transitions

Connect screen interactions to gameplay events without embedding domain logic.

- Fire commands/events instead of mutating game state directly.
- Debounce repeated key handling where needed.
- Ensure transition overlays auto-expire on configured timers.

### Step 4: Validate Accessibility and Responsiveness

Run accessibility and readability checks before finalizing.

- Verify keyboard-only usability.
- Verify visible focus state for all interactive controls.
- Verify contrast and readability at common viewport sizes.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 8.7** - HUD and screen requirements.
- **Section 11** - Accessibility requirements.
- **Section 14** - State machine mapping for screen ownership.
