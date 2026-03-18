import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { CannonJSPlugin, Scene } from "@babylonjs/core";

import type { SceneBootstrap } from "./SceneFactory";
import { createPlayerController, playerEvents } from "./Player";
import { createArenaController } from "./Arena";
import { Asteroid, asteroidEvents, type AsteroidConfig, AsteroidSize } from "./Asteroid";
import { projectileEvents } from "./Projectile";
import { APP_CONFIG } from "../utils/Constants";
import { createAsteroidExplosion, createProjectileHitEffect } from "../vfx/ParticleEffects";
import { applyPlayerDamageFlash, playImpactShake } from "../vfx/DamageFeedback";
import { initPhysicsWorld } from "../systems/PhysicsSetup";
import { initCollisionSystem } from "../systems/CollisionSystem";
import { ScoreSystem } from "./ScoreSystem";

/**
 * Game runtime interface for frame-by-frame updates and cleanup.
 */
export interface GameRuntime {
  update: (deltaMs: number) => void;
  dispose: () => void;
}

/**
 * Extended game interface that also exposes asteroid spawning for Phase 3 WaveManager.
 */
export interface GameController extends GameRuntime {
  spawnAsteroid: (config: AsteroidConfig) => Asteroid;
  spawnAsteroids: (configs: AsteroidConfig[]) => Asteroid[];
}

/**
 * Helper function to sync camera target to player position and orientation.
 */
function syncCameraTarget(sceneBootstrap: SceneBootstrap, position: Vector3, yawRadians: number): void {
  sceneBootstrap.cameraTarget.position.copyFrom(position);
  sceneBootstrap.cameraTarget.rotation.y = yawRadians;
}

/**
 * Creates and returns a game controller that manages physics, collisions, entities, and scoring.
 *
 * Responsibilities:
 * - Initialize and maintain physics world (Cannon.js)
 * - Initialize collision event system
 * - Create and manage asteroid lifecycle (spawn, update, destroy)
 * - Maintain player input and camera synchronization
 * - Wire score system to asteroid destruction events
 * - Subscribe to VFX trigger events
 * - Provide fixed-timestep update loop with physics stepping
 *
 * Architecture:
 * - GameRuntime is the primary update/dispose interface
 * - GameController extends GameRuntime to add spawning methods for WaveManager
 * - Physics world steps BEFORE entity updates to ensure deterministic collisions
 * - All destruction and damage flows through Observable events
 *
 * @param sceneBootstrap The bootstrapped scene, camera, and other scene infrastructure
 * @returns A GameController implementing GameRuntime with additional spawn methods
 */
export function createGameRuntime(sceneBootstrap: SceneBootstrap): GameController {
  const scene: Scene = sceneBootstrap.scene;

  // ============================================================================
  // Initialize Physics World and Collision System
  // ============================================================================
  const physicsPlugin: CannonJSPlugin = initPhysicsWorld(scene);
  initCollisionSystem();

  // ============================================================================
  // Create Core Entities (Player and Arena)
  // ============================================================================
  const player = createPlayerController(scene, APP_CONFIG.gameplay.player);
  const arena = createArenaController(scene, APP_CONFIG.gameplay.arena);

  sceneBootstrap.registerSceneActor({ key: "player", node: player.mesh });

  for (const wall of arena.walls) {
    sceneBootstrap.registerSceneActor({ key: wall.name, node: wall });
  }

  player.setState({
    ...player.getState(),
    position: new Vector3(
      APP_CONFIG.gameplay.player.spawnPosition.x,
      APP_CONFIG.gameplay.player.spawnPosition.y,
      APP_CONFIG.gameplay.player.spawnPosition.z
    )
  });

  // ============================================================================
  // Initialize Score System
  // ============================================================================
  const scoreSystem = new ScoreSystem();

  // ============================================================================
  // Asteroid Management
  // ============================================================================
  const asteroids: Asteroid[] = [];

  /**
   * Spawns a single asteroid and adds it to the tracking array.
   * Called by WaveManager during wave initialization.
   *
   * @param config The asteroid configuration (size, position, velocity)
   * @returns The created Asteroid instance
   */
  function spawnAsteroid(config: AsteroidConfig): Asteroid {
    const asteroid = new Asteroid(config, scene);
    asteroids.push(asteroid);
    sceneBootstrap.registerSceneActor({ key: `asteroid-${asteroids.length}`, node: asteroid.mesh });
    return asteroid;
  }

  /**
   * Spawns multiple asteroids in bulk.
   * Convenience method for wave spawning.
   *
   * @param configs Array of asteroid configurations
   * @returns Array of created Asteroid instances
   */
  function spawnAsteroids(configs: AsteroidConfig[]): Asteroid[] {
    return configs.map(config => spawnAsteroid(config));
  }

  // ============================================================================
  // Event Subscriptions for VFX, Scoring, and State Management
  // ============================================================================

  // Subscribe to asteroid destruction for VFX
  asteroidEvents.destroyed$.add((event) => {
    createAsteroidExplosion(sceneBootstrap.scene, event.position, event.size);
  });

  // Subscribe to asteroid children spawning (from splitting)
  // When an asteroid splits, add the children to the tracking array
  asteroidEvents.childrenSpawned$.add((event) => {
    for (const child of event.children) {
      asteroids.push(child);
      sceneBootstrap.registerSceneActor({ key: `asteroid-child-${asteroids.length}`, node: child.mesh });
    }
  });

  // Subscribe to player damage for VFX
  playerEvents.damaged$.add((event) => {
    applyPlayerDamageFlash(player.mesh, APP_CONFIG.gameplay.playerCombat.invulnerabilityDuration);
    playImpactShake(sceneBootstrap.camera, 1.0, 0.1);
  });

  // Subscribe to player death (Phase 3 will handle state transition to GAME_OVER)
  playerEvents.died$.add(() => {
    // Phase 3: Transition game state to GAME_OVER
  });

  // Subscribe to projectile destruction for VFX
  projectileEvents.destroyed$.add((event) => {
    if (event.asteroidHit) {
      createProjectileHitEffect(sceneBootstrap.scene, event.position, event.position.subtract(event.position.scale(2)));
    }
  });

  // ============================================================================
  // Main Game Loop
  // ============================================================================
  let accumulatorMs = 0;
  const fixedStepMs = APP_CONFIG.gameplay.fixedStepMs;
  const stepSeconds = fixedStepMs / 1000;

  const controller: GameController = {
    /**
     * Main update function called once per frame.
     * Accumulates delta time and executes a fixed timestep loop.
     *
     * Physics stepping occurs automatically through Babylon.js scene rendering.
     * Entity updates are sequenced AFTER physics resolution to ensure collision-aware motion.
     *
     * @param deltaMs Time elapsed since last frame in milliseconds
     */
    update: (deltaMs: number): void => {
      const clampedDeltaMs = Math.min(deltaMs, 100);
      accumulatorMs += clampedDeltaMs;

      while (accumulatorMs >= fixedStepMs) {
        // ====================================================================
        // Update Player
        // ====================================================================
        // Physics stepping is handled automatically by the Babylon.js engine
        // during the main render loop via scene.enablePhysics(). The physics world
        // resolves collisions and updates impostor velocities before this game update runs.
        player.update(stepSeconds);
        arena.containPlayer(player);

        // ====================================================================
        // Update All Asteroids
        // ====================================================================
        // Asteroid.update() handles:
        // - Rotation animation
        // - Mesh position sync from physics impostor velocity updates
        // - TTL/destruction checks (not currently used, but extensible)
        for (const asteroid of asteroids) {
          if (!asteroid.isDestroyed) {
            asteroid.update(stepSeconds);
          }
        }

        // ====================================================================
        // Remove Destroyed Asteroids from Tracking Array
        // ====================================================================
        // This triggers the asteroid's dispose() method, which unsubscribes from events
        // and cleans up mesh and physics impostor resources.
        let writeIdx = 0;
        for (let i = 0; i < asteroids.length; i++) {
          if (!asteroids[i].isDestroyed) {
            asteroids[writeIdx++] = asteroids[i];
          } else {
            asteroids[i].dispose();
          }
        }
        asteroids.length = writeIdx;

        // ====================================================================
        // Synchronize Camera Target to Player Position
        // ====================================================================
        const playerState = player.getState();
        syncCameraTarget(sceneBootstrap, playerState.position, playerState.yawRadians);

        accumulatorMs -= fixedStepMs;
      }
    },

    /**
     * Disposes all game resources and unsubscribes from events.
     * Called when the game is shutting down or transitioning states.
     */
    dispose: (): void => {
      // Dispose all asteroids
      for (const asteroid of asteroids) {
        if (!asteroid.isDestroyed) {
          asteroid.dispose();
        }
      }
      asteroids.length = 0;

      // Dispose core entities
      player.dispose();
      arena.dispose();

      // Dispose score system (unsubscribes from events)
      scoreSystem.dispose();

      // Dispose physics world (Cannon.js cleanup)
      if (physicsPlugin) {
        physicsPlugin.dispose();
      }
    },

    /**
     * Spawns a single asteroid and adds it to the tracking array.
     * Called by WaveManager during wave initialization.
     *
     * @param config The asteroid configuration (size, position, velocity)
     * @returns The created Asteroid instance
     */
    spawnAsteroid,

    /**
     * Spawns multiple asteroids in bulk.
     * Convenience method for wave spawning.
     *
     * @param configs Array of asteroid configurations
     * @returns Array of created Asteroid instances
     */
    spawnAsteroids
  };

  return controller;
}
