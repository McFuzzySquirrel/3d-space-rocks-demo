import { Observable } from "@babylonjs/core";
import { asteroidEvents, AsteroidSize } from "./Asteroid";
import { projectileEvents } from "./Projectile";
import { SCORING_CONFIG } from "../utils/Constants";

/**
 * Event emitted when the score changes.
 */
export interface ScoreChangedEvent {
  readonly currentScore: number;
  readonly pointsAdded: number;
  readonly reason: "asteroid" | "wave_bonus" | "area_bonus";
}

/**
 * Event emitted when the high score is updated.
 */
export interface HighScoreUpdatedEvent {
  readonly newHighScore: number;
}

/**
 * Observable events emitted by the score system.
 * Subscribers (HUD, audio, VFX systems) listen for these events.
 */
export const scoreEvents = {
  /**
   * Emitted when the current score changes.
   * Includes the new score, points added, and the reason for the change.
   */
  scoreChanged$: new Observable<ScoreChangedEvent>(),

  /**
   * Emitted when the high score is updated.
   * Includes the new high score value.
   */
  highScoreUpdated$: new Observable<HighScoreUpdatedEvent>()
};

/**
 * ScoreSystem is a centralized service that listens to game events and manages scoring.
 *
 * Responsibilities:
 * - Listens to asteroid destruction events and awards points based on size
 * - Listens to wave/area completion events (integrated in Phase 3)
 * - Tracks current score and high score
 * - Persists high score to localStorage
 * - Emits score change events for HUD and other systems
 * - Supports score multipliers for difficulty scaling
 *
 * Architecture:
 * - ScoreSystem is a passive service that reacts to game events
 * - It does not own any game entities or meshes
 * - It coordinates scoring from multiple sources through a single event channel
 */
export class ScoreSystem {
  private _currentScore: number = 0;
  private _highScore: number = 0;
  private _scoreMultiplier: number = 1.0;

  /** Track destroyed asteroids to prevent double-scoring */
  private _destroyedAsteroids = new Set<object>();

  private _asteroidDestroyedUnsubscribe: (() => void) | null = null;
  private _projectileDestroyedUnsubscribe: (() => void) | null = null;

  private readonly _localStorageKey = "3dSpaceRocks_highScore";

  /**
   * Constructs the ScoreSystem.
   * Initializes currentScore to 0, loads highScore from localStorage, and subscribes to events.
   */
  constructor() {
    this._loadHighScore();
    this._subscribeToEvents();
  }

  /**
   * Returns the current game score.
   */
  public get currentScore(): number {
    return this._currentScore;
  }

  /**
   * Returns the high score (persisted value).
   */
  public get highScore(): number {
    return this._highScore;
  }

  /**
   * Returns the current score multiplier (default 1.0).
   * Used for difficulty scaling and future power-ups.
   */
  public get scoreMultiplier(): number {
    return this._scoreMultiplier;
  }

  /**
   * Adds points to the current score.
   * Applies the score multiplier and updates high score if necessary.
   * Emits a scoreChanged event for subscribers.
   *
   * @param points The base number of points to add
   * @param reason The reason for the score change (asteroid, wave_bonus, area_bonus)
   */
  public addPoints(points: number, reason: "asteroid" | "wave_bonus" | "area_bonus" = "asteroid"): void {
    const adjustedPoints = Math.floor(points * this._scoreMultiplier);
    const previousScore = this._currentScore;

    this._currentScore += adjustedPoints;

    // Update high score if current score exceeds it
    if (this._currentScore > this._highScore) {
      this._highScore = this._currentScore;
      this._persistHighScore();

      // Emit high score updated event
      scoreEvents.highScoreUpdated$.notifyObservers({
        newHighScore: this._highScore
      });
    }

    // Emit score changed event
    scoreEvents.scoreChanged$.notifyObservers({
      currentScore: this._currentScore,
      pointsAdded: adjustedPoints,
      reason
    });
  }

  /**
   * Resets the current score to 0.
   * The high score remains unchanged (it's persistent).
   * Clears the set of destroyed asteroids.
   */
  public reset(): void {
    this._currentScore = 0;
    this._destroyedAsteroids.clear();
  }

  /**
   * Sets the score multiplier for difficulty scaling.
   * Default is 1.0. Values > 1.0 increase points awarded, < 1.0 decrease them.
   *
   * @param multiplier The new multiplier value
   */
  public setMultiplier(multiplier: number): void {
    this._scoreMultiplier = Math.max(0, multiplier);
  }

  /**
   * Cleans up the ScoreSystem by unsubscribing from all events.
   * Should be called when the game is shutting down.
   */
  public dispose(): void {
    if (this._asteroidDestroyedUnsubscribe) {
      this._asteroidDestroyedUnsubscribe();
      this._asteroidDestroyedUnsubscribe = null;
    }

    if (this._projectileDestroyedUnsubscribe) {
      this._projectileDestroyedUnsubscribe();
      this._projectileDestroyedUnsubscribe = null;
    }

    this._destroyedAsteroids.clear();
  }

  /**
   * Subscribes to asteroid and projectile destruction events.
   * Awards points when asteroids are destroyed.
   */
  private _subscribeToEvents(): void {
    // Subscribe to asteroid destruction events
    const asteroidSubscription = asteroidEvents.destroyed$.add((event) => {
      // Check if we've already scored this asteroid
      // Use the asteroid object as the key to ensure we only score once
      if (this._destroyedAsteroids.has(event.asteroid)) {
        return;
      }

      // Mark this asteroid as destroyed and scored
      this._destroyedAsteroids.add(event.asteroid);

      // Determine point value based on asteroid size
      const pointValue = this._getPointsForSize(event.size);

      // Award points
      this.addPoints(pointValue, "asteroid");
    });

    this._asteroidDestroyedUnsubscribe = () => {
      asteroidEvents.destroyed$.remove(asteroidSubscription);
    };

    // Subscribe to projectile destruction events (for coordination)
    // This ensures we're aware when projectiles hit asteroids,
    // but the actual scoring happens through asteroid destruction.
    const projectileSubscription = projectileEvents.destroyed$.add(() => {
      // Projectile destroyed - the asteroid destruction event will handle scoring
      // This subscription is a placeholder for future coordination logic
    });

    this._projectileDestroyedUnsubscribe = () => {
      projectileEvents.destroyed$.remove(projectileSubscription);
    };
  }

  /**
   * Determines the point value for an asteroid based on its size.
   * Uses configuration from SCORING_CONFIG.
   *
   * @param size The asteroid size enum
   * @returns The point value for this size
   */
  private _getPointsForSize(size: AsteroidSize): number {
    switch (size) {
      case AsteroidSize.SMALL:
        return SCORING_CONFIG.asteroid.small;
      case AsteroidSize.MEDIUM:
        return SCORING_CONFIG.asteroid.medium;
      case AsteroidSize.LARGE:
        return SCORING_CONFIG.asteroid.large;
      default:
        return 0;
    }
  }

  /**
   * Loads the high score from localStorage.
   * Handles missing or corrupted data gracefully (defaults to 0).
   */
  private _loadHighScore(): void {
    try {
      const stored = localStorage.getItem(this._localStorageKey);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          this._highScore = parsed;
          return;
        }
      }
    } catch (error) {
      // localStorage may be unavailable in some browsers (privacy mode, etc.)
      // Silently fail and use default value
      console.warn("Failed to load high score from localStorage:", error);
    }

    this._highScore = 0;
  }

  /**
   * Persists the high score to localStorage.
   * Handles errors gracefully (e.g., quota exceeded, privacy mode).
   */
  private _persistHighScore(): void {
    try {
      localStorage.setItem(this._localStorageKey, this._highScore.toString());
    } catch (error) {
      // localStorage may be unavailable or full
      // Silently fail - the high score will still work during this session
      console.warn("Failed to persist high score to localStorage:", error);
    }
  }
}
