import {
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Scene,
  Texture,
  Vector3
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle } from "@babylonjs/gui";
import { VFX_CONFIG } from "../utils/Constants";

const ONE_PIXEL_PARTICLE_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function createHiddenEmitter(scene: Scene, name: string, position: Vector3): Mesh {
  const emitter = MeshBuilder.CreateSphere(name, { segments: 2, diameter: 0.25 }, scene);
  emitter.position.copyFrom(position);
  emitter.isVisible = false;
  emitter.isPickable = false;
  return emitter;
}

function disposeBurstEffect(particleSystem: ParticleSystem, emitter: Mesh, afterMs: number): void {
  setTimeout(() => {
    if (!particleSystem.isDisposed) {
      particleSystem.stop();
      particleSystem.dispose();
    }

    if (!emitter.isDisposed()) {
      emitter.dispose(false, true);
    }
  }, afterMs);
}

/**
 * Brief volumetric celebration burst used when an area is fully complete.
 */
export function playAreaCompleteCelebration(
  scene: Scene,
  arenaCenter: Vector3,
  arenaHalfSize: Vector3
): void {
  const particleCount = VFX_CONFIG.completion.areaParticleCount;
  const emitter = createHiddenEmitter(scene, "area-complete-emitter", arenaCenter);
  const particles = new ParticleSystem("area-complete-celebration", particleCount * 2, scene);

  particles.emitter = emitter;
  particles.particleTexture = new Texture(ONE_PIXEL_PARTICLE_TEXTURE, scene);

  particles.addColorGradient(0, new Color4(1, 1, 1, 1));
  particles.addColorGradient(0.35, new Color4(0.75, 1, 0.75, 0.9));
  particles.addColorGradient(1, new Color4(0.45, 1, 0.45, 0));

  particles.addSizeGradient(0, 0.55);
  particles.addSizeGradient(0.6, 0.35);
  particles.addSizeGradient(1, 0.06);

  particles.addAlphaRemapGradient(0, 1, 1);
  particles.addAlphaRemapGradient(0.45, 0.9, 0.3);
  particles.addAlphaRemapGradient(1, 0, 0);

  particles.emitRate = particleCount * 12;
  particles.manualEmitCount = particleCount;
  particles.minLifeTime = 0.45;
  particles.maxLifeTime = 0.8;

  const emitExtent = new Vector3(
    Math.max(1, arenaHalfSize.x * 0.12),
    Math.max(1, arenaHalfSize.y * 0.12),
    Math.max(1, arenaHalfSize.z * 0.12)
  );
  particles.minEmitBox = emitExtent.scale(-1);
  particles.maxEmitBox = emitExtent;

  particles.direction1 = new Vector3(-1, -1, -1);
  particles.direction2 = new Vector3(1, 1, 1);
  particles.minEmitPower = 8;
  particles.maxEmitPower = 14;
  particles.gravity = new Vector3(0, -1, 0);

  particles.addDragGradient(0, 0.02);
  particles.addDragGradient(1, 0.35);

  particles.start();
  disposeBurstEffect(particles, emitter, 1100);
}

/**
 * Light completion pulse used between waves.
 */
export function playWaveCompletePulse(scene: Scene, arenaCenter: Vector3): void {
  const particleCount = VFX_CONFIG.completion.wavePulseParticleCount;
  const emitter = createHiddenEmitter(scene, "wave-complete-emitter", arenaCenter);
  const particles = new ParticleSystem("wave-complete-pulse", particleCount * 2, scene);

  particles.emitter = emitter;
  particles.particleTexture = new Texture(ONE_PIXEL_PARTICLE_TEXTURE, scene);

  particles.addColorGradient(0, new Color4(1, 1, 1, 1));
  particles.addColorGradient(0.5, new Color4(0.4, 0.95, 1, 0.85));
  particles.addColorGradient(1, new Color4(0.3, 0.8, 1, 0));

  particles.addSizeGradient(0, 0.32);
  particles.addSizeGradient(0.7, 0.18);
  particles.addSizeGradient(1, 0.05);

  particles.emitRate = particleCount * 12;
  particles.manualEmitCount = particleCount;
  particles.minLifeTime = 0.22;
  particles.maxLifeTime = 0.4;
  particles.minEmitBox = new Vector3(-1.2, -0.8, -1.2);
  particles.maxEmitBox = new Vector3(1.2, 0.8, 1.2);
  particles.direction1 = new Vector3(-0.8, -0.2, -0.8);
  particles.direction2 = new Vector3(0.8, 0.8, 0.8);
  particles.minEmitPower = 4;
  particles.maxEmitPower = 7;
  particles.gravity = new Vector3(0, -0.4, 0);

  particles.start();
  disposeBurstEffect(particles, emitter, 650);

  const ui = AdvancedDynamicTexture.CreateFullscreenUI("wave-complete-flash", true, scene);
  const flash = new Rectangle("wave-complete-flash-rect");
  flash.width = 1;
  flash.height = 1;
  flash.thickness = 0;
  flash.background = "#E6FFFF";
  flash.alpha = 0.06;
  ui.addControl(flash);

  setTimeout(() => {
    flash.alpha = 0;
    ui.dispose();
  }, 150);
}

/**
 * Looping beacon that marks the opened exit zone until disposed by caller.
 */
export function playExitZoneBeacon(scene: Scene, exitPosition: Vector3): ParticleSystem {
  const particleCount = VFX_CONFIG.completion.exitBeaconParticleCount;
  const emitter = createHiddenEmitter(scene, "exit-zone-beacon-emitter", exitPosition);
  const particles = new ParticleSystem("exit-zone-beacon", particleCount * 3, scene);

  particles.emitter = emitter;
  particles.particleTexture = new Texture(ONE_PIXEL_PARTICLE_TEXTURE, scene);

  particles.addColorGradient(0, new Color4(0.75, 1, 0.75, 0.8));
  particles.addColorGradient(0.7, new Color4(0.45, 1, 0.45, 0.55));
  particles.addColorGradient(1, new Color4(0.25, 0.9, 0.25, 0));

  particles.addSizeGradient(0, 0.28);
  particles.addSizeGradient(0.6, 0.2);
  particles.addSizeGradient(1, 0.08);

  particles.emitRate = particleCount;
  particles.minLifeTime = 1.3;
  particles.maxLifeTime = 2.1;
  particles.minEmitBox = new Vector3(-1.4, -0.4, -1.4);
  particles.maxEmitBox = new Vector3(1.4, 0.4, 1.4);

  particles.direction1 = new Vector3(-0.2, 0.7, -0.2);
  particles.direction2 = new Vector3(0.2, 1.4, 0.2);
  particles.minEmitPower = 0.7;
  particles.maxEmitPower = 1.4;
  particles.gravity = new Vector3(0, 0.45, 0);

  particles.updateSpeed = 0.02;
  particles.start();

  particles.onDisposeObservable.add(() => {
    if (!emitter.isDisposed()) {
      emitter.dispose(false, true);
    }
  });

  return particles;
}