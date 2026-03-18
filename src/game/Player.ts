import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Observable, Vector3 } from "@babylonjs/core";
import type { Scene, Mesh } from "@babylonjs/core";
import { Projectile, ProjectileType, projectileEvents } from "./Projectile";
import { collisionEvents, type CollisionEvent } from "../systems/CollisionSystem";
import { PLAYER_COMBAT_CONFIG, PROJECTILE_CONFIG } from "../utils/Constants";

/**
 * Configuration object for player creation.
 */
export interface PlayerConfig {
  readonly thrustAcceleration: number;
  readonly turnSpeedRadians: number;
  readonly dragPerSecond: number;
  readonly maxSpeed: number;
  readonly collisionRadius: number;
  readonly spawnPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

/**
 * Player state snapshot for save/restore.
 */
export interface PlayerState {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly yawRadians: number;
}

/**
 * Player controller interface for compatibility with Arena and Game systems.
 * This is the public API that Game.ts and Arena.ts consume.
 */
export interface PlayerController {
  readonly mesh: Mesh;
  readonly collisionRadius: number;
  update: (deltaSeconds: number) => void;
  getState: () => PlayerState;
  setState: (state: PlayerState) => void;
  dispose: () => void;
}

/**
 * Event emitted when player fires a projectile.
 */
export interface PlayerFiredEvent {
  readonly ship: Player;
  readonly position: Vector3;
  readonly direction: Vector3;
}

/**
 * Event emitted when player takes damage.
 */
export interface PlayerDamagedEvent {
  readonly ship: Player;
  readonly lives: number;
  readonly isInvulnerable: boolean;
}

/**
 * Event emitted when player is destroyed (0 lives).
 */
export interface PlayerDiedEvent {
  readonly ship: Player;
}

/**
 * Player events observables for vfx, audio, and game state management.
 */
export const playerEvents = {
  fired$: new Observable<PlayerFiredEvent>(),
  damaged$: new Observable<PlayerDamagedEvent>(),
  died$: new Observable<PlayerDiedEvent>()
};

/**
 * Player entity representing the spaceship controlled by the player.
 *
 * Responsibilities:
 * - Manage ship mesh and physics impostor
 * - Handle keyboard input for movement and firing
 * - Track lives and invulnerability state
 * - Create and track active projectiles
 * - Subscribe to asteroid collision events
 * - Emit events for vfx, audio, and game state systems
 */
export class Player {
  private readonly _mesh: Mesh;
  private readonly _config: PlayerConfig;
  private _position: Vector3;
  private _velocity: Vector3;
  private _yawRadians: number = 0;
  private _inputState: {
    thrustForward: boolean;
    rotateLeft: boolean;
    rotateRight: boolean;
  } = {
    thrustForward: false,
    rotateLeft: false,
    rotateRight: false
  };

  // Combat state
  private _lives: number;
  private _isInvulnerable: boolean = false;
  private _invulnerabilityTimeRemaining: number = 0;
  private _fireReadyTime: number = 0;
  private _activeProjectiles: Projectile[] = [];

  // Collision subscription
  private _asteroidCollisionUnsubscribe: (() => void) | null = null;

  // Input listeners
  private _onKeyDown: ((event: KeyboardEvent) => void) | null = null;
  private _onKeyUp: ((event: KeyboardEvent) => void) | null = null;

  public readonly mesh: Mesh;
  public readonly collisionRadius: number;

  constructor(scene: Scene, config: PlayerConfig) {
    this._config = config;
    this.collisionRadius = config.collisionRadius;

    // Initialize position and state
    this._position = new Vector3(
      config.spawnPosition.x,
      config.spawnPosition.y,
      config.spawnPosition.z
    );
    this._velocity = Vector3.Zero();

    // Initialize combat state
    this._lives = PLAYER_COMBAT_CONFIG.maxLives;

    // Create mesh
    this._mesh = this._createShipMesh(scene);
    this.mesh = this._mesh;
    this._mesh.position.copyFrom(this._position);
    this._mesh.rotation.y = this._yawRadians;

    // Register input handlers
    this._registerInputHandlers();

    // Subscribe to asteroid collision events
    this._subscribeToCollisions();
  }

  /**
   * Gets the current lives remaining (0 = dead).
   */
  public get lives(): number {
    return this._lives;
  }

  /**
   * Gets whether the player is currently invulnerable.
   */
  public get isInvulnerable(): boolean {
    return this._isInvulnerable;
  }

  /**
   * Gets the list of active projectiles spawned by this player.
   */
  public get activeProjectiles(): ReadonlyArray<Projectile> {
    return this._activeProjectiles;
  }

  /**
   * Gets the current player state (position, velocity, yaw).
   */
  public getState(): PlayerState {
    return {
      position: this._position.clone(),
      velocity: this._velocity.clone(),
      yawRadians: this._yawRadians
    };
  }

  /**
   * Sets the player state (position, velocity, yaw).
   */
  public setState(state: PlayerState): void {
    this._position.copyFrom(state.position);
    this._velocity.copyFrom(state.velocity);
    this._yawRadians = state.yawRadians;

    this._mesh.position.copyFrom(this._position);
    this._mesh.rotation.y = this._yawRadians;
  }

  /**
   * Fires a projectile forward from the ship.
   * Checks fire cooldown; ignores if not ready.
   * Emits playerFired$ event for audio/vfx subscribers.
   */
  public fire(): void {
    // Check if fire is on cooldown
    if (this._fireReadyTime > 0) {
      return;
    }

    // Cap projectiles to prevent spam
    if (this._activeProjectiles.length >= 10) {
      return;
    }

    // Calculate spawn position: 2 units forward along ship heading
    const heading = new Vector3(Math.sin(this._yawRadians), 0, Math.cos(this._yawRadians));
    const spawnPosition = this._position.add(heading.scale(PLAYER_COMBAT_CONFIG.projectileSpawnDistance));

    // Create projectile with direction and speed from config
    const projectile = new Projectile(
      {
        type: ProjectileType.SHIP_FIRE,
        position: spawnPosition,
        direction: heading,
        speed: PROJECTILE_CONFIG.speed,
        ttl: PROJECTILE_CONFIG.ttl
      },
      this._mesh.getScene()
    );

    // Track and subscribe to destruction
    this._activeProjectiles.push(projectile);
    const destroyedSubscription = projectileEvents.destroyed$.add(() => {
      const index = this._activeProjectiles.indexOf(projectile);
      if (index !== -1) {
        this._activeProjectiles.splice(index, 1);
      }
    });

    // Reset cooldown
    this._fireReadyTime = PLAYER_COMBAT_CONFIG.fireRateCooldown;

    // Emit fired event for audio/vfx
    playerEvents.fired$.notifyObservers({
      ship: this,
      position: spawnPosition,
      direction: heading
    });
  }

  /**
   * Handles collision with an asteroid.
   * Decreases lives; if > 0, sets invulnerability + emits damaged event.
   * If lives <= 0, emits died event.
   */
  public takeDamage(amount: number = 1): void {
    if (this._isInvulnerable) {
      return;
    }

    this._lives -= amount;

    if (this._lives > 0) {
      // Still alive: activate invulnerability and emit damaged event
      this._isInvulnerable = true;
      this._invulnerabilityTimeRemaining = PLAYER_COMBAT_CONFIG.invulnerabilityDuration;

      playerEvents.damaged$.notifyObservers({
        ship: this,
        lives: this._lives,
        isInvulnerable: true
      });
    } else {
      // Dead: emit died event (Game.ts will transition to GAME_OVER)
      playerEvents.died$.notifyObservers({
        ship: this
      });
    }
  }

  /**
   * Updates player state for the given delta time.
   * Handles movement, firing cooldown, invulnerability, and projectile updates.
   */
  public update(deltaSeconds: number): void {
    // Update invulnerability countdown
    if (this._isInvulnerable) {
      this._invulnerabilityTimeRemaining -= deltaSeconds;
      if (this._invulnerabilityTimeRemaining <= 0) {
        this._isInvulnerable = false;
      }
    }

    // Update fire cooldown countdown
    if (this._fireReadyTime > 0) {
      this._fireReadyTime -= deltaSeconds;
    }

    // Update movement
    this._updateMovement(deltaSeconds);

    // Update all active projectiles and clean up destroyed ones
    for (let i = this._activeProjectiles.length - 1; i >= 0; i--) {
      const projectile = this._activeProjectiles[i];
      projectile.update(deltaSeconds);

      if (!projectile.isAlive) {
        projectile.dispose();
        this._activeProjectiles.splice(i, 1);
      }
    }

    // Sync mesh position and rotation
    this._mesh.position.copyFrom(this._position);
    this._mesh.rotation.y = this._yawRadians;
  }

  /**
   * Disposes of all resources (mesh, projectiles, input handlers, collision subscription).
   */
  public dispose(): void {
    // Clear all active projectiles
    for (const projectile of this._activeProjectiles) {
      projectile.dispose();
    }
    this._activeProjectiles = [];

    // Unsubscribe from collision events
    if (this._asteroidCollisionUnsubscribe) {
      this._asteroidCollisionUnsubscribe();
      this._asteroidCollisionUnsubscribe = null;
    }

    // Remove input listeners
    if (this._onKeyDown) {
      window.removeEventListener("keydown", this._onKeyDown);
    }
    if (this._onKeyUp) {
      window.removeEventListener("keyup", this._onKeyUp);
    }

    // Dispose mesh
    if (!this._mesh.isDisposed()) {
      this._mesh.dispose(false, true);
    }
  }

  /**
   * Creates the ship mesh (cylinder with thruster).
   */
  private _createShipMesh(scene: Scene): Mesh {
    const ship = MeshBuilder.CreateCylinder(
      "player-ship",
      {
        height: 5,
        diameterTop: 0,
        diameterBottom: 2.2,
        tessellation: 3
      },
      scene
    );

    ship.rotation.x = Math.PI / 2;

    const bodyMaterial = new StandardMaterial("player-ship-material", scene);
    bodyMaterial.diffuseColor = new Color3(0.72, 0.83, 0.95);
    bodyMaterial.emissiveColor = new Color3(0.12, 0.16, 0.22);
    ship.material = bodyMaterial;

    const thruster = MeshBuilder.CreateCylinder(
      "player-ship-thruster",
      {
        height: 0.8,
        diameter: 0.7,
        tessellation: 24
      },
      scene
    );

    thruster.parent = ship;
    thruster.position.z = -2.5;

    const thrusterMaterial = new StandardMaterial("player-ship-thruster-material", scene);
    thrusterMaterial.diffuseColor = new Color3(0.2, 0.45, 0.75);
    thrusterMaterial.emissiveColor = new Color3(0.1, 0.32, 0.75);
    thruster.material = thrusterMaterial;

    return ship;
  }

  /**
   * Registers keyboard input handlers for movement and firing.
   */
  private _registerInputHandlers(): void {
    this._onKeyDown = (event: KeyboardEvent): void => {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          this._inputState.thrustForward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          this._inputState.rotateLeft = true;
          break;
        case "KeyD":
        case "ArrowRight":
          this._inputState.rotateRight = true;
          break;
        case "Space":
          event.preventDefault();
          this.fire();
          break;
        default:
          break;
      }
    };

    this._onKeyUp = (event: KeyboardEvent): void => {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          this._inputState.thrustForward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          this._inputState.rotateLeft = false;
          break;
        case "KeyD":
        case "ArrowRight":
          this._inputState.rotateRight = false;
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  /**
   * Updates player movement based on input and physics.
   */
  private _updateMovement(deltaSeconds: number): void {
    // Handle rotation
    const turnInput = Number(this._inputState.rotateLeft) - Number(this._inputState.rotateRight);
    this._yawRadians += turnInput * this._config.turnSpeedRadians * deltaSeconds;

    // Handle thrust
    if (this._inputState.thrustForward) {
      const forward = new Vector3(Math.sin(this._yawRadians), 0, Math.cos(this._yawRadians));
      this._velocity.addInPlace(forward.scale(this._config.thrustAcceleration * deltaSeconds));
    }

    // Apply drag and clamp speed
    const dragFactor = Math.max(0, 1 - this._config.dragPerSecond * deltaSeconds);
    this._velocity.scaleInPlace(dragFactor);
    this._clampSpeed(this._velocity, this._config.maxSpeed);

    // Update position
    this._position.addInPlace(this._velocity.scale(deltaSeconds));
  }

  /**
   * Clamps velocity to max speed.
   */
  private _clampSpeed(velocity: Vector3, maxSpeed: number): void {
    const speed = velocity.length();

    if (speed <= maxSpeed || speed === 0) {
      return;
    }

    velocity.scaleInPlace(maxSpeed / speed);
  }

  /**
   * Subscribes to asteroid collision events.
   */
  private _subscribeToCollisions(): void {
    const subscription = collisionEvents.playerAsteroid$.add((event: CollisionEvent) => {
      // Check if this collision involves our mesh
      if (event.source === this._mesh || event.target === this._mesh) {
        this.takeDamage(1);
      }
    });

    this._asteroidCollisionUnsubscribe = () => {
      collisionEvents.playerAsteroid$.remove(subscription);
    };
  }
}

/**
 * Factory function for backward compatibility with Game.ts.
 * Creates a Player instance and wraps it with a controller interface.
 */
export function createPlayerController(scene: Scene, config: PlayerConfig) {
  const player = new Player(scene, config);

  return {
    mesh: player.mesh,
    collisionRadius: player.collisionRadius,
    update: (deltaSeconds: number) => player.update(deltaSeconds),
    getState: () => player.getState(),
    setState: (state: PlayerState) => player.setState(state),
    dispose: () => player.dispose()
  };
}
