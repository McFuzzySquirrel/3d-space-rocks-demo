import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AssetsManager } from "@babylonjs/core/Misc/assetsManager";
import type { Scene } from "@babylonjs/core/scene";

export interface LocalMeshAssetDefinition {
  readonly id: string;
  readonly rootUrl: string;
  readonly fileName: string;
  readonly meshNames?: readonly string[];
}

export interface AssetLoadProgress {
  readonly loaded: number;
  readonly total: number;
  readonly ratio: number;
}

export interface AssetLoadCallbacks {
  readonly onProgress?: (progress: AssetLoadProgress) => void;
}

export interface AssetLoadResult {
  readonly loadedMeshCount: number;
  readonly meshesById: Readonly<Record<string, readonly AbstractMesh[]>>;
}

function assertLocalAssetPath(rootUrl: string): void {
  if (/^https?:\/\//i.test(rootUrl)) {
    throw new Error(`Remote URL is not allowed for offline-safe assets: ${rootUrl}`);
  }
}

export function preloadLocalMeshAssets(
  scene: Scene,
  meshAssets: readonly LocalMeshAssetDefinition[],
  callbacks: AssetLoadCallbacks = {}
): Promise<AssetLoadResult> {
  if (meshAssets.length === 0) {
    callbacks.onProgress?.({ loaded: 1, total: 1, ratio: 1 });

    return Promise.resolve({
      loadedMeshCount: 0,
      meshesById: {}
    });
  }

  const manager = new AssetsManager(scene);
  const meshesById: Record<string, readonly AbstractMesh[]> = {};

  for (const definition of meshAssets) {
    assertLocalAssetPath(definition.rootUrl);

    const task = manager.addMeshTask(
      definition.id,
      definition.meshNames ? [...definition.meshNames] : "",
      definition.rootUrl,
      definition.fileName
    );

    task.onSuccess = (loadedTask) => {
      meshesById[definition.id] = loadedTask.loadedMeshes;
    };
  }

  return new Promise<AssetLoadResult>((resolve, reject) => {
    manager.onProgress = (remainingCount, totalCount) => {
      const loaded = totalCount - remainingCount;
      const ratio = totalCount === 0 ? 1 : loaded / totalCount;

      callbacks.onProgress?.({
        loaded,
        total: totalCount,
        ratio
      });
    };

    manager.onFinish = () => {

      const loadedMeshCount = Object.values(meshesById).reduce((sum, meshes) => sum + meshes.length, 0);

      resolve({
        loadedMeshCount,
        meshesById
      });
    };

    manager.onTaskErrorObservable.add((task) => {
      reject(new Error(`Asset task failed: ${task.name}`));
    });

    manager.load();
  });
}
