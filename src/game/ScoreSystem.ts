import { Observable } from "@babylonjs/core";
import { asteroidEvents, AsteroidSize } from "./Asteroid";
import { projectileEvents } from "./Projectile";
import { SCORING_CONFIG } from "../utils/Constants";
import { waveManagerEvents } from "./WaveManager";

/**
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
  scoreChanged$: new Observable<ScoreChangedEvent>(),
  highScoreUpdated$: new Observable<HighScoreUpdatedEvent>()
};

/**
 * ScoreSystem manages game scoring, high score persistence, and bonus awards.
 *
 * Subscribes to:
 * - asteroidEvents.destroyed$ — awards per-asteroid points scaled by size
 * - waveManagerEvents.waveComplete$ — awards 500 × waveNumber bonus
 * - waveManagerEvents.areaComplete$ — awards 2000 × areaNumber bonus
 */
export class ScoreSystem {
  private _currentScore: number = 0;
  private _highScore: number = 0;
  private _scoreMultiplier: number = 1.0;

  private _destroyedAsteroids = new Set<object>();

  private _asteroidDestroyedUnsubscribe: (() => void) | null = null;
  private _projectileDestroyedUnsubscribe: (() => void) | null = null;
  private _waveCompleteUnsubscribe: (() => void) | null = null;
  private _areaCompleteUnsubscribe: (() => void) | null = null;

  private readonly _localStorageKey = "3dSpaceRocks_highScore";

  constructor() {
    this._loadHighScore();
    this._subscribeToEvents();
  }

  public get currentScore(): number { return this._currentScore; }
  public get highScore(): number { return this._highScore; }
  public get scoreMultiplier(): number { return this._scoreMultiplier; }

  /**
   * Adds points to the current score, applies multiplier, and persists high score.
   * Emits scoreChanged$ for HUD subscribers.
   */
  public addPoints(points: number, reason: "asteroid" | "wave_bonus" | "area_bonus" = "asteroid"): void {
    const adjustedPoints = Math.floor(points * this._scoreMultiplier);
    this._currentScore += adjustedPoints;

    if (this._currentScore > this._highScore) {
      this._highScore = this._currentScore;
      this._persistHighScore();
      scoreEvents.highScoreUpdated$.notifyObservers({ newHighScore: this._highScore });
    }

    scoreEvents.scoreChanged$.notifyObservers({
      currentScore: this._currentScore,
      pointsAdded: adjustedPoints,
      reason
    });
  }

  /** Resets current score to 0. High score persists. */
  public reset(): void {
    this._currentScore = 0;
    this._destroyedAsteroids.clear();
  }

  /** Sets the score multiplier. Values > 1.0 increase points; < 1.0 decrease them. */
  public setMultiplier(multiplier: number): void {
    this._scoreMultiplier = Math.max(0, multiplier);
  }

  /** Unsubscribes from all events. Call on game shutdown. */
  public dispose(): void {
    if (this._asteroidDestroyedUnsubscribe) {
      this._asteroidDestroyedUnsubscribe();
      this._asteroidDestroyedUnsubscribe = null;
    }
    if (this._projectileDestroyedUnsubscribe) {
      this._projectileDestroyedUnsubscribe();
      this._projectileDestroyedUnsubscribe = null;
    }
    if (this._waveCompleteUnsubscribe) {
      this._waveCompleteUnsubscribe();
      this._waveCompleteUnsubscribe = null;
    }
    if (this._areaCompleteUnsubscribe) {
      this._areaCompleteUnsubscribe();
      this._areaCompleteUnsubscribe = null;
    }
    this._destroyedAsteroids.clear();
  }

  /**
   * Awards a wave-completion bonus: waveMultiplier × waveNumber (500 × wave by default).
   * Called automatically via waveManagerEvents.waveComplete$ subscription.
   */
  public awardWaveBonus(waveNumber: number): void {
    this.addPoints(SCORING_CONFIG.bonuses.waveMultiplier * waveNumber, "wave_bonus");
  }

  /**
   * Awards an area-completion bonus: areaMultiplier × areaNumber (2000 × area by default).
   * Called automatically via waveManagerEvents.areaComplete$ subscription.
   */
  public awardAreaBonus(areaNumber: number): void {
    this.addPoints(SCORING_CONFIG.bonuses.areaMultiplier * areaNumber, "area_bonus");
  }

  private _subscribeToEvents(): void {
    const asteroidSubscription = asteroidEvents.destroyed$.add((event) => {
      if (this._destroyedAsteroids.has(event.asteroid)) return;
      this._destroyedAsteroids.add(event.asteroid);
      this.addPoints(this._getPointsForSize(event.size), "asteroid");
    });
    this._asteroidDestroyedUnsubscribe = () => asteroidEvents.destroyed$.remove(asteroidSubscription);

    const projectileSubscription = projectileEvents.destroyed$.add(() => {
      // Projectile hit — asteroid destruction event handles scoring
    });
    this._projectileDestroyedUnsubscribe = () => projectileEvents.destroyed$.remove(projectileSubscription);

    const waveCompleteSubscription = waveManagerEvents.waveComplete$.add((event) => {
      this.awardWaveBonus(event.wave);
    });
    this._waveCompleteUnsubscribe = () => waveManagerEvents.waveComplete$.remove(waveCompleteSubscription);

    const areaCompleteSubscription = waveManagerEvents.areaComplete$.add((event) => {
      this.awardAreaBonus(event.area);
    });
    this._areaCompleteUnsubscribe = () => waveManagerEvents.areaComplete$.remove(areaCompleteSubscription);
  }

  private _getPointsForSize(size: AsteroidSize): number {
    switch (size) {
      case AsteroidSize.SMALL:  return SCORING_CONFIG.asteroid.small;
      case AsteroidSize.MEDIUM: return SCORING_CONFIG.asteroid.medium;
      case AsteroidSize.LARGE:  return SCORING_CONFIG.asteroid.large;
      default: return 0;
    }
  }

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
      console.warn("Failed to load high score from localStorage:", error);
    }
    this._highScore = 0;
  }

  private _persistHighScore(): void {
    try {
      localStorage.setItem(this._localStorageKey, this._highScore.toString());
    } catch (error) {
      console.warn("Failed to persist high score to localStorage:", error);
    }
  }
}
