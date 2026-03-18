import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import type { PlayerController, PlayerState } from "./Player";

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
  containPlayer: (player: PlayerController) => void;
  dispose: () => void;
}

function createWallMaterial(scene: Scene, config: ArenaConfig): StandardMaterial {
  const material = new StandardMaterial("arena-wall-material", scene);

  material.diffuseColor = new Color3(config.wallColor.r, config.wallColor.g, config.wallColor.b);
  material.emissiveColor = new Color3(
    config.wallEmissive.r,
    config.wallEmissive.g,
    config.wallEmissive.b
  );
  material.alpha = config.wallAlpha;

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
    wall.material = material;
    wall.isPickable = false;
  }

  return walls;
}

function resolveContainedState(
  state: PlayerState,
  bounds: ArenaBounds,
  collisionRadius: number
): PlayerState {
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

  const clampedZ = clamp(position.z, minZ, maxZ);
  if (clampedZ !== position.z) {
    position.z = clampedZ;

    if ((clampedZ === minZ && velocity.z < 0) || (clampedZ === maxZ && velocity.z > 0)) {
      velocity.z = 0;
    }
  }

  return {
    position,
    velocity,
    yawRadians: state.yawRadians
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

  const wallMaterial = createWallMaterial(scene, config);
  const walls = createWalls(scene, config, wallMaterial);

  return {
    walls,
    bounds,
    containPlayer: (player: PlayerController): void => {
      const currentState = player.getState();
      const containedState = resolveContainedState(currentState, bounds, player.collisionRadius);

      player.setState(containedState);
    },
    dispose: (): void => {
      for (const wall of walls) {
        if (!wall.isDisposed()) {
          wall.dispose(false, true);
        }
      }

      wallMaterial.dispose(false, true);
    }
  };
}
