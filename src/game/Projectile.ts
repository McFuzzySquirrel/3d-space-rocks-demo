import { Observable, Vector3, PhysicsImpostor } from "@babylonjs/core";
import type { Scene, Mesh, PhysicsImpostorParameters } from "@babylonjs/core";
import { createProjectileMesh } from "../utils/MeshFactory";
import { collisionEvents } from "../systems/CollisionSystem";
import { PhysicsTuning } from "../systems/PhysicsTuning";
import { PROJECTILE_CONFIG } from "../utils/Constants";
import type { AsteroidSize } from "./Asteroid";

/**
 * Enumeration of projectile types.
 * Extensible for future weapon types (missiles, beams, etc.)
 */
export enum ProjectileType {
  SHIP_FIRE = "SHIP_FIRE"
}

/**
 * Configuration object passed to the Projectile constructor.
 */
export interface ProjectileConfig {
  readonly type: ProjectileType;
  readonly position: Vector3;
  readonly direction: Vector3; // Unit vector
  readonly speed: number;
  readonly ttl: number; // Time-to-live in seconds
}

/**
 * Event emitted when a projectile is destroyed (TTL or collision).
 */
export interface ProjectileDestroyedEvent {
  readonly projectile: Projectile;
  readonly position: Vector3;
  readonly asteroidHit?: AsteroidSize;
}

/**
 * Projectile destruction event observable.
 * Published when a projectile expires or collides with an asteroid.
 */
export const projectileEvents = {
  destroyed$: new Observable<ProjectileDestroyedEvent>()
};

/**
 * Projectile entity representing a fired projectile from the player's ship.
 *
 * Projectiles have the following behaviors:
 * - Move in a straight line with constant velocity
 * - Expire after a fixed time (TTL) to prevent memory leaks
 * - Destroy on collision with asteroids
 * - Do not bounce (restitution = 0)
 * - Emit destruction events for VFX and scoring systems
 *
 * Physics:
 * - Uses a physics impostor (sphere, dynamic body)
 * - Restitution is zero (no bouncing)
 * - No damping (constant velocity in space)
 * - Very light mass relative to asteroids
 */
export class Projectile {
  private readonly _mesh: Mesh;
  private readonly _type: ProjectileType;
  private readonly _direction: Vector3;
  private readonly _speed: number;
  private readonly _ttl: number;
  private _isAlive: boolean = true;
  private _elapsedTime: number = 0;
  private _velocity: Vector3;
  private _physicsImpostor: PhysicsImpostor;

  private _collisionUnsubscribe: (() => void) | null = null;

  public readonly mesh: Mesh;
  public readonly type: ProjectileType;

  /**
   * Constructs a projectile, creates its mesh, registers physics, and subscribes to collisions.
   *
   * @param config Configuration for the projectile (type, position, direction, speed, ttl)
   * @param scene The Babylon.js scene
   */
  constructor(
    config: ProjectileConfig,
    scene: Scene
  ) {
    this._type = config.type;
    this.type = config.type;

    this._direction = config.direction.normalize().clone();
    this._speed = config.speed;
    this._ttl = config.ttl;

    // Calculate velocity from direction and speed
    this._velocity = this._direction.scale(this._speed);

    // Create mesh from the mesh factory
    this._mesh = createProjectileMesh(scene);
    this.mesh = this._mesh;

    // Set position
    this._mesh.position.copyFrom(config.position);

    // Register physics impostor (dynamic body, non-bouncy)
    this._physicsImpostor = new PhysicsImpostor(
      this._mesh,
      PhysicsImpostor.SphereImpostor,
      {
        mass: PhysicsTuning.PROJECTILES.mass,
        restitution: PhysicsTuning.PROJECTILES.restitution,
        friction: PhysicsTuning.PROJECTILES.friction
      } as PhysicsImpostorParameters,
      scene
    );

    // Set damping properties on the underlying physics body (Cannon.js)
    const body = (this._physicsImpostor as any)._body;
    if (body) {
      body.linearDamping = PhysicsTuning.PROJECTILES.damping;
      body.angularDamping = PhysicsTuning.PROJECTILES.angularDamping;
    }

    // Set initial velocity on the physics impostor
    this._physicsImpostor.setLinearVelocity(this._velocity);

    // Subscribe to projectile-asteroid collision events
    this._subscribeToCollisions();
  }

  /**
   * Returns the velocity vector of the projectile.
   * Calculated from direction and speed.
   */
  public get velocity(): Vector3 {
    return this._velocity.clone();
  }

  /**
   * Returns whether the projectile is still alive.
   * False once TTL expires or collision is detected.
   */
  public get isAlive(): boolean {
    return this._isAlive;
  }

  /**
   * Updates the projectile for the given delta time.
   * Increments the elapsed time counter and destroys if TTL exceeded.
   *
   * @param deltaTime The time elapsed since last frame, in seconds
   */
  public update(deltaTime: number): void {
    if (!this._isAlive) {
      return;
    }

    this._elapsedTime += deltaTime;

    // Destroy if TTL exceeded
    if (this._elapsedTime >= this._ttl) {
      this.destroy();
    }
  }

  /**
   * Subscribes to projectileAsteroid$ collision event.
   * When the projectile collides with an asteroid, emit a destruction event.
   */
  private _subscribeToCollisions(): void {
    const subscription = collisionEvents.projectileAsteroid$.add((event) => {
      if ((event.source === this._mesh || event.target === this._mesh) && this._isAlive) {
        // Determine which mesh is the asteroid
        const asteroidMesh = event.source === this._mesh ? event.target : event.source;

        // Destroy the projectile and emit event with asteroid info
        // Note: We don't have direct access to the asteroid object here,
        // so we leave asteroidHit undefined. The collision system will need to
        // coordinate with the gameplay system to map mesh to AsteroidSize.
        this.destroy();
      }
    });

    this._collisionUnsubscribe = () => {
      collisionEvents.projectileAsteroid$.remove(subscription);
    };
  }

  /**
   * Destroys the projectile by removing it from the scene and emitting an event.
   * Marks the projectile as dead and unsubscribes from collision events.
   */
  public destroy(): void {
    if (!this._isAlive) {
      return;
    }

    this._isAlive = false;

    // Capture position before destruction for the event
    const destroyPosition = this._mesh.position.clone();

    // Unsubscribe from collision events
    if (this._collisionUnsubscribe) {
      this._collisionUnsubscribe();
      this._collisionUnsubscribe = null;
    }

    // Remove physics impostor
    if (this._physicsImpostor) {
      this._physicsImpostor.dispose();
    }

    // Emit destruction event
    projectileEvents.destroyed$.notifyObservers({
      projectile: this,
      position: destroyPosition
    });

    // Dispose of mesh
    this._mesh.dispose();
  }

  /**
   * Final cleanup for garbage collection.
   * Should be called when the projectile is no longer referenced.
   */
  public dispose(): void {
    if (this._collisionUnsubscribe) {
      this._collisionUnsubscribe();
      this._collisionUnsubscribe = null;
    }

    if (this._physicsImpostor) {
      this._physicsImpostor.dispose();
    }

    if (!this._mesh.isDisposed()) {
      this._mesh.dispose();
    }
  }
}
