import { Engine } from "@babylonjs/core/Engines/engine";
import { createSceneBootstrap } from "./game/SceneFactory";
import { createGameRuntime } from "./game/Game";
import { HUD } from "./game/HUD";
import { APP_CONFIG } from "./utils/Constants";

const canvasElement = document.getElementById(APP_CONFIG.render.canvasId);

if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error(`Missing canvas element: ${APP_CONFIG.render.canvasId}`);
}

const engine = new Engine(
  canvasElement,
  APP_CONFIG.render.antialias,
  undefined,
  APP_CONFIG.render.adaptToDeviceRatio
);

const sceneBootstrap = createSceneBootstrap(engine);
const gameRuntime = createGameRuntime(sceneBootstrap);
const hud = new HUD(sceneBootstrap.scene);

engine.runRenderLoop(() => {
  gameRuntime.update(engine.getDeltaTime());
  sceneBootstrap.scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("beforeunload", () => {
  hud.dispose();
  gameRuntime.dispose();
  sceneBootstrap.dispose();
  engine.dispose();
});
