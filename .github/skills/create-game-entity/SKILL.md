---
name: create-game-entity
description: >
  Scaffold a new TypeScript game entity class for the 3D Space Rocks project following
  established patterns. Use this skill when creating new game objects like ships, asteroids,
  projectiles, or arena components that need mesh, physics, and lifecycle management.
---

# Skill: Create a Game Entity

You are creating a new game entity class for the 3D Space Rocks game. Follow the established patterns and architecture defined in the PRD.

---

## Process

### Step 1: Determine Entity Type

Identify what kind of entity is needed. Common types from the PRD:

- **Player Ship** (`src/game/Player.ts`) — Controlled by the player, has movement, shooting, lives
- **Asteroid** (`src/game/Asteroid.ts`) — Enemy object, has sizes, splitting, movement
- **Projectile** (`src/game/Projectile.ts`) — Fired by the player, has lifetime, collision
- **Arena** (`src/game/Arena.ts`) — Barrier walls, exit zone, color transitions

### Step 2: Scaffold the Class

Create a TypeScript class in `src/game/` following this template:

```typescript
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class EntityName {
  private _mesh: Mesh;
  private _scene: Scene;
  private _isActive: boolean = true;

  constructor(scene: Scene) {
    this._scene = scene;
    this._createMesh();
    this._setupPhysics();
  }

  /** Create the visual mesh for this entity */
  private _createMesh(): void {
    // Use MeshBuilder to create the mesh
    // Apply materials from Constants
  }

  /** Attach physics impostor for collision detection */
  private _setupPhysics(): void {
    // Use PhysicsImpostor with appropriate shape and mass
    // Register collision callbacks
  }

  /** Called every frame from the game loop */
  public update(deltaTime: number): void {
    if (!this._isActive) return;
    // Update entity state
  }

  /** Clean up mesh, physics, and resources */
  public dispose(): void {
    this._isActive = false;
    if (this._mesh) {
      this._mesh.dispose();
    }
  }

  // --- Getters ---
  public get mesh(): Mesh { return this._mesh; }
  public get isActive(): boolean { return this._isActive; }
  public get position(): Vector3 { return this._mesh.position; }
}
```

### Step 3: Apply Conventions

Follow these conventions from the project:

1. **Imports**: Use specific `@babylonjs/core` subpath imports for tree shaking:
   ```typescript
   // ✅ Good — tree-shakeable
   import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
   
   // ❌ Bad — imports entire package
   import { MeshBuilder } from "@babylonjs/core";
   ```

2. **Constants**: All tunable values go in `src/utils/Constants.ts`:
   ```typescript
   import { ASTEROID_LARGE_SIZE, ASTEROID_SPEED_BASE } from "../utils/Constants";
   ```

3. **TypeScript Strict Mode**: No `any` types. Use proper interfaces and type annotations.

4. **Physics Impostors**: Every interactive entity needs a physics impostor:
   ```typescript
   import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
   
   mesh.physicsImpostor = new PhysicsImpostor(
     mesh,
     PhysicsImpostor.SphereImpostor,
     { mass: 1, restitution: 0.8 },
     scene
   );
   ```

5. **Collision Callbacks**:
   ```typescript
   mesh.physicsImpostor.registerOnPhysicsCollide(
     otherImpostor,
     (main, collided) => { /* handle collision */ }
   );
   ```

### Step 4: Wire into Game Loop

Ensure the entity is registered with the game's update loop in `src/game/Game.ts` so its `update()` method is called every frame.

### Step 5: Add to Relevant Manager

If the entity is managed by a system (e.g., asteroids by `WaveManager`), add factory methods and lifecycle management to the appropriate manager class.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 7.2** — Project structure (where files go)
- **Section 7.3** — Key Babylon.js APIs
- **Section 8.1–8.4** — Entity-specific requirements
