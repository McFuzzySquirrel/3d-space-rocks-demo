import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export interface FollowCameraConfig {
  readonly radius: number;
  readonly heightOffset: number;
  readonly rotationOffset: number;
  readonly cameraAcceleration: number;
  readonly maxCameraSpeed: number;
}

export const DEFAULT_FOLLOW_CAMERA_CONFIG: FollowCameraConfig = {
  radius: 20,
  heightOffset: 8,
  rotationOffset: 180,
  cameraAcceleration: 0.05,
  maxCameraSpeed: 10
};

export interface SetupFollowCameraOptions {
  readonly name?: string;
  readonly config?: Partial<FollowCameraConfig>;
}

export type CameraTarget = AbstractMesh;

export function setupFollowCamera(
  scene: Scene,
  target: CameraTarget,
  options: SetupFollowCameraOptions = {}
): FollowCamera {
  const config: FollowCameraConfig = {
    ...DEFAULT_FOLLOW_CAMERA_CONFIG,
    ...options.config
  };

  const startPosition = new Vector3(
    target.position.x,
    target.position.y + config.heightOffset,
    target.position.z - config.radius
  );

  const camera = new FollowCamera(options.name ?? "gameplay-follow-camera", startPosition, scene);

  camera.lockedTarget = target;
  camera.radius = config.radius;
  camera.heightOffset = config.heightOffset;
  camera.rotationOffset = config.rotationOffset;
  camera.cameraAcceleration = config.cameraAcceleration;
  camera.maxCameraSpeed = config.maxCameraSpeed;
  scene.activeCamera = camera;

  return camera;
}
