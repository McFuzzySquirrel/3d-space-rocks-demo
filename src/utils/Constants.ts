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
    }
  }
};
