import type { Scene } from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core';
import * as CANNON from 'cannon-es';

/**
 * Initializes the Cannon.js physics world and plugin with sensible defaults for arcade gameplay.
 *
 * Configuration notes:
 * - Gravity: (0, 0, 0) — space environment, no gravity
 * - Time step: 1/60 — 60 Hz simulation matching display refresh
 * - Solver iterations: 4 — balance between accuracy and performance; higher values = more stable but slower
 * - Default material: friction 0, restitution 1.0 — bouncy, frictionless for arcade feel
 *
 * @param scene - The Babylon.js scene to attach physics to
 * @returns The CannonJSPlugin instance (keep reference if needed for advanced tuning)
 */
export function initPhysicsWorld(scene: Scene): CannonJSPlugin {
  // Create the physics plugin with cannon-es
  const cannonPlugin = new CannonJSPlugin(true, 10, CANNON);

  // Enable physics on the scene
  scene.enablePhysics(
    /* gravity */ undefined, // We'll set it on the world instead
    cannonPlugin,
  );

  // Access the underlying Cannon.js world for detailed configuration
  const world = cannonPlugin.world;

  // Set zero gravity (space environment)
  world.gravity.set(0, 0, 0);

  // Configure time stepping for 60 FPS simulation
  world.defaultContactMaterial.friction = 0;
  world.defaultContactMaterial.restitution = 1.0;

  // Solver iterations: 4 provides good stability/performance balance for arcade-style gameplay
  // Higher values = more accurate but slower; lower values = faster but less stable
  world.solver.iterations = 4;

  // Set a fixed time step of 1/60s (60 Hz) for deterministic simulation
  // This matches typical monitor refresh rates and ensures consistent gameplay
  cannonPlugin.setTimeStep(1 / 60);

  return cannonPlugin;
}
