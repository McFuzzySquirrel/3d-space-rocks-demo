export interface RenderConfig {
  readonly canvasId: string;
  readonly antialias: boolean;
  readonly adaptToDeviceRatio: boolean;
}

export interface SceneBootstrapConfig {
  readonly clearColor: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly followCamera: {
    readonly radius: number;
    readonly heightOffset: number;
    readonly rotationOffset: number;
    readonly cameraAcceleration: number;
    readonly maxCameraSpeed: number;
  };
  readonly skybox: {
    readonly size: number;
    readonly emissiveColor: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
    };
  };
  readonly lights: {
    readonly hemispheric: {
      readonly intensity: number;
      readonly direction: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
    };
    readonly fill: {
      readonly intensity: number;
      readonly position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
    };
    readonly rim: {
      readonly intensity: number;
      readonly position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
    };
  };
  readonly cameraTargetStart: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

export interface LocalAssetPaths {
  readonly models: string;
  readonly textures: string;
  readonly sounds: string;
}

export interface AssetConfig {
  readonly localAssetPaths: LocalAssetPaths;
}

export interface GameplayConfig {
  readonly fixedStepMs: number;
  readonly stateMachine: {
    readonly waveTransitionDelayMs: number;
    readonly areaTransitionFadeMs: number;
  };
  readonly waves: {
    readonly perArea: number;
    readonly baseAsteroidCounts: readonly number[];
    readonly baseSpeedMultipliers: readonly number[];
    readonly areaCountScale: number;
    readonly areaSpeedScale: number;
    readonly minSpawnDistFromPlayer: number;
    readonly waveTransitionDelayMs: number;
  };
  readonly player: {
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
  };
  readonly arena: {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly wallThickness: number;
    readonly wallAlpha: number;
    readonly wallColor: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
    };
    readonly wallEmissive: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
    };
  };
  readonly asteroids: {
    readonly speedBase: {
      readonly Large: number;
      readonly Medium: number;
      readonly Small: number;
    };
    readonly rotationSpeed: {
      readonly min: number;
      readonly max: number;
    };
    readonly spreadOffset: number;
    readonly childSpreadSpeed: number;
  };
  readonly projectiles: {
    readonly speed: number;
    readonly ttl: number;
  };
  readonly playerCombat: {
    readonly maxLives: number;
    readonly invulnerabilityDuration: number;
    readonly fireRateCooldown: number;
    readonly projectileSpawnDistance: number;
  };
  readonly scoring: {
    readonly asteroid: {
      readonly small: number;
      readonly medium: number;
      readonly large: number;
    };
    readonly bonuses: {
      readonly waveMultiplier: number;
      readonly areaMultiplier: number;
    };
  };
  readonly vfx: {
    readonly explosions: {
      readonly particleCountBySize: {
        readonly Large: number;
        readonly Medium: number;
        readonly Small: number;
      };
      readonly durationBySize: {
        readonly Large: number;
        readonly Medium: number;
        readonly Small: number;
      };
      readonly speedBySize: {
        readonly Large: number;
        readonly Medium: number;
        readonly Small: number;
      };
    };
    readonly damageFlash: {
      readonly flashIntervalDuration: number;
      readonly flashIntervalGap: number;
      readonly invulnerabilityDuration: number;
    };
    readonly cameraShake: {
      readonly maxIntensity: number;
      readonly durationMs: number;
    };
    readonly completion: {
      readonly areaParticleCount: number;
      readonly wavePulseParticleCount: number;
      readonly exitBeaconParticleCount: number;
    };
    readonly thruster: {
      readonly emitRate: number;
      readonly minLifetime: number;
      readonly maxLifetime: number;
      readonly minSize: number;
      readonly maxSize: number;
      readonly capacity: number;
    };
  };
}

export interface AppConfig {
  readonly render: RenderConfig;
  readonly scene: SceneBootstrapConfig;
  readonly assets: AssetConfig;
  readonly gameplay: GameplayConfig;
}

export const APP_CONFIG: AppConfig = {
  render: {
    canvasId: "game-canvas",
    antialias: true,
    adaptToDeviceRatio: true
  },
  scene: {
    clearColor: {
      r: 0.01,
      g: 0.03,
      b: 0.08,
      a: 1
    },
    followCamera: {
      radius: 20,
      heightOffset: 8,
      rotationOffset: 180,
      cameraAcceleration: 0.05,
      maxCameraSpeed: 10
    },
    skybox: {
      size: 1200,
      emissiveColor: {
        r: 0.015,
        g: 0.028,
        b: 0.05
      }
    },
    lights: {
      hemispheric: {
        intensity: 0.42,
        direction: {
          x: 0,
          y: 1,
          z: 0
        }
      },
      fill: {
        intensity: 0.55,
        position: {
          x: -40,
          y: 20,
          z: -20
        }
      },
      rim: {
        intensity: 0.3,
        position: {
          x: 32,
          y: 14,
          z: 30
        }
      }
    },
    cameraTargetStart: {
      x: 0,
      y: 0,
      z: 0
    }
  },
  assets: {
    localAssetPaths: {
      models: "/assets/models/",
      textures: "/assets/textures/",
      sounds: "/assets/sounds/"
    }
  },
  gameplay: {
    fixedStepMs: 1000 / 60,
    stateMachine: {
      waveTransitionDelayMs: 2000,
      areaTransitionFadeMs: 800,
    },
    waves: {
      perArea: 3,
      baseAsteroidCounts: [3, 5, 7],
      baseSpeedMultipliers: [1.0, 1.15, 1.3],
      areaCountScale: 1.25,
      areaSpeedScale: 1.1,
      minSpawnDistFromPlayer: 15,
      waveTransitionDelayMs: 2000,
    },
    player: {
      thrustAcceleration: 26,
      turnSpeedRadians: 2.6,
      dragPerSecond: 1.2,
      maxSpeed: 22,
      collisionRadius: 2,
      spawnPosition: {
        x: 0,
        y: 0,
        z: 0
      }
    },
    arena: {
      width: 200,
      height: 100,
      depth: 200,
      wallThickness: 1.5,
      wallAlpha: 0.34,
      wallColor: {
        r: 1,
        g: 0.27,
        b: 0
      },
      wallEmissive: {
        r: 0.85,
        g: 0.2,
        b: 0.02
      }
    },
    asteroids: {
      speedBase: {
        Large: 15,
        Medium: 20,
        Small: 25
      },
      rotationSpeed: {
        min: 0.5,
        max: 1.0
      },
      spreadOffset: 2.0,
      childSpreadSpeed: 8.0
    },
    projectiles: {
      speed: 40,
      ttl: 10
    },
    playerCombat: {
      maxLives: 3,
      invulnerabilityDuration: 1.5,
      fireRateCooldown: 0.1,
      projectileSpawnDistance: 2.0
    },
    scoring: {
      asteroid: {
        small: 100,
        medium: 50,
        large: 25
      },
      bonuses: {
        waveMultiplier: 500,
        areaMultiplier: 2000
      }
    },
    vfx: {
      explosions: {
        particleCountBySize: {
          Large: 100,
          Medium: 70,
          Small: 40
        },
        durationBySize: {
          Large: 1.0,
          Medium: 0.9,
          Small: 0.8
        },
        speedBySize: {
          Large: 15,
          Medium: 12,
          Small: 10
        }
      },
      damageFlash: {
        flashIntervalDuration: 0.15,
        flashIntervalGap: 0.1,
        invulnerabilityDuration: 1.5
      },
      cameraShake: {
        maxIntensity: 0.3,
        durationMs: 100
      },
      completion: {
        areaParticleCount: 60,
        wavePulseParticleCount: 20,
        exitBeaconParticleCount: 15
      },
      thruster: {
        emitRate: 30,
        minLifetime: 0.2,
        maxLifetime: 0.4,
        minSize: 0.1,
        maxSize: 0.3,
        capacity: 50
      }
    }
  }
};

/**
 * Asteroid-specific configuration exported for use in Asteroid.ts
 * This is a convenience export of the nested APP_CONFIG.gameplay.asteroids
 */
export const ASTEROID_CONFIG = APP_CONFIG.gameplay.asteroids;

/**
 * Projectile-specific configuration exported for use in Projectile.ts
 * This is a convenience export of the nested APP_CONFIG.gameplay.projectiles
 */
export const PROJECTILE_CONFIG = APP_CONFIG.gameplay.projectiles;

/**
 * Player combat configuration exported for use in Player.ts
 * This includes lives, invulnerability duration, fire rate, and projectile spawn distance
 */
export const PLAYER_COMBAT_CONFIG = APP_CONFIG.gameplay.playerCombat;

/**
 * Scoring configuration exported for use in ScoreSystem.ts
 * This includes asteroid point values and wave/area bonus multipliers
 */
export const SCORING_CONFIG = APP_CONFIG.gameplay.scoring;

/**
 * VFX configuration exported for use in particle effects and damage feedback modules
 * This includes explosion parameters, flash timing, and camera shake tuning
 */
export const VFX_CONFIG = APP_CONFIG.gameplay.vfx;

/**
 * Wave and difficulty configuration exported for use in WaveManager.ts
 * Contains wave counts, speed multipliers, area scaling factors, and timing constants
 */
export const WAVE_CONFIG = APP_CONFIG.gameplay.waves;

/**
 * Game state machine timing constants for transition durations.
 */
export const STATE_MACHINE_CONFIG = APP_CONFIG.gameplay.stateMachine;
