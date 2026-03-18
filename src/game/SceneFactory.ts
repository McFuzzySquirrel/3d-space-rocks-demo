import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { FollowCamera } from "@babylonjs/core/Cameras/followCamera";
import { APP_CONFIG } from "../utils/Constants";
import {
  preloadLocalMeshAssets
} from "../systems/AssetLoader";
import type { LocalMeshAssetDefinition, AssetLoadCallbacks, AssetLoadResult } from "../systems/AssetLoader";
import { setupFollowCamera } from "../systems/CameraSetup";

export interface SceneActorRegistration {
  readonly key: string;
  readonly node: AbstractMesh | TransformNode;
  readonly attachToCameraTarget?: boolean;
}

export interface SceneBootstrap {
  readonly scene: Scene;
  readonly camera: FollowCamera;
  readonly cameraTarget: AbstractMesh;
  registerSceneActor: (registration: SceneActorRegistration) => void;
  loadLocalAssets: (
    definitions: readonly LocalMeshAssetDefinition[],
    callbacks?: AssetLoadCallbacks
  ) => Promise<AssetLoadResult>;
  dispose: () => void;
}

function createSkybox(scene: Scene): void {
  const skybox = MeshBuilder.CreateBox("space-skybox", { size: APP_CONFIG.scene.skybox.size }, scene);
  const material = new StandardMaterial("space-skybox-material", scene);
  const color = APP_CONFIG.scene.skybox.emissiveColor;

  material.backFaceCulling = false;
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.emissiveColor = new Color3(color.r, color.g, color.b);

  skybox.isPickable = false;
  skybox.infiniteDistance = true;
  skybox.material = material;
}

function createLighting(scene: Scene): void {
  const hemiConfig = APP_CONFIG.scene.lights.hemispheric;
  const hemisphericLight = new HemisphericLight(
    "space-hemi-light",
    new Vector3(hemiConfig.direction.x, hemiConfig.direction.y, hemiConfig.direction.z),
    scene
  );

  hemisphericLight.intensity = hemiConfig.intensity;

  const fillConfig = APP_CONFIG.scene.lights.fill;
  const fillLight = new PointLight(
    "space-fill-light",
    new Vector3(fillConfig.position.x, fillConfig.position.y, fillConfig.position.z),
    scene
  );

  fillLight.intensity = fillConfig.intensity;

  const rimConfig = APP_CONFIG.scene.lights.rim;
  const rimLight = new PointLight(
    "space-rim-light",
    new Vector3(rimConfig.position.x, rimConfig.position.y, rimConfig.position.z),
    scene
  );

  rimLight.intensity = rimConfig.intensity;
}

function createCameraTarget(scene: Scene): AbstractMesh {
  const start = APP_CONFIG.scene.cameraTargetStart;
  const target = MeshBuilder.CreateBox(
    "camera-target-player-placeholder",
    { size: 1 },
    scene
  );

  target.position = new Vector3(start.x, start.y, start.z);
  target.isVisible = false;
  target.isPickable = false;

  return target;
}

export function createSceneBootstrap(engine: Engine): SceneBootstrap {
  const scene = new Scene(engine);
  const clearColor = APP_CONFIG.scene.clearColor;

  scene.clearColor = new Color4(clearColor.r, clearColor.g, clearColor.b, clearColor.a);

  createSkybox(scene);
  createLighting(scene);

  const cameraTarget = createCameraTarget(scene);
  const camera = setupFollowCamera(scene, cameraTarget, {
    config: APP_CONFIG.scene.followCamera
  });

  const actors = new Map<string, AbstractMesh | TransformNode>();

  return {
    scene,
    camera,
    cameraTarget,
    registerSceneActor: ({ key, node, attachToCameraTarget = false }: SceneActorRegistration): void => {
      actors.set(key, node);

      if (attachToCameraTarget) {
        node.parent = cameraTarget;
      }
    },
    loadLocalAssets: (definitions, callbacks) => preloadLocalMeshAssets(scene, definitions, callbacks),
    dispose: (): void => {
      for (const actor of actors.values()) {
        if (!actor.isDisposed()) {
          actor.dispose(false, true);
        }
      }

      actors.clear();
      scene.dispose();
    }
  };
}
