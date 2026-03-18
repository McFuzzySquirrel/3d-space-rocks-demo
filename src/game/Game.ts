import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { SceneBootstrap } from "./SceneFactory";
import { createPlayerController } from "./Player";
import { createArenaController } from "./Arena";
import { APP_CONFIG } from "../utils/Constants";

export interface GameRuntime {
  update: (deltaMs: number) => void;
  dispose: () => void;
}

function syncCameraTarget(sceneBootstrap: SceneBootstrap, position: Vector3, yawRadians: number): void {
  sceneBootstrap.cameraTarget.position.copyFrom(position);
  sceneBootstrap.cameraTarget.rotation.y = yawRadians;
}

export function createGameRuntime(sceneBootstrap: SceneBootstrap): GameRuntime {
  const player = createPlayerController(sceneBootstrap.scene, APP_CONFIG.gameplay.player);
  const arena = createArenaController(sceneBootstrap.scene, APP_CONFIG.gameplay.arena);

  sceneBootstrap.registerSceneActor({ key: "player", node: player.mesh });

  for (const wall of arena.walls) {
    sceneBootstrap.registerSceneActor({ key: wall.name, node: wall });
  }

  player.setState({
    ...player.getState(),
    position: new Vector3(
      APP_CONFIG.gameplay.player.spawnPosition.x,
      APP_CONFIG.gameplay.player.spawnPosition.y,
      APP_CONFIG.gameplay.player.spawnPosition.z
    )
  });

  let accumulatorMs = 0;
  const fixedStepMs = APP_CONFIG.gameplay.fixedStepMs;

  return {
    update: (deltaMs: number): void => {
      const clampedDeltaMs = Math.min(deltaMs, 100);
      accumulatorMs += clampedDeltaMs;

      while (accumulatorMs >= fixedStepMs) {
        const stepSeconds = fixedStepMs / 1000;

        player.update(stepSeconds);
        arena.containPlayer(player);

        const playerState = player.getState();
        syncCameraTarget(sceneBootstrap, playerState.position, playerState.yawRadians);

        accumulatorMs -= fixedStepMs;
      }
    },
    dispose: (): void => {
      player.dispose();
      arena.dispose();
    }
  };
}
