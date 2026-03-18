import { Observable, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { Asteroid, asteroidEvents, AsteroidSize, type AsteroidConfig } from "./Asteroid";
import { ASTEROID_CONFIG, WAVE_CONFIG } from "../utils/Constants";

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Computed wave parameters for a specific wave number and area number.
 * All values are derived from the wave difficulty table and area scaling constants.
 */
export interface WaveConfig {
  readonly waveNumber: number;
  readonly areaNumber: number;
  readonly largeAsteroidCount: number;
  readonly speedMultiplier: number;
}

/**
 * Construction-time configuration for the WaveManager.
 * Provides arena extents for spawn position generation and player reference
 * position to enforce the minimum spawn distance exclusion zone.
 */
export interface WaveManagerConfig {
  /** Total number of areas before victory (3 for standard mode). */
  readonly totalAreas: number;
  /** Number of waves per area (always 3 per PRD). */
  readonly wavesPerArea: number;
  /** Half-extents of the arena in each axis for random spawn bounds. */
  readonly arenaHalfSize: Vector3;
  /** Player origin used to enforce minimum spawn separation. */
  readonly playerSpawnPosition: Vector3;
}

// ============================================================================
// Observable Event Bus
// ============================================================================

/**
 * Global event bus for WaveManager lifecycle events.
 *
 * Subscribers:
 * - ScoreSystem: awards waveBonus on waveComplete$, areaBonus on areaComplete$
 * - Game.ts: shows transition UI, triggers barrier animations, manages area transitions
 * - HUD: displays current wave / area state
 * - audio-engineer: plays stingers on wave/area/game transitions
 */
export const waveManagerEvents = {
  /** Emitted when a wave completes (all asteroids + children destroyed). */
  waveComplete$: new Observable<{ wave: number; area: number }>(),
  /** Emitted when all waves in an area are cleared. Game.ts handles exit-zone transition. */
  areaComplete$: new Observable<{ area: number }>(),
  /** Emitted when the final area (totalAreas) is cleared — victory condition. */
  gameComplete$: new Observable<void>(),
  /** Emitted immediately when a wave begins spawning. */
  waveStarted$: new Observable<{ wave: number; area: number; asteroidCount: number }>(),
};

// ============================================================================
// Wave Math Helper
// ============================================================================

/**
 * Calculates the deterministic wave parameters for a given wave and area.
 *
 * Difficulty table (Area 1 baseline):
 * | Wave | Large asteroids | Speed multiplier |
 * |------|-----------------|------------------|
 * |  1   |        3        |      1.00×       |
 * |  2   |        5        |      1.15×       |
 * |  3   |        7        |      1.30×       |
 *
 * Area scaling (applied per area beyond 1):
 * - Asteroid count: baseCount × (areaCountScale ^ (areaNum − 1)), rounded
 * - Speed: baseSpeedMultiplier × (areaSpeedScale ^ (areaNum − 1))
 *
 * @param waveNum Wave number within the area (1, 2, or 3)
 * @param areaNum Area number (1-based)
 * @returns Computed WaveConfig with counts and speed multiplier
 */
export function calculateWaveConfig(waveNum: 1 | 2 | 3, areaNum: number): WaveConfig {
  const waveIdx = waveNum - 1;

  const baseCount = WAVE_CONFIG.baseAsteroidCounts[waveIdx];
  const areaCountFactor = Math.pow(WAVE_CONFIG.areaCountScale, areaNum - 1);
  const largeAsteroidCount = Math.round(baseCount * areaCountFactor);

  const baseSpeedMultiplier = WAVE_CONFIG.baseSpeedMultipliers[waveIdx];
  const areaSpeedFactor = Math.pow(WAVE_CONFIG.areaSpeedScale, areaNum - 1);
  const speedMultiplier = baseSpeedMultiplier * areaSpeedFactor;

  return {
    waveNumber: waveNum,
    areaNumber: areaNum,
    largeAsteroidCount,
    speedMultiplier,
  };
}

// ============================================================================
// WaveManager Class
// ============================================================================

/**
 * WaveManager orchestrates wave spawning, asteroid tracking, and progression
 * through waves and areas according to the PRD difficulty table (W-01 through W-08).
 *
 * Responsibilities:
 * - Spawning Large asteroids at the start of each wave via the injected spawnFn
 * - Tracking all active asteroids for the current wave (including split children)
 * - Detecting wave completion when every tracked asteroid is destroyed
 * - Auto-advancing within an area (wave 1→2→3) after a 2-second transition delay
 * - Emitting waveComplete$, areaComplete$, and gameComplete$ events
 *
 * Architecture:
 * - WaveManager is self-managing for intra-area wave timing
 * - Area transitions (W-07) are player-driven: WaveManager emits areaComplete$;
 *   Game.ts handles the exit-zone trigger and calls startWave() for the next area
 * - Asteroid split children are tracked via asteroidEvents.childrenSpawned$
 * - Wave completion check is deferred via setTimeout(0) to ensure childrenSpawned$
 *   fires before the check runs (asteroidEvents ordering: destroyed$ → childrenSpawned$)
 *
 * @example
 * ```typescript
 * const waveManager = new WaveManager(
 *   { totalAreas: 3, wavesPerArea: 3, arenaHalfSize, playerSpawnPosition },
 *   scene,
 *   (config) => game.spawnAsteroid(config)
 * );
 * waveManager.startWave();
 * ```
 */
export class WaveManager {
  private readonly _config: WaveManagerConfig;
  private readonly _spawnFn: (config: AsteroidConfig) => Asteroid;

  private _currentWave: number = 1;
  private _currentArea: number = 1;
  private _isWaveActive: boolean = false;
  private _isAreaComplete: boolean = false;
  private _isGameComplete: boolean = false;

  private _activeAsteroids: Asteroid[] = [];

  private _destroyedSubscription: (() => void) | null = null;
  private _childrenSubscription: (() => void) | null = null;

  /**
   * Guards against multiple simultaneous setTimeout(0) wave-complete checks
   * when several asteroids are destroyed in the same game tick.
   */
  private _waveCompleteCheckPending: boolean = false;

  /**
   * @param config  Wave and arena bounds configuration.
   * @param _scene  Babylon.js scene (reserved for future use; spawning is via spawnFn).
   * @param spawnFn Factory callback used to create asteroids; provided by Game.ts.
   */
  constructor(
    config: WaveManagerConfig,
    _scene: Scene,
    spawnFn: (config: AsteroidConfig) => Asteroid
  ) {
    this._config = config;
    this._spawnFn = spawnFn;
    this._subscribeToAsteroidEvents();
  }

  // ============================================================================
  // Readonly State Properties
  // ============================================================================

  /** Current wave number within the active area (1–wavesPerArea). */
  public get currentWave(): number { return this._currentWave; }

  /** Current area number (1–totalAreas). */
  public get currentArea(): number { return this._currentArea; }

  /** True while a wave is in progress (asteroids alive or spawning). */
  public get isWaveActive(): boolean { return this._isWaveActive; }

  /** True after the final wave of an area is cleared (until next area starts). */
  public get isAreaComplete(): boolean { return this._isAreaComplete; }

  /** True after the final area is cleared — signals victory. */
  public get isGameComplete(): boolean { return this._isGameComplete; }

  /** Shallow copy of the asteroid tracking array for the current wave. */
  public get activeAsteroids(): Asteroid[] { return [...this._activeAsteroids]; }

  // ============================================================================
  // Wave Control Methods
  // ============================================================================

  /**
   * Begins the current wave: calculates spawn parameters, spawns Large asteroids
   * via the injected spawnFn, subscribes to split events, and emits waveStarted$.
   *
   * Call this to start wave 1 of a new game or wave 1 of a new area after transition.
   * Within an area, advanceWave() auto-calls startWave() after the transition delay.
   */
  public startWave(): void {
    this._isAreaComplete = false;
    this._activeAsteroids = [];
    this._isWaveActive = true;

    const waveConfig = calculateWaveConfig(
      this._currentWave as 1 | 2 | 3,
      this._currentArea
    );

    for (let i = 0; i < waveConfig.largeAsteroidCount; i++) {
      const position = this._randomSpawnPosition();
      const velocity = this._randomVelocity(waveConfig.speedMultiplier);
      const asteroid = this._spawnFn({
        size: AsteroidSize.LARGE,
        position,
        velocity,
      });
      this._activeAsteroids.push(asteroid);
    }

    waveManagerEvents.waveStarted$.notifyObservers({
      wave: this._currentWave,
      area: this._currentArea,
      asteroidCount: waveConfig.largeAsteroidCount,
    });
  }

  /**
   * Manually adds an asteroid to the wave tracking set.
   * Use when asteroids are created outside of startWave() but should count
   * toward the current wave's completion condition.
   *
   * @param asteroid The asteroid to track.
   */
  public addAsteroid(asteroid: Asteroid): void {
    this._activeAsteroids.push(asteroid);
  }

  /**
   * Returns true when every asteroid tracked by this wave is destroyed.
   * Includes split children that were added via childrenSpawned$ event tracking.
   *
   * Returns false if the wave has no tracked asteroids (wave hasn't started).
   */
  public checkWaveComplete(): boolean {
    return (
      this._activeAsteroids.length > 0 &&
      this._activeAsteroids.every(a => a.isDestroyed)
    );
  }

  /**
   * Marks the current wave as inactive and advances progression.
   *
   * - If the completed wave is the last in the area (wave === wavesPerArea),
   *   calls advanceArea() immediately.
   * - Otherwise, emits waveComplete$ and schedules startWave() after the
   *   configured 2-second transition delay.
   */
  public advanceWave(): void {
    this._isWaveActive = false;

    const completedWave = this._currentWave;
    this._currentWave++;

    if (completedWave >= this._config.wavesPerArea) {
      this.advanceArea();
    } else {
      waveManagerEvents.waveComplete$.notifyObservers({
        wave: completedWave,
        area: this._currentArea,
      });
    }
  }

  /**
   * Increments the area counter and resets the wave counter to 1.
   *
   * - If the completed area was the last (area === totalAreas), sets isGameComplete
   *   and emits gameComplete$ (victory).
   * - Otherwise, emits areaComplete$ so Game.ts can turn barriers green and
   *   wait for the player to enter the exit zone before calling startWave().
   */
  public advanceArea(): void {
    const completedArea = this._currentArea;
    this._isAreaComplete = true;
    this._currentWave = 1;
    this._currentArea++;

    if (completedArea >= this._config.totalAreas) {
      this._isGameComplete = true;
      waveManagerEvents.gameComplete$.notifyObservers();
    } else {
      waveManagerEvents.areaComplete$.notifyObservers({
        area: completedArea,
      });
    }
  }

  /**
   * Resets all wave and area state to initial values.
   * Call at the start of a new game or when restarting.
   * Does NOT re-subscribe to events — those are established in the constructor.
   */
  public reset(): void {
    this._currentWave = 1;
    this._currentArea = 1;
    this._isWaveActive = false;
    this._isAreaComplete = false;
    this._isGameComplete = false;
    this._activeAsteroids = [];
    this._waveCompleteCheckPending = false;
  }

  /**
   * Cancels all timers and unsubscribes from all asteroid events.
   * Call when the WaveManager is no longer needed (game shutdown, scene teardown).
   */
  public dispose(): void {
    this.reset();

    if (this._destroyedSubscription) {
      this._destroyedSubscription();
      this._destroyedSubscription = null;
    }

    if (this._childrenSubscription) {
      this._childrenSubscription();
      this._childrenSubscription = null;
    }
  }

  // ============================================================================
  // Private: Asteroid Event Subscriptions
  // ============================================================================

  /**
   * Subscribes to global asteroid events for wave-level tracking.
   *
   * destroyed$:
   *   When a tracked asteroid is destroyed, schedules a deferred wave-complete
   *   check via setTimeout(0). This deferral is critical: Asteroid.destroy() emits
   *   destroyed$ THEN childrenSpawned$ in the same synchronous callstack. A
   *   synchronous check in destroyed$ would fire before children are added, causing
   *   false wave-complete detections for Large/Medium asteroids that spawn children.
   *
   * childrenSpawned$:
   *   When a tracked asteroid spawns children, adds each child to _activeAsteroids
   *   so they are included in subsequent wave-complete checks.
   */
  private _subscribeToAsteroidEvents(): void {
    const destroyedObserver = asteroidEvents.destroyed$.add((event) => {
      if (!this._isWaveActive) return;
      if (!this._activeAsteroids.includes(event.asteroid)) return;
      if (this._waveCompleteCheckPending) return;

      // Defer check until after childrenSpawned$ fires in the same callstack
      this._waveCompleteCheckPending = true;
      setTimeout(() => {
        this._waveCompleteCheckPending = false;
        if (this._isWaveActive && this.checkWaveComplete()) {
          this.advanceWave();
        }
      }, 0);
    });

    const childrenObserver = asteroidEvents.childrenSpawned$.add((event) => {
      if (!this._isWaveActive) return;
      if (!this._activeAsteroids.includes(event.parent)) return;

      for (const child of event.children) {
        this._activeAsteroids.push(child);
      }
    });

    this._destroyedSubscription = () => asteroidEvents.destroyed$.remove(destroyedObserver);
    this._childrenSubscription = () => asteroidEvents.childrenSpawned$.remove(childrenObserver);
  }

  // ============================================================================
  // Private: Spawn Helpers
  // ============================================================================

  /**
   * Generates a random spawn position within the arena bounds, excluding a
   * minimum-distance exclusion zone around the player spawn position.
   *
   * Tries up to 100 random positions. If all attempts fail (very small arena),
   * falls back to a far corner guaranteed to exceed minimum distance.
   */
  private _randomSpawnPosition(): Vector3 {
    const halfSize = this._config.arenaHalfSize;
    const playerPos = this._config.playerSpawnPosition;
    const minDist = WAVE_CONFIG.minSpawnDistFromPlayer;

    for (let attempt = 0; attempt < 100; attempt++) {
      const x = (Math.random() * 2 - 1) * halfSize.x * 0.9;
      const z = (Math.random() * 2 - 1) * halfSize.z * 0.9;
      const pos = new Vector3(x, 0, z);

      if (Vector3.Distance(pos, playerPos) >= minDist) {
        return pos;
      }
    }

    // Fallback: arena far corner — always exceeds minSpawnDistFromPlayer
    return new Vector3(halfSize.x * 0.7, 0, halfSize.z * 0.7);
  }

  /**
   * Generates a random velocity vector in the XZ plane scaled by the wave speed multiplier.
   *
   * Speed = ASTEROID_CONFIG.speedBase.Large × speedMultiplier
   * Direction = uniformly random angle in [0, 2π)
   *
   * @param speedMultiplier Combined wave × area speed factor from calculateWaveConfig
   */
  private _randomVelocity(speedMultiplier: number): Vector3 {
    const speed = ASTEROID_CONFIG.speedBase.Large * speedMultiplier;
    const angle = Math.random() * Math.PI * 2;
    return new Vector3(Math.cos(angle) * speed, 0, Math.sin(angle) * speed);
  }
}
