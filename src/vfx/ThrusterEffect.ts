import {
  ParticleSystem,
  MeshBuilder,
  Vector3,
  Color4,
  Scene,
  AbstractMesh,
  Mesh
} from "@babylonjs/core";
import { VFX_CONFIG } from "../utils/Constants";

const SPREAD = 0.5;
const MIN_EMIT_POWER = 1;
const MAX_EMIT_POWER = 3;

/**
 * Continuous thruster particle effect parented to the ship mesh.
 *
 * Emits a cyan/blue-white exhaust cone from the ship rear when thrusting.
 * Direction vectors are updated each frame to follow the ship's current heading.
 *
 * Lifecycle: construct once, call update() every frame, call dispose() on cleanup.
 */
export class ThrusterEffect {
  private readonly _particleSystem: ParticleSystem;
  private readonly _emitterMesh: Mesh;
  private readonly _parentMesh: AbstractMesh;

  constructor(scene: Scene, parentMesh: AbstractMesh) {
    this._parentMesh = parentMesh;

    // Invisible emitter mesh anchored at ship rear in parent-mesh local space
    this._emitterMesh = MeshBuilder.CreateSphere("thruster-emitter", { segments: 1, diameter: 0.1 }, scene);
    this._emitterMesh.isVisible = false;
    this._emitterMesh.isPickable = false;
    this._emitterMesh.parent = parentMesh;
    this._emitterMesh.position = new Vector3(0, 0, -1.5);

    const config = VFX_CONFIG.thruster;

    this._particleSystem = new ParticleSystem("thruster", config.capacity, scene);
    this._particleSystem.emitter = this._emitterMesh;

    // Color gradient: cyan/blue-white → deep blue → transparent
    this._particleSystem.addColorGradient(0, new Color4(0.5, 0.8, 1.0, 1.0));
    this._particleSystem.addColorGradient(0.5, new Color4(0.1, 0.3, 0.9, 0.8));
    this._particleSystem.addColorGradient(1, new Color4(0.0, 0.1, 0.5, 0.0));

    // Particle size
    this._particleSystem.minSize = config.minSize;
    this._particleSystem.maxSize = config.maxSize;

    // Particle lifetime
    this._particleSystem.minLifeTime = config.minLifetime;
    this._particleSystem.maxLifeTime = config.maxLifetime;

    // Tight emission volume around the nozzle
    this._particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    this._particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    // Emission speed
    this._particleSystem.minEmitPower = MIN_EMIT_POWER;
    this._particleSystem.maxEmitPower = MAX_EMIT_POWER;

    // Additive blend for a glowing plasma look
    this._particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

    // No gravity — exhaust drifts in deep space
    this._particleSystem.gravity = Vector3.Zero();

    // Start with emission off; update() gates the emit rate
    this._particleSystem.emitRate = 0;
    this._particleSystem.start();
  }

  /**
   * Called every frame. Toggles emission and realigns exhaust direction
   * to track the ship's current heading.
   */
  update(isThrusting: boolean): void {
    const config = VFX_CONFIG.thruster;
    this._particleSystem.emitRate = isThrusting ? config.emitRate : 0;

    if (isThrusting) {
      // Compute backward world-space direction from ship's current yaw
      const yaw = this._parentMesh.rotation.y;
      const bx = -Math.sin(yaw);
      const bz = -Math.cos(yaw);

      this._particleSystem.direction1 = new Vector3(
        bx * 2 - SPREAD,
        -SPREAD,
        bz * 2 - SPREAD
      );
      this._particleSystem.direction2 = new Vector3(
        bx * 4 + SPREAD,
        SPREAD,
        bz * 4 + SPREAD
      );
    }
  }

  dispose(): void {
    this._particleSystem.stop();
    this._particleSystem.dispose();
    this._emitterMesh.dispose();
  }
}
