---
name: setup-babylonjs-scene
description: >
  Sets up the Babylon.js engine, scene, camera, lighting, and asset loading pipeline for 3D Space Rocks.
---

# Skill: Setup Babylon.js Scene

Use this skill to scaffold and configure a production-ready scene foundation before gameplay systems are added.

---

## Process

### Step 1: Validate Runtime and Dependencies

Confirm the project has the required Babylon modules, TypeScript strict settings, and a bootstrap entrypoint.

- Verify required packages are present in `package.json`.
- Confirm strict TypeScript compile mode is enabled.
- Identify where scene creation should be called in app startup.

### Step 2: Scaffold Engine and Scene Factory

Create a small, typed scene factory with clear ownership boundaries.

```ts
import { Engine, Scene, HemisphericLight, Vector3 } from "@babylonjs/core";

export function createScene(engine: Engine): Scene {
  const scene = new Scene(engine);
  new HemisphericLight("keyLight", new Vector3(0, 1, 0), scene);
  return scene;
}
```

### Step 3: Configure FollowCamera Defaults

Create a camera setup helper aligned to gameplay defaults from the PRD.

- Use FollowCamera with radius, height offset, and rotation offset targets.
- Set camera smoothing values for non-snapping motion.
- Expose typed configuration overrides for tuning.

### Step 4: Add Asset Loading Hooks

Add an asset loader entrypoint with progress callbacks so UI can present loading state.

- Emit progress values from 0 to 1.
- Keep paths local and cacheable for offline play.
- Return explicit load results for downstream systems.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 5.1** - Engine capabilities and API choices.
- **Section 5.2** - FollowCamera decision and tuning.
- **Section 7.3** - Canonical Babylon.js APIs.
