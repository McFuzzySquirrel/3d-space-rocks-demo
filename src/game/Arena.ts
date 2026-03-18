import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Observable, Vector3 } from "@babylonjs/core";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface ArenaConfig {
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
}

export interface ArenaBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface ArenaController {
  readonly walls: readonly Mesh[];
  readonly bounds: ArenaBounds;
  readonly exitZonePosition: Vector3;
  readonly onExitZoneEnter$: Observable<void>;
  readonly onExitZoneOpened$: Observable<{ position: Vector3 }>;
  containState: (state: ArenaMovementState, collisionRadius: number) => ArenaMovementState;
  update: (elapsedSeconds: number, playerPosition?: Vector3, playerCollisionRadius?: number) => void;
  transitionToComplete: () => void;
  resetBarriers: () => void;
  openExitZone: () => void;
  closeExitZone: () => void;
  dispose: () => void;
}

export interface ArenaMovementState {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
}

const EXIT_ZONE_INDICATOR_HEIGHT = 5;
const EXIT_ZONE_TRIGGER_OFFSET = 5;
const EXIT_ZONE_FRONT_WALL_INDEX = 5;
const BARRIER_PULSE_PERIOD_SECONDS = 2;
const BARRIER_PULSE_BASE = 0.8;
const BARRIER_PULSE_AMPLITUDE = 0.2;
const EXIT_INDICATOR_ALPHA_BASE = 0.8;
const EXIT_INDICATOR_ALPHA_AMPLITUDE = 0.2;
const EXIT_INDICATOR_OSCILLATION_PERIOD_SECONDS = 2;
const BARRIER_TRANSITION_FRAMES = 60;
const FRONT_BARRIER_FADE_FRAMES = 30;

const COMPLETE_BARRIER_COLOR = new Color3(0, 1, 0);
const DEFAULT_BARRIER_COLOR = Color3.FromHexString("#FF4500");
const DEFAULT_BARRIER_ALPHA = 0.35;

const arenaExitZoneOpened$ = new Observable<{ position: Vector3 }>();
const arenaExitZoneEntered$ = new Observable<void>();
const arenaBarriersComplete$ = new Observable<void>();

export const arenaEvents = {
  exitZoneOpened$: arenaExitZoneOpened$,
  exitZoneEntered$: arenaExitZoneEntered$,
  barriersComplete$: arenaBarriersComplete$
};

function createWallMaterial(scene: Scene): StandardMaterial {
  const material = new StandardMaterial("arena-wall-material", scene);

  material.diffuseColor = DEFAULT_BARRIER_COLOR.clone();
  material.emissiveColor = DEFAULT_BARRIER_COLOR.scale(0.7);
  material.alpha = DEFAULT_BARRIER_ALPHA;
  material.backFaceCulling = false;

  return material;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function createWalls(scene: Scene, config: ArenaConfig, material: StandardMaterial): readonly Mesh[] {
  const halfWidth = config.width / 2;
  const halfHeight = config.height / 2;
  const halfDepth = config.depth / 2;
  const thickness = config.wallThickness;

  const walls: Mesh[] = [
    MeshBuilder.CreateBox(
      "arena-wall-left",
      { width: thickness, height: config.height, depth: config.depth },
      scene
    ),
    MeshBuilder.CreateBox(
      "arena-wall-right",
      { width: thickness, height: config.height, depth: config.depth },
      scene
    ),
    MeshBuilder.CreateBox(
      "arena-wall-bottom",
      { width: config.width, height: thickness, depth: config.depth },
      scene
    ),
    MeshBuilder.CreateBox(
      "arena-wall-top",
      { width: config.width, height: thickness, depth: config.depth },
      scene
    ),
    MeshBuilder.CreateBox(
      "arena-wall-back",
      { width: config.width, height: config.height, depth: thickness },
      scene
    ),
    MeshBuilder.CreateBox(
      "arena-wall-front",
      { width: config.width, height: config.height, depth: thickness },
      scene
    )
  ];

  walls[0].position.x = -halfWidth;
  walls[1].position.x = halfWidth;
  walls[2].position.y = -halfHeight;
  walls[3].position.y = halfHeight;
  walls[4].position.z = -halfDepth;
  walls[5].position.z = halfDepth;

  for (const wall of walls) {
    wall.material = material.clone(`${wall.name}-material`);
    wall.isPickable = false;
  }

  material.dispose(false, true);

  return walls;
}

function resolveContainedState(
  state: ArenaMovementState,
  bounds: ArenaBounds,
  collisionRadius: number,
  canExitThroughFront: (position: Vector3, radius: number) => boolean
): ArenaMovementState {
  const minX = bounds.minX + collisionRadius;
  const maxX = bounds.maxX - collisionRadius;
  const minY = bounds.minY + collisionRadius;
  const maxY = bounds.maxY - collisionRadius;
  const minZ = bounds.minZ + collisionRadius;
  const maxZ = bounds.maxZ - collisionRadius;

  const position = state.position.clone();
  const velocity = state.velocity.clone();

  const clampedX = clamp(position.x, minX, maxX);
  if (clampedX !== position.x) {
    position.x = clampedX;

    if ((clampedX === minX && velocity.x < 0) || (clampedX === maxX && velocity.x > 0)) {
      velocity.x = 0;
    }
  }

  const clampedY = clamp(position.y, minY, maxY);
  if (clampedY !== position.y) {
    position.y = clampedY;

    if ((clampedY === minY && velocity.y < 0) || (clampedY === maxY && velocity.y > 0)) {
      velocity.y = 0;
    }
  }

  if (position.z < minZ) {
    position.z = minZ;
    if (velocity.z < 0) {
      velocity.z = 0;
    }
  } else if (position.z > maxZ && !canExitThroughFront(position, collisionRadius)) {
    position.z = maxZ;
    if (velocity.z > 0) {
      velocity.z = 0;
    }
  }

  return {
    position,
    velocity,
    yawRadians: state.yawRadians,
    pitchRadians: state.pitchRadians
  };
}

export function createArenaController(scene: Scene, config: ArenaConfig): ArenaController {
  const bounds: ArenaBounds = {
    minX: -config.width / 2,
    maxX: config.width / 2,
    minY: -config.height / 2,
    maxY: config.height / 2,
    minZ: -config.depth / 2,
    maxZ: config.depth / 2
  };

  const wallMaterialTemplate = createWallMaterial(scene);
  const walls = createWalls(scene, config, wallMaterialTemplate);
  const wallMaterials = walls.map((wall) => wall.material as StandardMaterial);
  const frontWallMaterial = wallMaterials[EXIT_ZONE_FRONT_WALL_INDEX];
  const onExitZoneEnter$ = new Observable<void>();
  const onExitZoneOpened$ = new Observable<{ position: Vector3 }>();
  let exitZoneOpen = false;
  let exitZoneTriggered = false;
  let isTransitioningToComplete = false;
  let completionNotified = false;
  let activeTransitionCount = 0;
  let exitIndicatorMesh: Mesh | null = null;
  let exitIndicatorMaterial: StandardMaterial | null = null;

  const defaultBarrierColor = DEFAULT_BARRIER_COLOR.clone();
  const defaultBarrierBaseEmissive = DEFAULT_BARRIER_COLOR.scale(0.7);
  const completeBarrierBaseEmissive = COMPLETE_BARRIER_COLOR.scale(0.7);
  const exitZonePosition = new Vector3(0, 0, bounds.maxZ - EXIT_ZONE_TRIGGER_OFFSET);
  let activeBarrierColor = defaultBarrierColor.clone();
  let activeBarrierBaseEmissive = defaultBarrierBaseEmissive.clone();

  const exitHalfHeight = EXIT_ZONE_INDICATOR_HEIGHT / 2;

  function isWithinExitOpening(position: Vector3, collisionRadius: number): boolean {
    return Math.abs(position.y) <= exitHalfHeight + collisionRadius;
  }

  function isInExitZone(playerPosition: Vector3, collisionRadius: number): boolean {
    if (!exitZoneOpen || exitZoneTriggered) {
      return false;
    }

    const frontBoundary = bounds.maxZ - EXIT_ZONE_TRIGGER_OFFSET - collisionRadius;

    return (
      playerPosition.z >= frontBoundary &&
      isWithinExitOpening(playerPosition, collisionRadius)
    );
  }

  function canExitThroughFront(position: Vector3, collisionRadius: number): boolean {
    return exitZoneOpen && isWithinExitOpening(position, collisionRadius);
  }

  function stopBarrierAnimations(): void {
    for (const material of wallMaterials) {
      scene.stopAnimation(material);
    }
    activeTransitionCount = 0;
    isTransitioningToComplete = false;
  }

  function setBarrierVisualState(color: Color3, baseEmissive: Color3): void {
    activeBarrierColor = color.clone();
    activeBarrierBaseEmissive = baseEmissive.clone();

    for (const material of wallMaterials) {
      material.diffuseColor.copyFrom(activeBarrierColor);
      material.emissiveColor.copyFrom(activeBarrierBaseEmissive);
      material.alpha = DEFAULT_BARRIER_ALPHA;
    }
  }

  function ensureExitIndicator(): void {
    if (exitIndicatorMesh !== null && !exitIndicatorMesh.isDisposed()) {
      return;
    }

    const indicator = MeshBuilder.CreatePlane(
      "arena-exit-indicator",
      { width: config.width, height: EXIT_ZONE_INDICATOR_HEIGHT },
      scene
    );
    indicator.position = new Vector3(0, 0, bounds.maxZ - config.wallThickness);
    indicator.rotation.y = Math.PI;
    indicator.isPickable = false;

    const material = new StandardMaterial("arena-exit-indicator-material", scene);
    material.diffuseColor = COMPLETE_BARRIER_COLOR.clone();
    material.emissiveColor = COMPLETE_BARRIER_COLOR.clone();
    material.alpha = 0.7;
    material.backFaceCulling = false;

    indicator.material = material;
    exitIndicatorMesh = indicator;
    exitIndicatorMaterial = material;
  }

  function disposeExitIndicator(): void {
    if (exitIndicatorMesh !== null && !exitIndicatorMesh.isDisposed()) {
      exitIndicatorMesh.dispose(false, true);
    }
    exitIndicatorMesh = null;
    exitIndicatorMaterial = null;
  }

  function openExitZoneInternal(): void {
    ensureExitIndicator();
    scene.stopAnimation(frontWallMaterial);

    const alphaAnimation = new Animation(
      "front-barrier-alpha",
      "alpha",
      60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    alphaAnimation.setKeys([
      { frame: 0, value: frontWallMaterial.alpha },
      { frame: FRONT_BARRIER_FADE_FRAMES, value: 0 }
    ]);

    scene.beginDirectAnimation(frontWallMaterial, [alphaAnimation], 0, FRONT_BARRIER_FADE_FRAMES, false);

    exitZoneOpen = true;
    exitZoneTriggered = false;
    onExitZoneOpened$.notifyObservers({ position: exitZonePosition.clone() });
    arenaExitZoneOpened$.notifyObservers({ position: exitZonePosition.clone() });
  }

  return {
    walls,
    bounds,
    exitZonePosition,
    onExitZoneEnter$,
    onExitZoneOpened$,
    containState: (state: ArenaMovementState, collisionRadius: number): ArenaMovementState => {
      return resolveContainedState(state, bounds, collisionRadius, canExitThroughFront);
    },
    update: (elapsedSeconds: number, playerPosition?: Vector3, playerCollisionRadius = 0): void => {
      if (!isTransitioningToComplete) {
        const pulse =
          BARRIER_PULSE_BASE +
          BARRIER_PULSE_AMPLITUDE *
            Math.sin((2 * Math.PI * elapsedSeconds) / BARRIER_PULSE_PERIOD_SECONDS);

        for (const material of wallMaterials) {
          material.emissiveColor.copyFrom(activeBarrierBaseEmissive.scale(pulse));
        }
      }

      if (exitIndicatorMaterial !== null) {
        const indicatorAlpha =
          EXIT_INDICATOR_ALPHA_BASE +
          EXIT_INDICATOR_ALPHA_AMPLITUDE *
            Math.sin((2 * Math.PI * elapsedSeconds) / EXIT_INDICATOR_OSCILLATION_PERIOD_SECONDS);
        exitIndicatorMaterial.alpha = indicatorAlpha;
      }

      if (
        playerPosition !== undefined &&
        isInExitZone(playerPosition, playerCollisionRadius)
      ) {
        exitZoneTriggered = true;
        onExitZoneEnter$.notifyObservers();
        arenaExitZoneEntered$.notifyObservers();
      }
    },
    transitionToComplete: (): void => {
      if (isTransitioningToComplete) {
        return;
      }

      stopBarrierAnimations();
      isTransitioningToComplete = true;
      activeTransitionCount = wallMaterials.length * 2;

      for (const material of wallMaterials) {
        const emissiveAnimation = new Animation(
          "barrier-emissive-color",
          "emissiveColor",
          60,
          Animation.ANIMATIONTYPE_COLOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        emissiveAnimation.setKeys([
          { frame: 0, value: material.emissiveColor.clone() },
          { frame: BARRIER_TRANSITION_FRAMES, value: completeBarrierBaseEmissive.clone() }
        ]);

        const diffuseAnimation = new Animation(
          "barrier-diffuse-color",
          "diffuseColor",
          60,
          Animation.ANIMATIONTYPE_COLOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        diffuseAnimation.setKeys([
          { frame: 0, value: material.diffuseColor.clone() },
          { frame: BARRIER_TRANSITION_FRAMES, value: COMPLETE_BARRIER_COLOR.clone() }
        ]);

        scene.beginDirectAnimation(
          material,
          [emissiveAnimation],
          0,
          BARRIER_TRANSITION_FRAMES,
          false,
          1,
          () => {
            activeTransitionCount -= 1;
            if (activeTransitionCount === 0) {
              isTransitioningToComplete = false;
              setBarrierVisualState(COMPLETE_BARRIER_COLOR, completeBarrierBaseEmissive);
              if (!completionNotified) {
                completionNotified = true;
                arenaBarriersComplete$.notifyObservers();
              }
              openExitZoneInternal();
            }
          }
        );

        scene.beginDirectAnimation(
          material,
          [diffuseAnimation],
          0,
          BARRIER_TRANSITION_FRAMES,
          false,
          1,
          () => {
            activeTransitionCount -= 1;
            if (activeTransitionCount === 0) {
              isTransitioningToComplete = false;
              setBarrierVisualState(COMPLETE_BARRIER_COLOR, completeBarrierBaseEmissive);
              if (!completionNotified) {
                completionNotified = true;
                arenaBarriersComplete$.notifyObservers();
              }
              openExitZoneInternal();
            }
          }
        );
      }
    },
    resetBarriers: (): void => {
      stopBarrierAnimations();
      completionNotified = false;
      setBarrierVisualState(defaultBarrierColor, defaultBarrierBaseEmissive);
      exitZoneTriggered = false;
      exitZoneOpen = false;
      disposeExitIndicator();
    },
    openExitZone: (): void => {
      openExitZoneInternal();
    },
    closeExitZone: (): void => {
      scene.stopAnimation(frontWallMaterial);
      frontWallMaterial.alpha = DEFAULT_BARRIER_ALPHA;
      exitZoneOpen = false;
      exitZoneTriggered = false;
      disposeExitIndicator();
    },
    dispose: (): void => {
      stopBarrierAnimations();
      disposeExitIndicator();
      onExitZoneEnter$.clear();
      onExitZoneOpened$.clear();

      for (const wall of walls) {
        if (!wall.isDisposed()) {
          wall.dispose(false, true);
        }
      }
    }
  };
}
