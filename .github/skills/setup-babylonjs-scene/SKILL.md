---
name: setup-babylonjs-scene
description: >
  Set up or modify a Babylon.js scene with standard components for the 3D Space Rocks project.
  Use this skill when initializing the engine, creating scenes, configuring cameras, setting up
  lighting, or creating the space skybox.
---

# Skill: Set Up a Babylon.js Scene

You are setting up or modifying a Babylon.js scene for the 3D Space Rocks game. Follow the architecture and configuration specified in the PRD.

---

## Process

### Step 1: Engine Initialization

Create the Babylon.js engine attached to an HTML canvas element:

```typescript
import { Engine } from "@babylonjs/core/Engines/engine";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});
```

The canvas element in `index.html` should be:

```html
<canvas id="renderCanvas" aria-label="3D Space Rocks game" style="width: 100%; height: 100%;"></canvas>
```

Note the `aria-label` for accessibility (ACC-07).

### Step 2: Scene Creation

```typescript
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";

const scene = new Scene(engine);
scene.clearColor = new Color4(0.01, 0.01, 0.02, 1); // Near-black space
```

### Step 3: Camera Setup

Configure the `FollowCamera` for third-person gameplay per PRD Section 5.2:

```typescript
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

const camera = new FollowCamera("followCamera", new Vector3(0, 10, -30), scene);
camera.radius = 20;           // Distance behind the target
camera.heightOffset = 8;       // Height above the target
camera.rotationOffset = 180;   // Behind the target (degrees)
camera.cameraAcceleration = 0.05; // Smooth follow, not instant
camera.maxCameraSpeed = 10;    // Maximum follow speed
// camera.lockedTarget will be set to the player ship mesh
```

### Step 4: Lighting

Set up lighting for the space environment:

```typescript
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";

// Ambient light for general visibility
const hemisphericLight = new HemisphericLight(
  "ambientLight",
  new Vector3(0, 1, 0),
  scene
);
hemisphericLight.intensity = 0.7;
hemisphericLight.groundColor = new Color3(0.1, 0.1, 0.15);
```

### Step 5: Skybox

Create a space skybox with stars:

```typescript
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
const skyboxMaterial = new StandardMaterial("skyBoxMaterial", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.reflectionTexture = new CubeTexture("assets/textures/skybox", scene);
skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
skyboxMaterial.specularColor = new Color3(0, 0, 0);
skybox.material = skyboxMaterial;
```

### Step 6: Render Loop

Start the engine render loop:

```typescript
engine.runRenderLoop(() => {
  scene.render();
});

// Handle window resize
window.addEventListener("resize", () => {
  engine.resize();
});
```

### Step 7: Physics (if needed)

Enable physics with cannon-es:

```typescript
import { CannonJSPlugin } from "@babylonjs/core/Physics/Plugins/cannonJSPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import * as CANNON from "cannon-es";

scene.enablePhysics(
  new Vector3(0, 0, 0), // Zero gravity for space
  new CannonJSPlugin(true, 10, CANNON)
);
```

---

## Import Best Practices

Always use specific subpath imports for tree shaking:

```typescript
// ✅ Correct — tree-shakeable imports
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

// ❌ Incorrect — imports entire Babylon.js
import * as BABYLON from "@babylonjs/core";
```

---

## Responsive Canvas

Ensure the canvas fills the viewport (NF-04):

```css
html, body {
  overflow: hidden;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}
#renderCanvas {
  width: 100%;
  height: 100%;
  touch-action: none;
}
```

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md):

- **Section 5.1** — Why Babylon.js (engine capabilities)
- **Section 5.2** — Camera configuration values
- **Section 7.3** — Key Babylon.js APIs table
- **Section 13** — Visual style guide
