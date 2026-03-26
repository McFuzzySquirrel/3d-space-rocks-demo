import { Observable, Vector3, Quaternion, PhysicsImpostor } from "@babylonjs/core";
import type { Scene, Mesh, PhysicsImpostorParameters } from "@babylonjs/core";
import { createAsteroidMesh } from "../utils/MeshFactory";
import { collisionEvents } from "../systems/CollisionSystem";
import { PhysicsTuning } from "../systems/PhysicsTuning";
import { ASTEROID_CONFIG } from "../utils/Constants";

/**
 * Enumeration of asteroid sizes.
 */
export enum AsteroidSize {
  LARGE = "Large",
  MEDIUM = "Medium",
  SMALL = "Small"
}

/**
 * Health values for each asteroid size.
 * Represents the number of hits required to destroy an asteroid.
 */
export const AsteroidHealth = {
  [AsteroidSize.LARGE]: 3,
  [AsteroidSize.MEDIUM]: 2,
  [AsteroidSize.SMALL]: 1
} as const;

/**
 * Configuration object passed to the Asteroid constructor.
 */
export interface AsteroidConfig {
  readonly size: AsteroidSize;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly parent?: Asteroid;
}

/**
 * Event emitted when an asteroid is destroyed.
 */
export interface AsteroidDestroyedEvent {
  readonly asteroid: Asteroid;
  readonly size: AsteroidSize;
  readonly position: Vector3;
}

/**
 * Asteroid entity representing a destructible, rotating, bouncing asteroid.
 *
 * Asteroids have the following behaviors:
 * - Rotate slowly on random axes
 * - Move with constant velocity in space
 * - Bounce off arena barriers
 * - Take damage from projectiles
 * - Split into smaller asteroids when destroyed (except Small)
 * - Emit collision and destruction events for subscribers
 *
 * Physics:
 * - Uses a physics impostor (sphere, dynamic body)
 * - Restitution is high (bouncy) for arcade feel
 * - Damping is low to maintain constant velocity momentum
 * - Mass scales with size for realistic collision response
 */
export class Asteroid {
  private readonly _mesh: Mesh;
  private readonly _size: AsteroidSize;
  private _health: number;
  private _velocity: Vector3;
  private _destroyed: boolean = false;
  private _physicsImpostor: PhysicsImpostor;

  private _angularVelocity: Vector3 = Vector3.Zero();
  private _playerCollisionUnsubscribe: (() => void) | null = null;
  private _projectileCollisionUnsubscribe: (() => void) | null = null;

  public readonly mesh: Mesh;
  public readonly size: AsteroidSize;

  /**
   * Constructs an asteroid, creates its mesh, registers physics, and subscribes to collisions.
   *
   * @param config Configuration for the asteroid (size, position, velocity)
   * @param scene The Babylon.js scene
   */
  constructor(
    config: AsteroidConfig,
    scene: Scene
  ) {
    this._size = config.size;
    this.size = config.size;

    // Set initial health based on size
    this._health = AsteroidHealth[config.size];

    // Create mesh from the mesh factory
    this._mesh = createAsteroidMesh(config.size, scene);
    this.mesh = this._mesh;

    // Set position
    this._mesh.position.copyFrom(config.position);

    // Store velocity (constant movement in space)
    this._velocity = config.velocity.clone();

    // Initialize random rotation axes and angular velocity
    this._initializeRotation();

    // Register physics impostor (dynamic body that bounces)
    const mass = PhysicsTuning.ASTEROIDS.baseMass * PhysicsTuning.ASTEROIDS.massMultiplier[config.size];

    this._physicsImpostor = new PhysicsImpostor(
      this._mesh,
      PhysicsImpostor.SphereImpostor,
      {
        mass,
        restitution: PhysicsTuning.ASTEROIDS.restitution,
        friction: PhysicsTuning.ASTEROIDS.friction
      } as PhysicsImpostorParameters,
      scene
    );

    // Set damping properties on the underlying physics body (Cannon.js)
    // Access the private body property via type assertion
    const body = (this._physicsImpostor as any)._body;
    if (body) {
      body.linearDamping = PhysicsTuning.ASTEROIDS.damping;
      body.angularDamping = PhysicsTuning.ASTEROIDS.angularDamping;
    }

    // Set initial velocity on the physics impostor
    this._physicsImpostor.setLinearVelocity(this._velocity);

    // Subscribe to player-asteroid collision events
    this._subscribeToCollisions();
  }

  /**
   * Returns the current health of the asteroid.
   */
  public get health(): number {
    return this._health;
  }

  /**
   * Returns whether the asteroid has been destroyed.
   */
  public get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Gets the asteroid's current linear velocity.
   */
  public getVelocity(): Vector3 {
    const physicsVelocity = this._physicsImpostor.getLinearVelocity();
    return (physicsVelocity ?? this._velocity).clone();
  }

  /**
   * Sets the asteroid's linear velocity and syncs physics state.
   */
  public setVelocity(velocity: Vector3): void {
    this._velocity.copyFrom(velocity);
    this._physicsImpostor.setLinearVelocity(velocity);
  }

  /**
   * Initializes random rotation axes and angular velocity.
   * Asteroids rotate on random axes with speed between 0.5 and 1.0 rad/s
   */
  private _initializeRotation(): void {
    // Generate random unit vector for rotation axis
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const sinPhi = Math.sin(phi);

    const axisX = Math.sin(theta) * sinPhi;
    const axisY = Math.cos(phi);
    const axisZ = Math.cos(theta) * sinPhi;

    const rotationSpeed =
      ASTEROID_CONFIG.rotationSpeed.min +
      Math.random() * (ASTEROID_CONFIG.rotationSpeed.max - ASTEROID_CONFIG.rotationSpeed.min);

    this._angularVelocity = new Vector3(axisX, axisY, axisZ).scale(rotationSpeed);
  }

  /**
   * Subscribes to collision events.
   * When the asteroid collides with the player, emit a destruction event and destroy it.
   * When the asteroid collides with a projectile, take damage.
   */
  private _subscribeToCollisions(): void {
    // Subscribe to player-asteroid collision events
    const playerSubscription = collisionEvents.playerAsteroid$.add((event) => {
      if (event.target === this._mesh || event.source === this._mesh) {
        // Asteroid collided with player - destroy it
        this.takeDamage(this._health);
      }
    });

    this._playerCollisionUnsubscribe = () => {
      collisionEvents.playerAsteroid$.remove(playerSubscription);
    };

    // Subscribe to projectile-asteroid collision events
    const projectileSubscription = collisionEvents.projectileAsteroid$.add((event) => {
      if (event.target === this._mesh || event.source === this._mesh) {
        // Asteroid collided with projectile - take 1 damage
        this.takeDamage(1);
      }
    });

    this._projectileCollisionUnsubscribe = () => {
      collisionEvents.projectileAsteroid$.remove(projectileSubscription);
    };
  }

  /**
   * Applies damage to the asteroid, reducing health.
   * If health reaches 0 or below, triggers destruction.
   *
   * @param amount The amount of damage to apply (default 1)
   */
  public takeDamage(amount: number = 1): void {
    if (this._destroyed) {
      return;
    }

    this._health -= amount;

    if (this._health <= 0) {
      // Trigger destruction chain
      this.destroy();
    }
  }

  /**
   * Destroys the asteroid, removes it from the scene, and handles splitting logic.
   *
   * Returns an array of newly-spawned child asteroids (if applicable):
   * - Small asteroids: return empty array (no children)
   * - Medium asteroids: return 2 Small asteroids with offset positions and velocities
   * - Large asteroids: return 2 Medium asteroids with offset positions and velocities
   *
   * Children are NOT automatically added to the scene. The caller must manage scene insertion.
   *
   * @returns Array of child asteroids spawned by this destruction
   */
  public destroy(): Asteroid[] {
    if (this._destroyed) {
      return [];
    }

    this._destroyed = true;

    // Emit destruction event for VFX and scoring
    asteroidEvents.destroyed$.notifyObservers({
      asteroid: this,
      size: this._size,
      position: this._mesh.position.clone()
    });

    // Clean up collision subscriptions
    if (this._playerCollisionUnsubscribe) {
      this._playerCollisionUnsubscribe();
      this._playerCollisionUnsubscribe = null;
    }

    if (this._projectileCollisionUnsubscribe) {
      this._projectileCollisionUnsubscribe();
      this._projectileCollisionUnsubscribe = null;
    }

    // Clean up physics impostor if it exists
    if (this._physicsImpostor) {
      this._physicsImpostor.dispose();
    }

    // Remove mesh from scene
    if (!this._mesh.isDisposed()) {
      this._mesh.dispose();
    }

    // Determine if splitting should occur based on size
    if (this._size === AsteroidSize.SMALL) {
      // Small asteroids don't split
      return [];
    }

    // Determine child size
    const childSize =
      this._size === AsteroidSize.LARGE ? AsteroidSize.MEDIUM : AsteroidSize.SMALL;

    // Spawn 2 children with offset positions and spread velocities
    const children: Asteroid[] = [];

    for (let i = 0; i < 2; i++) {
      // Offset position slightly from parent to avoid immediate re-collision
      const offsetAngle = (i * Math.PI) + (Math.random() * 0.5);
      const offsetDistance = ASTEROID_CONFIG.spreadOffset;

      const offsetX = Math.cos(offsetAngle) * offsetDistance;
      const offsetZ = Math.sin(offsetAngle) * offsetDistance;

      const childPosition = this._mesh.position.add(new Vector3(offsetX, 0, offsetZ));

      // Spread child velocities outward from parent
      const spreadDirection = new Vector3(offsetX, 0, offsetZ).normalize();
      const spreadSpeed = ASTEROID_CONFIG.childSpreadSpeed;
      const childVelocity = this._velocity
        .add(spreadDirection.scale(spreadSpeed));

      const childConfig: AsteroidConfig = {
        size: childSize,
        position: childPosition,
        velocity: childVelocity,
        parent: this
      };

      // Create child asteroid (will be added to game tracking by Game.ts)
      const childAsteroid = new Asteroid(childConfig, this._mesh.getScene());

      children.push(childAsteroid);
    }

    // Emit event so the game system can track new asteroids
    asteroidEvents.childrenSpawned$.notifyObservers({
      parent: this,
      children
    });

    return children;
  }

  /**
   * Updates the asteroid's rotation and applies kinematic velocity.
   * Called once per game frame.
   *
   * @param deltaTime The elapsed time in seconds since the last frame
   */
  public update(deltaTime: number): void {
    if (this._destroyed) {
      return;
    }

    // Apply rotation
    const rotationQuat = this._mesh.rotationQuaternion;
    if (rotationQuat) {
      // Update rotation based on angular velocity
      const angularVelocityMag = this._angularVelocity.length();
      if (angularVelocityMag > 0) {
        const axis = this._angularVelocity.normalize();
        const angle = angularVelocityMag * deltaTime;

        const deltaQuat = Quaternion.RotationAxis(axis, angle);
        rotationQuat.multiplyInPlace(deltaQuat);
      }
    }

    // Update position based on constant velocity
    // Note: Physics impostor handles velocity, so we sync with it
    const currentVelocity = this._physicsImpostor.getLinearVelocity();
    if (!currentVelocity) {
      // Fallback if physics impostor velocity is undefined
      this._mesh.position.addInPlace(this._velocity.scale(deltaTime));
    }
  }

  /**
   * Cleans up resources for garbage collection.
   * Called when the asteroid is removed from the game permanently.
   */
  public dispose(): void {
    if (this._playerCollisionUnsubscribe) {
      this._playerCollisionUnsubscribe();
      this._playerCollisionUnsubscribe = null;
    }

    if (this._projectileCollisionUnsubscribe) {
      this._projectileCollisionUnsubscribe();
      this._projectileCollisionUnsubscribe = null;
    }

    if (this._physicsImpostor) {
      this._physicsImpostor.dispose();
    }

    if (!this._mesh.isDisposed()) {
      this._mesh.dispose();
    }
  }
}

/**
 * Event emitted when an asteroid spawns child asteroids (via splitting).
 */
export interface AsteroidChildrenSpawnedEvent {
  readonly parent: Asteroid;
  readonly children: Asteroid[];
}

/**
 * Observable events emitted by asteroids.
 * Subscribers (VFX, audio, scoring systems) listen for these events.
 */
export const asteroidEvents = {
  /**
   * Emitted when an asteroid is destroyed.
   * Contains the asteroid reference, its size, and destruction position.
   */
  destroyed$: new Observable<AsteroidDestroyedEvent>(),

  /**
   * Emitted when an asteroid spawns children (via splitting on destruction).
   * Contains the parent asteroid and array of children.
   * The game system uses this to track newly-spawned asteroids.
   */
  childrenSpawned$: new Observable<AsteroidChildrenSpawnedEvent>()
};
