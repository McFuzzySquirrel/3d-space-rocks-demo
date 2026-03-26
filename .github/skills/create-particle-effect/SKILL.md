---
name: create-particle-effect
description: >
  Creates reusable particle and impact-feedback effects for 3D Space Rocks with
  performance-aware defaults and gameplay event integration.
---

# Skill: Create Particle Effect

Use this skill to add or tune a reusable visual effect such as explosions, thruster trails, or impact flashes.

---

## Process

### Step 1: Define Effect Intent and Trigger

Document what gameplay event starts the effect and what player feedback it should provide.

- Define trigger event and expected lifetime.
- Define acceptable performance budget (particle count and update cost).
- Define fallback behavior when reduced-motion mode is active.

### Step 2: Build Effect Module

Create a reusable effect function or class with explicit setup and teardown.

```ts
export interface EffectHandle {
  start(): void;
  stop(): void;
  dispose(): void;
}
```

Use centralized constants for emission rate, color ramps, and lifetime.

### Step 3: Integrate with Event Bus

Subscribe to gameplay events and trigger effects without embedding gameplay logic.

- Keep effects event-driven and loosely coupled.
- Avoid directly mutating gameplay state from VFX code.
- Ensure effect cleanup on state transitions and scene disposal.

### Step 4: Validate Visual Timing and Cost

Verify the effect appears within immediate-feedback expectations and does not degrade FPS.

- Check timing against user feedback expectations.
- Profile worst-case scenarios with multiple concurrent effects.
- Tune for readability under varied background lighting.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 5.4** - Immediate feedback and game-feel practices.
- **Section 8.1 (P-06, P-08)** - Thruster and invulnerability effects.
- **Section 8.2 (A-10)** - Explosion requirements.
- **Section 8.5 (C-05)** - Camera shake context.
