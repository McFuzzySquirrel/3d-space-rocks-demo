import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Observable, Vector3 } from "@babylonjs/core";
import type { Scene, Mesh } from "@babylonjs/core";
import { Projectile, ProjectileType, projectileEvents } from "./Projectile";
import { collisionEvents, type CollisionEvent } from "../systems/CollisionSystem";
import { PLAYER_COMBAT_CONFIG, PROJECTILE_CONFIG } from "../utils/Constants";
import { ThrusterEffect } from "../vfx/ThrusterEffect";

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
  readonly pitchRadians: number;
}

/**
 * Player controller interface for compatibility with Arena and Game systems.
 * This is the public API that Game.ts and Arena.ts consume.
 */
export interface PlayerController {
  readonly mesh: Mesh;
  readonly collisionRadius: number;
  readonly isThrusting: boolean;
  readonly activeProjectiles: ReadonlyArray<Projectile>;
  update: (deltaSeconds: number) => void;
  takeDamage: (amount?: number) => void;
  getState: () => PlayerState;
  setState: (state: PlayerState) => void;
  setInputEnabled: (enabled: boolean) => void;
  reset: (position?: Vector3, preserveLives?: boolean) => void;
  getLives: () => number;
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
  private _pitchRadians: number = 0;
  private _inputState: {
    thrustForward: boolean;
    thrustBackward: boolean;
  } = {
    thrustForward: false,
    thrustBackward: false
  };
  private _mouseYawInput: number = 0;
  private _mousePitchInput: number = 0;
  private _isMouseLookActive: boolean = false;
  private _lastMouseClientX: number | null = null;
  private _lastMouseClientY: number | null = null;
  private _inputEnabled: boolean = true;

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
  private _onMouseDown: ((event: MouseEvent) => void) | null = null;
  private _onMouseUp: ((event: MouseEvent) => void) | null = null;
  private _onMouseMove: ((event: MouseEvent) => void) | null = null;
  private _onPointerDown: ((event: PointerEvent) => void) | null = null;
  private _onPointerUp: ((event: PointerEvent) => void) | null = null;
  private _onPointerMove: ((event: PointerEvent) => void) | null = null;
  private _inputElement: HTMLElement | null = null;

  private static readonly MAX_PITCH_RADIANS: number = Math.PI / 3;
  private static readonly MOUSE_YAW_SENSITIVITY: number = 0.0032;
  private static readonly MOUSE_PITCH_SENSITIVITY: number = 0.0022;

  // VFX
  private _thrusterEffect!: ThrusterEffect;

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

    // Initialize thruster VFX
    this._thrusterEffect = new ThrusterEffect(scene, this._mesh);
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
   * Gets whether the player is currently applying thrust.
   * Used by audio and external systems.
   */
  public get isThrusting(): boolean {
    return this._inputState.thrustForward || this._inputState.thrustBackward;
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
      yawRadians: this._yawRadians,
      pitchRadians: this._pitchRadians
    };
  }

  /**
   * Sets the player state (position, velocity, yaw).
   */
  public setState(state: PlayerState): void {
    this._position.copyFrom(state.position);
    this._velocity.copyFrom(state.velocity);
    this._yawRadians = state.yawRadians;
    this._pitchRadians = state.pitchRadians;

    this._mesh.position.copyFrom(this._position);
    this._mesh.rotation.y = this._yawRadians;
    this._mesh.rotation.x = Math.PI / 2 + this._pitchRadians;
  }

  /**
   * Enables or disables keyboard input processing.
   * When disabled, movement/fire intent is cleared immediately.
   */
  public setInputEnabled(enabled: boolean): void {
    this._inputEnabled = enabled;

    if (!enabled) {
      this._inputState.thrustForward = false;
      this._inputState.thrustBackward = false;
      this._mouseYawInput = 0;
      this._mousePitchInput = 0;
      this._isMouseLookActive = false;
      this._lastMouseClientX = null;
      this._lastMouseClientY = null;
    }
  }

  /**
   * Resets movement/combat state for new game or area transitions.
   */
  public reset(position?: Vector3, preserveLives: boolean = false): void {
    const spawn = position ?? new Vector3(
      this._config.spawnPosition.x,
      this._config.spawnPosition.y,
      this._config.spawnPosition.z
    );

    this._position.copyFrom(spawn);
    this._velocity.set(0, 0, 0);
    this._yawRadians = 0;
    this._pitchRadians = 0;

    if (!preserveLives) {
      this._lives = PLAYER_COMBAT_CONFIG.maxLives;
    }
    this._isInvulnerable = false;
    this._invulnerabilityTimeRemaining = 0;
    this._fireReadyTime = 0;

    for (const projectile of this._activeProjectiles) {
      projectile.dispose();
    }
    this._activeProjectiles = [];

    this._mesh.position.copyFrom(this._position);
    this._mesh.rotation.y = this._yawRadians;
    this._mesh.rotation.x = Math.PI / 2 + this._pitchRadians;
    this._mouseYawInput = 0;
    this._mousePitchInput = 0;
    this._isMouseLookActive = false;
    this._lastMouseClientX = null;
    this._lastMouseClientY = null;
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
    const heading = this._computeForwardDirection();
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

    // Update thruster VFX
    this._thrusterEffect.update(this._inputState.thrustForward || this._inputState.thrustBackward);

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
    this._mesh.rotation.x = Math.PI / 2 + this._pitchRadians;
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
    if (this._onMouseDown) {
      window.removeEventListener("mousedown", this._onMouseDown);
    }
    if (this._onMouseUp) {
      window.removeEventListener("mouseup", this._onMouseUp);
    }
    if (this._onMouseMove) {
      window.removeEventListener("mousemove", this._onMouseMove);
    }
    if (this._inputElement && this._onPointerDown) {
      this._inputElement.removeEventListener("pointerdown", this._onPointerDown);
    }
    if (this._inputElement && this._onPointerUp) {
      this._inputElement.removeEventListener("pointerup", this._onPointerUp);
      this._inputElement.removeEventListener("pointercancel", this._onPointerUp);
      this._inputElement.removeEventListener("lostpointercapture", this._onPointerUp);
    }
    if (this._inputElement && this._onPointerMove) {
      this._inputElement.removeEventListener("pointermove", this._onPointerMove);
    }

    // Dispose thruster VFX
    this._thrusterEffect.dispose();

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

    const cockpit = MeshBuilder.CreateSphere(
      "player-ship-cockpit",
      { diameter: 1.05, segments: 16 },
      scene
    );
    cockpit.parent = ship;
    cockpit.position.y = 0.28;
    cockpit.position.z = 0.55;
    const cockpitMaterial = new StandardMaterial("player-ship-cockpit-material", scene);
    cockpitMaterial.diffuseColor = new Color3(0.28, 0.45, 0.72);
    cockpitMaterial.emissiveColor = new Color3(0.1, 0.22, 0.4);
    cockpit.material = cockpitMaterial;

    const wingMaterial = new StandardMaterial("player-ship-wing-material", scene);
    wingMaterial.diffuseColor = new Color3(0.86, 0.2, 0.2);
    wingMaterial.emissiveColor = new Color3(0.22, 0.08, 0.08);

    const leftWing = MeshBuilder.CreateBox(
      "player-ship-wing-left",
      { width: 0.45, height: 1.55, depth: 2.2 },
      scene
    );
    leftWing.parent = ship;
    leftWing.position.x = -1.25;
    leftWing.position.y = -0.25;
    leftWing.position.z = -0.2;
    leftWing.rotation.z = Math.PI / 18;
    leftWing.material = wingMaterial;

    const rightWing = MeshBuilder.CreateBox(
      "player-ship-wing-right",
      { width: 0.45, height: 1.55, depth: 2.2 },
      scene
    );
    rightWing.parent = ship;
    rightWing.position.x = 1.25;
    rightWing.position.y = -0.25;
    rightWing.position.z = -0.2;
    rightWing.rotation.z = -Math.PI / 18;
    rightWing.material = wingMaterial;

    const nose = MeshBuilder.CreateCylinder(
      "player-ship-nose",
      {
        height: 0.95,
        diameterTop: 0.08,
        diameterBottom: 0.55,
        tessellation: 16,
      },
      scene
    );
    nose.parent = ship;
    nose.position.z = 2.05;
    nose.rotation.x = -Math.PI / 2;
    const noseMaterial = new StandardMaterial("player-ship-nose-material", scene);
    noseMaterial.diffuseColor = new Color3(0.94, 0.84, 0.3);
    noseMaterial.emissiveColor = new Color3(0.2, 0.14, 0.03);
    nose.material = noseMaterial;

    return ship;
  }

  /**
   * Registers keyboard input handlers for movement and firing.
   */
  private _registerInputHandlers(): void {
    this._onKeyDown = (event: KeyboardEvent): void => {
      if (!this._inputEnabled) {
        return;
      }

      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          this._inputState.thrustForward = true;
          event.preventDefault();
          break;
        case "KeyS":
        case "ArrowDown":
          this._inputState.thrustBackward = true;
          event.preventDefault();
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
      if (!this._inputEnabled) {
        return;
      }

      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          this._inputState.thrustForward = false;
          event.preventDefault();
          break;
        case "KeyS":
        case "ArrowDown":
          this._inputState.thrustBackward = false;
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    this._onMouseMove = (event: MouseEvent): void => {
      if (!this._inputEnabled) {
        return;
      }

      // If a button is currently held, treat movement as active mouse-look
      // even when a prior down/up event was swallowed by UI layers.
      if (event.buttons !== 0) {
        this._isMouseLookActive = true;
      }

      if (!this._isMouseLookActive) {
        return;
      }

      const deltaX = event.movementX !== 0 || event.movementY !== 0
        ? event.movementX
        : (this._lastMouseClientX !== null ? event.clientX - this._lastMouseClientX : 0);
      const deltaY = event.movementX !== 0 || event.movementY !== 0
        ? event.movementY
        : (this._lastMouseClientY !== null ? event.clientY - this._lastMouseClientY : 0);

      this._mouseYawInput += deltaX * Player.MOUSE_YAW_SENSITIVITY;
      this._mousePitchInput += deltaY * Player.MOUSE_PITCH_SENSITIVITY;
      this._lastMouseClientX = event.clientX;
      this._lastMouseClientY = event.clientY;
    };

    this._onMouseDown = (event: MouseEvent): void => {
      if (!this._inputEnabled) {
        return;
      }

      this._isMouseLookActive = true;
      this._lastMouseClientX = event.clientX;
      this._lastMouseClientY = event.clientY;
    };

    this._onMouseUp = (event: MouseEvent): void => {
      if (event.buttons !== 0) {
        return;
      }

      this._isMouseLookActive = false;
      this._lastMouseClientX = null;
      this._lastMouseClientY = null;
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("mousemove", this._onMouseMove);

    // Canvas-level pointer handlers are more reliable than window mouse events when GUI layers consume input.
    this._inputElement = this._mesh.getScene().getEngine().getInputElement() as HTMLElement | null;
    if (!this._inputElement) {
      return;
    }

    this._onPointerDown = (event: PointerEvent): void => {
      if (!this._inputEnabled || event.button !== 0) {
        return;
      }

      this._isMouseLookActive = true;
      this._lastMouseClientX = event.clientX;
      this._lastMouseClientY = event.clientY;

      if (this._inputElement?.setPointerCapture) {
        try {
          this._inputElement.setPointerCapture(event.pointerId);
        } catch {
          // Ignore capture failures; rotation still works without capture.
        }
      }
    };

    this._onPointerUp = (_event: PointerEvent): void => {
      this._isMouseLookActive = false;
      this._lastMouseClientX = null;
      this._lastMouseClientY = null;
    };

    this._onPointerMove = (event: PointerEvent): void => {
      if (!this._inputEnabled || !this._isMouseLookActive) {
        return;
      }

      const deltaX = event.movementX !== 0 || event.movementY !== 0
        ? event.movementX
        : (this._lastMouseClientX !== null ? event.clientX - this._lastMouseClientX : 0);
      const deltaY = event.movementX !== 0 || event.movementY !== 0
        ? event.movementY
        : (this._lastMouseClientY !== null ? event.clientY - this._lastMouseClientY : 0);

      this._mouseYawInput += deltaX * Player.MOUSE_YAW_SENSITIVITY;
      this._mousePitchInput += deltaY * Player.MOUSE_PITCH_SENSITIVITY;
      this._lastMouseClientX = event.clientX;
      this._lastMouseClientY = event.clientY;
    };

    this._inputElement.addEventListener("pointerdown", this._onPointerDown);
    this._inputElement.addEventListener("pointerup", this._onPointerUp);
    this._inputElement.addEventListener("pointercancel", this._onPointerUp);
    this._inputElement.addEventListener("lostpointercapture", this._onPointerUp);
    this._inputElement.addEventListener("pointermove", this._onPointerMove);
  }

  /**
   * Updates player movement based on input and physics.
   */
  private _updateMovement(deltaSeconds: number): void {
    // Mouse look defines ship heading.
    this._yawRadians += this._mouseYawInput;
    this._pitchRadians += this._mousePitchInput;
    this._pitchRadians = Math.max(-Player.MAX_PITCH_RADIANS, Math.min(Player.MAX_PITCH_RADIANS, this._pitchRadians));
    this._mouseYawInput = 0;
    this._mousePitchInput = 0;

    // Thrust moves along current look direction.
    const thrustInput = Number(this._inputState.thrustForward) - Number(this._inputState.thrustBackward);
    if (thrustInput !== 0) {
      const forward = this._computeForwardDirection();
      this._velocity.addInPlace(forward.scale(this._config.thrustAcceleration * deltaSeconds * thrustInput));
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
   * Computes normalized forward direction from current yaw and pitch.
   */
  private _computeForwardDirection(): Vector3 {
    // The mesh nose is local +Y before rotation; use it directly to avoid model-axis drift.
    return this._mesh.getDirection(Vector3.Up()).normalize();
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
    get isThrusting() {
      return player.isThrusting;
    },
    get activeProjectiles() {
      return player.activeProjectiles;
    },
    update: (deltaSeconds: number) => player.update(deltaSeconds),
    takeDamage: (amount?: number) => player.takeDamage(amount),
    getState: () => player.getState(),
    setState: (state: PlayerState) => player.setState(state),
    setInputEnabled: (enabled: boolean) => player.setInputEnabled(enabled),
    reset: (position?: Vector3, preserveLives?: boolean) => player.reset(position, preserveLives),
    getLives: () => player.lives,
    dispose: () => player.dispose()
  };
}
