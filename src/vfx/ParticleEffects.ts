import {
  ParticleSystem,
  Vector3,
  Color3,
  Color4,
  Texture,
  Scene,
  MeshBuilder,
  Mesh
} from "@babylonjs/core";
import { AsteroidSize } from "../game/Asteroid";
import { VFX_CONFIG } from "../utils/Constants";

/**
 * Creates a particle system for asteroid explosion.
 *
 * Effect details:
 * - Brightness: yellow/white initial → orange → red → dissipate
 * - Particles: count scales with asteroid size
 * - Duration: ~0.8–1.0s total lifetime
 * - Spread: radial outward from position
 * - Speed: scaled with size (Large faster, Small slower)
 *
 * The particle system is configured to auto-dispose after full duration
 * to prevent memory accumulation.
 *
 * @param scene The Babylon.js scene
 * @param position Center of explosion
 * @param asteroidSize Size of destroyed asteroid
 * @returns ParticleSystem instance (consumer may track for disposal if needed)
 */
export function createAsteroidExplosion(
  scene: Scene,
  position: Vector3,
  asteroidSize: AsteroidSize
): ParticleSystem {
  const config = VFX_CONFIG.explosions;
  const particleCount = config.particleCountBySize[asteroidSize];
  const duration = config.durationBySize[asteroidSize];
  const emissionSpeed = config.speedBySize[asteroidSize];

  // Create a temporary emitter mesh at explosion center
  const emitterMesh = MeshBuilder.CreateSphere("explosion-emitter", { segments: 2 }, scene);
  emitterMesh.position.copyFrom(position);
  emitterMesh.isVisible = false;

  // Create particle system
  const particleSystem = new ParticleSystem("asteroid-explosion", particleCount * 2, scene);
  particleSystem.emitter = emitterMesh;

  // Particle appearance: gradient from yellow/white to orange to red
  particleSystem.addColorGradient(
    0,
    new Color4(1, 0.9, 0.3, 1)
  );
  particleSystem.addColorGradient(
    0.3,
    new Color4(1, 0.6, 0, 1)
  );
  particleSystem.addColorGradient(
    0.6,
    new Color4(1, 0.2, 0, 1)
  );
  particleSystem.addColorGradient(
    1,
    new Color4(1, 0, 0, 0.5)
  );

  // Size over lifetime: particles shrink as they fade
  particleSystem.addSizeGradient(0, 0.5);
  particleSystem.addSizeGradient(0.5, 0.3);
  particleSystem.addSizeGradient(1, 0.05);

  // Alpha (transparency) over lifetime: full opacity → fade out
  particleSystem.addAlphaRemapGradient(0, 1, 1);
  particleSystem.addAlphaRemapGradient(0.8, 0.8, 0);
  particleSystem.addAlphaRemapGradient(1, 0, 0);

  // Emission settings: rapid burst (all particles emitted within first 50-100ms)
  particleSystem.emitRate = particleCount * 10;

  // Particle lifetime
  particleSystem.minLifeTime = duration * 0.8;
  particleSystem.maxLifeTime = duration;

  // Emission volume: spread around center
  particleSystem.minEmitBox = new Vector3(-0.5, -0.5, -0.5);
  particleSystem.maxEmitBox = new Vector3(0.5, 0.5, 0.5);

  // Directional emission: spread out radially
  particleSystem.direction1 = new Vector3(-1, -1, -1);
  particleSystem.direction2 = new Vector3(1, 1, 1);

  // Emission speed
  particleSystem.minEmitPower = emissionSpeed * 0.8;
  particleSystem.maxEmitPower = emissionSpeed * 1.2;

  // Gravity and damping: slight downward gravity for arcade feel
  particleSystem.gravity = new Vector3(0, -2, 0);
  particleSystem.addDragGradient(0, 0.1);
  particleSystem.addDragGradient(0.5, 0.3);
  particleSystem.addDragGradient(1, 0.6);

  // Use a simple particle texture
  particleSystem.particleTexture = new Texture(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    scene
  );

  // Start emission immediately
  particleSystem.start();

  // Schedule disposal after duration to prevent memory leaks
  const totalDuration = duration * 1000; // Convert to ms
  setTimeout(() => {
    particleSystem.stop();
    particleSystem.dispose();
    emitterMesh.dispose();
  }, totalDuration + 500); // Extra buffer for final particles to clear

  return particleSystem;
}

/**
 * Creates a smaller, directional particle hit effect for projectile impacts.
 *
 * Effect details:
 * - Brightness: cyan/white flash
 * - Particles: ~30 for a sharp impact
 * - Duration: 0.3–0.4s
 * - Direction: along impact normal (direction parameter)
 * - Purpose: secondary feedback emphasizing projectile impact
 *
 * @param scene The Babylon.js scene
 * @param position Impact point
 * @param direction Impact direction (unit vector)
 * @returns ParticleSystem instance
 */
export function createProjectileHitEffect(
  scene: Scene,
  position: Vector3,
  direction: Vector3
): ParticleSystem {
  const emitterMesh = MeshBuilder.CreateSphere("hit-emitter", { segments: 1 }, scene);
  emitterMesh.position.copyFrom(position);
  emitterMesh.isVisible = false;

  const particleSystem = new ParticleSystem("projectile-hit", 30, scene);
  particleSystem.emitter = emitterMesh;

  // Cyan/white flash colors
  particleSystem.addColorGradient(
    0,
    new Color4(0.3, 1, 1, 1)
  );
  particleSystem.addColorGradient(
    0.5,
    new Color4(0.2, 0.8, 1, 1)
  );
  particleSystem.addColorGradient(
    1,
    new Color4(0, 0.5, 1, 0.5)
  );

  // Size: small and quick
  particleSystem.addSizeGradient(0, 0.2);
  particleSystem.addSizeGradient(0.5, 0.1);
  particleSystem.addSizeGradient(1, 0.02);

  // Alpha fade
  particleSystem.addAlphaRemapGradient(0, 1, 1);
  particleSystem.addAlphaRemapGradient(0.7, 0.7, 0);
  particleSystem.addAlphaRemapGradient(1, 0, 0);

  // Rapid emission: all in first 30ms
  particleSystem.emitRate = 300;

  // Short lifetime
  particleSystem.minLifeTime = 0.35;
  particleSystem.maxLifeTime = 0.45;

  // Directional spread along impact normal
  particleSystem.minEmitPower = 8;
  particleSystem.maxEmitPower = 12;

  // Emit in a cone around the impact direction
  const angle = Math.PI / 6; // 30-degree cone
  particleSystem.direction1 = new Vector3(
    direction.x - angle,
    direction.y - angle,
    direction.z - angle
  );
  particleSystem.direction2 = new Vector3(
    direction.x + angle,
    direction.y + angle,
    direction.z + angle
  );

  // Minimal gravity for quick dissipation
  particleSystem.gravity = new Vector3(0, -0.5, 0);
  particleSystem.addDragGradient(0, 0.05);
  particleSystem.addDragGradient(1, 0.4);

  // Simple particle texture
  particleSystem.particleTexture = new Texture(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    scene
  );

  particleSystem.start();

  // Auto-dispose after short duration
  const totalDuration = 0.45 * 1000;
  setTimeout(() => {
    particleSystem.stop();
    particleSystem.dispose();
    emitterMesh.dispose();
  }, totalDuration + 300);

  return particleSystem;
}
