import { Observable, ParticleSystem, Vector3 } from "@babylonjs/core";
import type { CannonJSPlugin, Scene } from "@babylonjs/core";
import type { Observer } from "@babylonjs/core";

import type { SceneBootstrap } from "./SceneFactory";
import { createPlayerController, playerEvents } from "./Player";
import { arenaEvents, createArenaController } from "./Arena";
import { Asteroid, asteroidEvents, type AsteroidConfig } from "./Asteroid";
import { projectileEvents } from "./Projectile";
import { WaveManager, waveManagerEvents } from "./WaveManager";
import { APP_CONFIG, STATE_MACHINE_CONFIG } from "../utils/Constants";
import { createAsteroidExplosion, createProjectileHitEffect } from "../vfx/ParticleEffects";
import { applyPlayerDamageFlash, playImpactShake } from "../vfx/DamageFeedback";
import {
  playAreaCompleteCelebration,
  playExitZoneBeacon,
  playWaveCompletePulse,
} from "../vfx/BarrierFeedback";
import { initPhysicsWorld } from "../systems/PhysicsSetup";
import { initCollisionSystem } from "../systems/CollisionSystem";
import { AudioManager } from "../systems/AudioManager";
import { ScoreSystem } from "./ScoreSystem";

export enum GameState {
  LOADING = "LOADING",
  MENU = "MENU",
  PLAYING = "PLAYING",
  WAVE_TRANSITION = "WAVE_TRANSITION",
  AREA_COMPLETE = "AREA_COMPLETE",
  AREA_TRANSITION = "AREA_TRANSITION",
  PAUSED = "PAUSED",
  GAME_OVER = "GAME_OVER",
  VICTORY = "VICTORY",
}

const stateChanged$ = new Observable<{ from: GameState; to: GameState }>();
const waveTransitionStart$ = new Observable<{ wave: number; area: number }>();
const areaCompleteStart$ = new Observable<{ area: number }>();
const gameOverStart$ = new Observable<{ finalScore: number }>();
const victoryStart$ = new Observable<{ finalScore: number }>();

export const gameStateEvents = {
  stateChanged$,
  waveTransitionStart$,
  areaCompleteStart$,
  gameOverStart$,
  victoryStart$,
};

const STATE_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  [GameState.LOADING]: [GameState.MENU],
  [GameState.MENU]: [GameState.PLAYING],
  [GameState.PLAYING]: [
    GameState.WAVE_TRANSITION,
    GameState.AREA_COMPLETE,
    GameState.PAUSED,
    GameState.GAME_OVER,
    GameState.VICTORY,
  ],
  [GameState.WAVE_TRANSITION]: [GameState.PLAYING],
  [GameState.AREA_COMPLETE]: [GameState.AREA_TRANSITION],
  [GameState.AREA_TRANSITION]: [GameState.PLAYING],
  [GameState.PAUSED]: [GameState.PLAYING],
  [GameState.GAME_OVER]: [GameState.MENU],
  [GameState.VICTORY]: [GameState.MENU],
};

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
  readonly state: GameState;
  setState: (next: GameState) => void;
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

  class RuntimeController implements GameController {
    private readonly _scene: Scene;
    private readonly _physicsPlugin: CannonJSPlugin;
    private readonly _player = createPlayerController(scene, APP_CONFIG.gameplay.player);
    private readonly _arena = createArenaController(scene, APP_CONFIG.gameplay.arena);
    private readonly _scoreSystem = new ScoreSystem();
    private readonly _audioManager: AudioManager;
    private readonly _waveManager: WaveManager;

    private readonly _asteroids: Asteroid[] = [];
    private readonly _subscriptions: Array<() => void> = [];

    private _asteroidSerial: number = 0;
    private _accumulatorMs: number = 0;
    private _elapsedSeconds: number = 0;
    private _transitionTimer: ReturnType<typeof setTimeout> | null = null;
    private _exitZoneBeacon: ParticleSystem | null = null;
    private _disposed: boolean = false;

    private _state: GameState = GameState.LOADING;
    private _previousState: GameState = GameState.LOADING;

    private _pendingWaveTransition: { wave: number; area: number } | null = null;
    private _pendingAreaComplete: { area: number } | null = null;
    private _pendingFinalScore: number = 0;

    public get state(): GameState {
      return this._state;
    }

    constructor(private readonly _sceneBootstrap: SceneBootstrap) {
      this._scene = _sceneBootstrap.scene;
      this._physicsPlugin = initPhysicsWorld(this._scene);
      initCollisionSystem();

      _sceneBootstrap.registerSceneActor({ key: "player", node: this._player.mesh });
      for (const wall of this._arena.walls) {
        _sceneBootstrap.registerSceneActor({ key: wall.name, node: wall });
      }

      this._waveManager = new WaveManager(
        {
          totalAreas: 3,
          wavesPerArea: 3,
          arenaHalfSize: new Vector3(
            APP_CONFIG.gameplay.arena.width / 2,
            APP_CONFIG.gameplay.arena.height / 2,
            APP_CONFIG.gameplay.arena.depth / 2
          ),
          playerSpawnPosition: new Vector3(0, 0, 0),
        },
        this._scene,
        (config) => this.spawnAsteroid(config)
      );

      this._audioManager = new AudioManager(this._scene);
      this._audioManager.setPlayer(this._player);
      this._audioManager.init();

      this._registerEventSubscriptions();
      this._registerInputHandlers();

      this.setState(GameState.MENU);
    }

    public setState(next: GameState): void {
      if (this._disposed || this._state === next) {
        return;
      }

      const allowed = STATE_TRANSITIONS[this._state];
      if (!allowed.includes(next)) {
        console.warn(`Invalid game state transition: ${this._state} -> ${next}`);
        return;
      }

      const from = this._state;
      this._previousState = from;
      this._state = next;
      gameStateEvents.stateChanged$.notifyObservers({ from, to: next });

      switch (next) {
        case GameState.MENU:
          this.enterMenu();
          break;
        case GameState.PLAYING:
          this.enterPlaying();
          break;
        case GameState.WAVE_TRANSITION:
          this.enterWaveTransition(this._pendingWaveTransition?.wave ?? 0, this._pendingWaveTransition?.area ?? 0);
          break;
        case GameState.AREA_COMPLETE:
          this.enterAreaComplete(this._pendingAreaComplete?.area ?? this._waveManager.currentArea - 1);
          break;
        case GameState.AREA_TRANSITION:
          this.enterAreaTransition();
          break;
        case GameState.PAUSED:
          this.enterPaused();
          break;
        case GameState.GAME_OVER:
          this.enterGameOver(this._pendingFinalScore);
          break;
        case GameState.VICTORY:
          this.enterVictory(this._pendingFinalScore);
          break;
        case GameState.LOADING:
          break;
      }
    }

    public spawnAsteroid(config: AsteroidConfig): Asteroid {
      const asteroid = new Asteroid(config, this._scene);
      this._asteroids.push(asteroid);
      this._asteroidSerial += 1;
      this._sceneBootstrap.registerSceneActor({ key: `asteroid-${this._asteroidSerial}`, node: asteroid.mesh });
      return asteroid;
    }

    public spawnAsteroids(configs: AsteroidConfig[]): Asteroid[] {
      return configs.map((config) => this.spawnAsteroid(config));
    }

    public update(deltaMs: number): void {
      if (this._disposed) {
        return;
      }

      const clampedDeltaMs = Math.min(deltaMs, 100);
      this._accumulatorMs += clampedDeltaMs;

      const fixedStepMs = APP_CONFIG.gameplay.fixedStepMs;
      const stepSeconds = fixedStepMs / 1000;

      if (this._state !== GameState.PLAYING && this._state !== GameState.AREA_COMPLETE) {
        const playerState = this._player.getState();
        syncCameraTarget(this._sceneBootstrap, playerState.position, playerState.yawRadians);
        return;
      }

      while (this._accumulatorMs >= fixedStepMs) {
        this._elapsedSeconds += stepSeconds;

        if (this._state === GameState.PLAYING) {
          this._player.update(stepSeconds);
          const containedState = this._arena.containState(
            this._player.getState(),
            this._player.collisionRadius
          );
          this._player.setState(containedState);
          this._arena.update(this._elapsedSeconds, containedState.position, this._player.collisionRadius);

          for (const asteroid of this._asteroids) {
            if (!asteroid.isDestroyed) {
              asteroid.update(stepSeconds);
              this.reflectAsteroidWithinArena(asteroid);
            }
          }

          this.resolvePlayerAsteroidHits();
          this.resolveProjectileAsteroidHits();

          this.pruneDestroyedAsteroids();
        } else if (this._state === GameState.AREA_COMPLETE) {
          this.updateAreaComplete(stepSeconds);
        }

        const playerState = this._player.getState();
        syncCameraTarget(this._sceneBootstrap, playerState.position, playerState.yawRadians);

        this._accumulatorMs -= fixedStepMs;
      }
    }

    public dispose(): void {
      if (this._disposed) {
        return;
      }
      this._disposed = true;

      if (this._transitionTimer !== null) {
        clearTimeout(this._transitionTimer);
        this._transitionTimer = null;
      }

      for (const unsubscribe of this._subscriptions) {
        unsubscribe();
      }
      this._subscriptions.length = 0;

      this.clearAsteroids();
      this._waveManager.dispose();
      this._audioManager.dispose();
      this._player.dispose();
      this._arena.dispose();
      this._scoreSystem.dispose();
      this.disposeExitZoneBeacon();

      this._physicsPlugin.dispose();
    }

    private registerObserver<T>(observable: Observable<T>, observer: Observer<T>): void {
      this._subscriptions.push(() => observable.remove(observer));
    }

    private _registerEventSubscriptions(): void {
      const asteroidDestroyed = asteroidEvents.destroyed$.add((event) => {
        createAsteroidExplosion(this._scene, event.position, event.size);
      });
      this.registerObserver(asteroidEvents.destroyed$, asteroidDestroyed);

      const asteroidChildren = asteroidEvents.childrenSpawned$.add((event) => {
        for (const child of event.children) {
          this._asteroids.push(child);
          this._asteroidSerial += 1;
          this._sceneBootstrap.registerSceneActor({ key: `asteroid-child-${this._asteroidSerial}`, node: child.mesh });
        }
      });
      this.registerObserver(asteroidEvents.childrenSpawned$, asteroidChildren);

      const playerDamaged = playerEvents.damaged$.add(() => {
        applyPlayerDamageFlash(this._player.mesh, APP_CONFIG.gameplay.playerCombat.invulnerabilityDuration);
        playImpactShake(this._sceneBootstrap.camera, 1.0, 0.1);
      });
      this.registerObserver(playerEvents.damaged$, playerDamaged);

      const playerDied = playerEvents.died$.add(() => {
        if (this._state !== GameState.PLAYING) {
          return;
        }
        this._pendingFinalScore = this._scoreSystem.currentScore;
        this.setState(GameState.GAME_OVER);
      });
      this.registerObserver(playerEvents.died$, playerDied);

      const projectileDestroyed = projectileEvents.destroyed$.add((event) => {
        if (event.asteroidHit) {
          createProjectileHitEffect(this._scene, event.position, new Vector3(0, 1, 0));
        }
      });
      this.registerObserver(projectileEvents.destroyed$, projectileDestroyed);

      const waveComplete = waveManagerEvents.waveComplete$.add((event) => {
        playWaveCompletePulse(this._scene, Vector3.Zero());

        if (this._state !== GameState.PLAYING) {
          return;
        }
        this._pendingWaveTransition = event;
        this.setState(GameState.WAVE_TRANSITION);
      });
      this.registerObserver(waveManagerEvents.waveComplete$, waveComplete);

      const areaComplete = waveManagerEvents.areaComplete$.add((event) => {
        playAreaCompleteCelebration(
          this._scene,
          Vector3.Zero(),
          new Vector3(
            APP_CONFIG.gameplay.arena.width / 2,
            APP_CONFIG.gameplay.arena.height / 2,
            APP_CONFIG.gameplay.arena.depth / 2
          )
        );

        if (this._state !== GameState.PLAYING) {
          return;
        }
        this._pendingAreaComplete = event;
        this.setState(GameState.AREA_COMPLETE);
      });
      this.registerObserver(waveManagerEvents.areaComplete$, areaComplete);

      const gameComplete = waveManagerEvents.gameComplete$.add(() => {
        if (this._state !== GameState.PLAYING) {
          return;
        }
        this._pendingFinalScore = this._scoreSystem.currentScore;
        this.setState(GameState.VICTORY);
      });
      this.registerObserver(waveManagerEvents.gameComplete$, gameComplete);

      const exitZoneEnter = this._arena.onExitZoneEnter$.add(() => {
        if (this._state === GameState.AREA_COMPLETE) {
          this.setState(GameState.AREA_TRANSITION);
        }
      });
      this.registerObserver(this._arena.onExitZoneEnter$, exitZoneEnter);

      const exitZoneOpened = arenaEvents.exitZoneOpened$.add((event) => {
        this.disposeExitZoneBeacon();
        this._exitZoneBeacon = playExitZoneBeacon(this._scene, event.position);
      });
      this.registerObserver(arenaEvents.exitZoneOpened$, exitZoneOpened);

      const exitZoneEntered = arenaEvents.exitZoneEntered$.add(() => {
        this.disposeExitZoneBeacon();
      });
      this.registerObserver(arenaEvents.exitZoneEntered$, exitZoneEntered);
    }

    private _registerInputHandlers(): void {
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat) {
          return;
        }

        if (event.code === "Enter") {
          if (this._state === GameState.MENU) {
            this.setState(GameState.PLAYING);
          } else if (this._state === GameState.GAME_OVER || this._state === GameState.VICTORY) {
            this.setState(GameState.MENU);
          }
          return;
        }

        if (event.code === "Escape") {
          if (this._state === GameState.PLAYING) {
            this.setState(GameState.PAUSED);
          } else if (this._state === GameState.PAUSED) {
            this.setState(GameState.PLAYING);
          }
        }
      };

      window.addEventListener("keydown", onKeyDown);
      this._subscriptions.push(() => window.removeEventListener("keydown", onKeyDown));
    }

    private enterMenu(): void {
      this.clearTransitionTimer();
      this._elapsedSeconds = 0;
      this._player.setInputEnabled(false);

      this.clearAsteroids();
      this._waveManager.reset();
      this._arena.resetBarriers();
      this._arena.closeExitZone();
      this.disposeExitZoneBeacon();
      this._player.reset(new Vector3(0, 0, 0));

      this._pendingWaveTransition = null;
      this._pendingAreaComplete = null;
      this._pendingFinalScore = 0;
    }

    private enterPlaying(): void {
      const from = this._previousState;

      if (from === GameState.MENU) {
        this.clearAsteroids();
        this._scoreSystem.reset();
        this._waveManager.reset();
        this._arena.resetBarriers();
        this._arena.closeExitZone();
        this._player.reset(new Vector3(0, 0, 0));
        this._waveManager.startWave();
      }

      if (from === GameState.WAVE_TRANSITION || from === GameState.AREA_TRANSITION) {
        if (!this._waveManager.isWaveActive && !this._waveManager.isAreaComplete && !this._waveManager.isGameComplete) {
          this._waveManager.startWave();
        }
      }

      this.clearTransitionTimer();
      this._player.setInputEnabled(true);
      this._pendingWaveTransition = null;
      this._pendingAreaComplete = null;
    }

    private enterWaveTransition(waveNum: number, areaNum: number): void {
      this._player.setInputEnabled(false);

      gameStateEvents.waveTransitionStart$.notifyObservers({ wave: waveNum, area: areaNum });

      this.clearTransitionTimer();
      this._transitionTimer = setTimeout(() => {
        this._transitionTimer = null;
        if (this._state === GameState.WAVE_TRANSITION) {
          this.setState(GameState.PLAYING);
        }
      }, STATE_MACHINE_CONFIG.waveTransitionDelayMs);
    }

    private enterAreaComplete(areaNum: number): void {
      this._player.setInputEnabled(false);
      this._arena.transitionToComplete();
      gameStateEvents.areaCompleteStart$.notifyObservers({ area: areaNum });
    }

    private updateAreaComplete(deltaSeconds: number): void {
      const state = this._player.getState();
      const target = new Vector3(
        0,
        0,
        this._arena.bounds.maxZ - this._player.collisionRadius
      );

      const toTarget = target.subtract(state.position);
      const distance = toTarget.length();
      const maxStep = APP_CONFIG.gameplay.player.maxSpeed * 0.75 * deltaSeconds;

      if (distance > 0.0001) {
        const move = toTarget.normalize().scale(Math.min(distance, maxStep));
        this._player.setState({
          position: state.position.add(move),
          velocity: Vector3.Zero(),
          yawRadians: state.yawRadians,
          pitchRadians: state.pitchRadians,
        });
      }

      const containedState = this._arena.containState(this._player.getState(), this._player.collisionRadius);
      this._player.setState(containedState);
      this._arena.update(this._elapsedSeconds, containedState.position, this._player.collisionRadius);
    }

    private enterAreaTransition(): void {
      this._player.setInputEnabled(false);
      this._arena.closeExitZone();
      this.disposeExitZoneBeacon();
      this.clearAsteroids();
      this.clearTransitionTimer();

      // Fade hook point for Scene/VFX systems; timing stays in config for deterministic flow.
      this._transitionTimer = setTimeout(() => {
        this._transitionTimer = null;
        this._arena.resetBarriers();
        this._player.reset(new Vector3(0, 0, 0), true);

        if (this._state === GameState.AREA_TRANSITION) {
          this.setState(GameState.PLAYING);
        }
      }, STATE_MACHINE_CONFIG.areaTransitionFadeMs);
    }

    private enterPaused(): void {
      this._player.setInputEnabled(false);
    }

    private enterGameOver(finalScore: number): void {
      this._player.setInputEnabled(false);
      gameStateEvents.gameOverStart$.notifyObservers({ finalScore });
    }

    private enterVictory(finalScore: number): void {
      this._player.setInputEnabled(false);
      gameStateEvents.victoryStart$.notifyObservers({ finalScore });
    }

    private clearAsteroids(): void {
      for (const asteroid of this._asteroids) {
        if (!asteroid.isDestroyed) {
          asteroid.dispose();
        }
      }
      this._asteroids.length = 0;
    }

    private pruneDestroyedAsteroids(): void {
      let writeIdx = 0;
      for (let i = 0; i < this._asteroids.length; i++) {
        if (!this._asteroids[i].isDestroyed) {
          this._asteroids[writeIdx++] = this._asteroids[i];
        } else {
          this._asteroids[i].dispose();
        }
      }
      this._asteroids.length = writeIdx;
    }

    private clearTransitionTimer(): void {
      if (this._transitionTimer !== null) {
        clearTimeout(this._transitionTimer);
        this._transitionTimer = null;
      }
    }

    private resolveProjectileAsteroidHits(): void {
      const projectiles = this._player.activeProjectiles;
      const HIT_TOLERANCE = 0.5;

      for (const projectile of projectiles) {
        if (!projectile.isAlive || projectile.mesh.isDisposed()) {
          continue;
        }

        const projectilePos = projectile.mesh.position;
        const projectileRadius = projectile.mesh.getBoundingInfo().boundingSphere.radiusWorld;

        for (const asteroid of this._asteroids) {
          if (asteroid.isDestroyed || asteroid.mesh.isDisposed()) {
            continue;
          }

          const asteroidPos = asteroid.mesh.position;
          const asteroidRadius = asteroid.mesh.getBoundingInfo().boundingSphere.radiusWorld;
          const hitDistance = projectileRadius + asteroidRadius + HIT_TOLERANCE;

          if (Vector3.DistanceSquared(projectilePos, asteroidPos) > hitDistance * hitDistance) {
            continue;
          }

          const hitDirection = asteroidPos.subtract(projectilePos);
          createProjectileHitEffect(
            this._scene,
            projectilePos.clone(),
            hitDirection.lengthSquared() > 0.0001 ? hitDirection.normalize() : new Vector3(0, 1, 0)
          );

          asteroid.takeDamage(asteroid.health);
          projectile.destroy();
          break;
        }
      }
    }

    private resolvePlayerAsteroidHits(): void {
      const playerPos = this._player.mesh.position;
      const playerRadius = this._player.collisionRadius;
      const HIT_TOLERANCE = 0.5;

      for (const asteroid of this._asteroids) {
        if (asteroid.isDestroyed || asteroid.mesh.isDisposed()) {
          continue;
        }

        const asteroidPos = asteroid.mesh.position;
        const asteroidRadius = asteroid.mesh.getBoundingInfo().boundingSphere.radiusWorld;
        const hitDistance = playerRadius + asteroidRadius + HIT_TOLERANCE;

        if (Vector3.DistanceSquared(playerPos, asteroidPos) > hitDistance * hitDistance) {
          continue;
        }

        this._player.takeDamage(1);
        asteroid.destroy();
        break;
      }
    }

    private reflectAsteroidWithinArena(asteroid: Asteroid): void {
      const bounds = this._arena.bounds;
      const position = asteroid.mesh.position;
      const radius = asteroid.mesh.getBoundingInfo().boundingSphere.radiusWorld;
      const velocity = asteroid.getVelocity();
      let bounced = false;

      const minX = bounds.minX + radius;
      const maxX = bounds.maxX - radius;
      const minY = bounds.minY + radius;
      const maxY = bounds.maxY - radius;
      const minZ = bounds.minZ + radius;
      const maxZ = bounds.maxZ - radius;

      if (position.x <= minX && velocity.x < 0) {
        position.x = minX;
        velocity.x *= -1;
        bounced = true;
      } else if (position.x >= maxX && velocity.x > 0) {
        position.x = maxX;
        velocity.x *= -1;
        bounced = true;
      }

      if (position.y <= minY && velocity.y < 0) {
        position.y = minY;
        velocity.y *= -1;
        bounced = true;
      } else if (position.y >= maxY && velocity.y > 0) {
        position.y = maxY;
        velocity.y *= -1;
        bounced = true;
      }

      if (position.z <= minZ && velocity.z < 0) {
        position.z = minZ;
        velocity.z *= -1;
        bounced = true;
      } else if (position.z >= maxZ && velocity.z > 0) {
        position.z = maxZ;
        velocity.z *= -1;
        bounced = true;
      }

      if (bounced) {
        asteroid.setVelocity(velocity);
      }
    }

    private disposeExitZoneBeacon(): void {
      if (this._exitZoneBeacon === null) {
        return;
      }

      if (!this._exitZoneBeacon.isDisposed) {
        this._exitZoneBeacon.stop();
        this._exitZoneBeacon.dispose();
      }

      this._exitZoneBeacon = null;
    }
  }

  return new RuntimeController(sceneBootstrap);
}
