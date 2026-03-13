---
name: create-particle-effect
description: >
  Design and implement Babylon.js particle systems for the 3D Space Rocks project. Use this
  skill when creating visual effects like explosions, thruster trails, spark impacts, or
  any particle-based effect.
---

# Skill: Create a Particle Effect

You are creating a particle system effect for the 3D Space Rocks game using the Babylon.js particle system API.

---

## Process

### Step 1: Choose the Effect Type

Determine the type of effect needed. Common effects in this project:

| Effect | Trigger | Duration | Reference |
|--------|---------|----------|-----------|
| **Asteroid Explosion** | Asteroid destroyed | 0.3–0.8s | A-10, Section 13 |
| **Ship Thruster** | Player accelerating | Continuous | P-06 |
| **Player Death** | Player loses a life | 0.5–1.0s | P-08 |
| **Projectile Impact** | Projectile hits target | 0.1–0.3s | Section 13 |
| **Wave Complete** | All asteroids cleared | 1.0–2.0s | W-04 |

### Step 2: Create the Particle System

Use the following template for creating a particle system:

```typescript
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

export function createExplosionEffect(
  scene: Scene,
  position: Vector3,
  size: "small" | "medium" | "large"
): ParticleSystem {
  const particleSystem = new ParticleSystem("explosion", getParticleCount(size), scene);

  // Texture (use a simple flare/spark texture)
  particleSystem.particleTexture = new Texture("assets/textures/flare.png", scene);

  // Emitter position
  particleSystem.emitter = position.clone();

  // Particle lifetime
  particleSystem.minLifeTime = 0.2;
  particleSystem.maxLifeTime = 0.6;

  // Emission rate (emit all particles at once for an explosion)
  particleSystem.emitRate = 0; // Manual burst
  particleSystem.manualEmitCount = getParticleCount(size);

  // Size
  particleSystem.minSize = 0.3;
  particleSystem.maxSize = 1.2;

  // Speed
  particleSystem.minEmitPower = 2;
  particleSystem.maxEmitPower = 8;

  // Direction (all directions for explosion)
  particleSystem.createSphereEmitter(1);

  // Color gradient: bright flash → orange → red → fade out
  particleSystem.addColorGradient(0, new Color4(1, 1, 0.8, 1));    // Bright flash
  particleSystem.addColorGradient(0.3, new Color4(1, 0.6, 0.1, 1)); // Orange
  particleSystem.addColorGradient(0.7, new Color4(0.8, 0.2, 0.05, 0.8)); // Red
  particleSystem.addColorGradient(1.0, new Color4(0.3, 0.1, 0.05, 0)); // Fade out

  // Size gradient: shrink over lifetime
  particleSystem.addSizeGradient(0, 1.0);
  particleSystem.addSizeGradient(1, 0.1);

  // Gravity (none in space)
  particleSystem.gravity = Vector3.Zero();

  // Start and auto-dispose
  particleSystem.disposeOnStop = true;
  particleSystem.targetStopDuration = 0.8;
  particleSystem.start();

  return particleSystem;
}

function getParticleCount(size: "small" | "medium" | "large"): number {
  switch (size) {
    case "large": return 80;
    case "medium": return 50;
    case "small": return 25;
  }
}
```

### Step 3: Thruster Effect (Continuous)

For continuous effects like the ship thruster:

```typescript
export function createThrusterEffect(
  scene: Scene,
  emitterMesh: AbstractMesh
): ParticleSystem {
  const thruster = new ParticleSystem("thruster", 100, scene);

  thruster.particleTexture = new Texture("assets/textures/flare.png", scene);
  thruster.emitter = emitterMesh; // Attach to ship mesh

  // Emit from behind the ship
  thruster.minEmitBox = new Vector3(-0.2, -0.2, -1);
  thruster.maxEmitBox = new Vector3(0.2, 0.2, -1);

  // Direction: backward from ship
  thruster.direction1 = new Vector3(-0.2, -0.2, -1);
  thruster.direction2 = new Vector3(0.2, 0.2, -1.5);

  // Particle properties
  thruster.minLifeTime = 0.1;
  thruster.maxLifeTime = 0.3;
  thruster.emitRate = 60;
  thruster.minSize = 0.1;
  thruster.maxSize = 0.4;
  thruster.minEmitPower = 3;
  thruster.maxEmitPower = 6;

  // Blue-white thruster color
  thruster.addColorGradient(0, new Color4(0.6, 0.8, 1.0, 1));
  thruster.addColorGradient(0.5, new Color4(0.3, 0.5, 1.0, 0.8));
  thruster.addColorGradient(1.0, new Color4(0.1, 0.2, 0.5, 0));

  thruster.gravity = Vector3.Zero();

  // Start stopped — activate when thrusting
  thruster.stop();

  return thruster;
}
```

### Step 4: Performance Considerations

- Keep particle counts reasonable (25–100 per effect) to maintain 60 FPS (NF-01).
- Use `disposeOnStop = true` for one-shot effects to clean up automatically.
- Reuse particle textures across effects to reduce GPU texture switches.
- Consider particle pooling if many effects fire simultaneously.

### Step 5: Integration

Export effect factory functions that can be called by the gameplay engineer:

```typescript
// In game code:
import { createExplosionEffect } from "./effects";

// When asteroid is destroyed:
createExplosionEffect(scene, asteroid.position, "large");
```

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md):

- **Section 5.4** — Immediate feedback within 100ms
- **Section 7.3** — ParticleSystem API reference
- **Section 8.1 P-06** — Thruster particle effect
- **Section 8.2 A-10** — Asteroid explosion effect
- **Section 13** — Visual style (explosion appearance, projectile glow)
