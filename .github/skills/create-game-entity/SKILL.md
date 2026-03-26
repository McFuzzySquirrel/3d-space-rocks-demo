---
name: create-game-entity
description: >
  Scaffolds a typed gameplay entity module (player, asteroid, projectile) with lifecycle,
  update logic, and event hooks for the 3D Space Rocks architecture.
---

# Skill: Create Game Entity

Use this skill whenever a new gameplay entity needs to follow consistent lifecycle and integration patterns.

---

## Process

### Step 1: Define Entity Contract

Specify the entity's typed state, constructor dependencies, and lifecycle methods.

- Decide what belongs in config vs runtime state.
- Define `update`, `dispose`, and optional `onCollision` hooks.
- Define emitted events used by UI, audio, or VFX.

### Step 2: Scaffold Entity Module

Create the module and wire scene + physics dependencies.

```ts
export interface GameEntity {
  update(deltaMs: number): void;
  dispose(): void;
}
```

Add a narrow, typed public API and avoid leaking internal mutable state.

### Step 3: Wire Event Emission

Publish entity events through the shared gameplay event bus.

- Emit only domain events (e.g., `asteroid.destroyed`, `projectile.expired`).
- Avoid direct calls into UI, audio, or VFX modules.
- Keep event payloads stable and typed.

### Step 4: Add Validation and Tests

Create or update tests for lifecycle behavior and requirement-specific rules.

- Validate entity creation and disposal.
- Validate key mechanics (cooldown, split behavior, caps).
- Add regression tests for known edge conditions.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 8.1** - Player requirements.
- **Section 8.2** - Asteroid behavior and splitting.
- **Section 8.4** - Wave progression interaction points.
