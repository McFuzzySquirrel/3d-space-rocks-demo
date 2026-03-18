import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface PlayerConfig {
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
}

export interface PlayerState {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly yawRadians: number;
}

export interface PlayerController {
  readonly mesh: Mesh;
  readonly collisionRadius: number;
  update: (deltaSeconds: number) => void;
  getState: () => PlayerState;
  setState: (state: PlayerState) => void;
  dispose: () => void;
}

interface InputState {
  thrustForward: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}

function createShipMesh(scene: Scene): Mesh {
  const ship = MeshBuilder.CreateCylinder(
    "player-ship",
    {
      height: 5,
      diameterTop: 0,
      diameterBottom: 2.2,
      tessellation: 3
    },
    scene
  );

  ship.rotation.x = Math.PI / 2;

  const bodyMaterial = new StandardMaterial("player-ship-material", scene);
  bodyMaterial.diffuseColor = new Color3(0.72, 0.83, 0.95);
  bodyMaterial.emissiveColor = new Color3(0.12, 0.16, 0.22);

  ship.material = bodyMaterial;

  const thruster = MeshBuilder.CreateCylinder(
    "player-ship-thruster",
    {
      height: 0.8,
      diameter: 0.7,
      tessellation: 24
    },
    scene
  );

  thruster.parent = ship;
  thruster.position.z = -2.5;

  const thrusterMaterial = new StandardMaterial("player-ship-thruster-material", scene);
  thrusterMaterial.diffuseColor = new Color3(0.2, 0.45, 0.75);
  thrusterMaterial.emissiveColor = new Color3(0.1, 0.32, 0.75);

  thruster.material = thrusterMaterial;

  return ship;
}

function clampSpeed(velocity: Vector3, maxSpeed: number): void {
  const speed = velocity.length();

  if (speed <= maxSpeed || speed === 0) {
    return;
  }

  velocity.scaleInPlace(maxSpeed / speed);
}

export function createPlayerController(scene: Scene, config: PlayerConfig): PlayerController {
  const mesh = createShipMesh(scene);
  const velocity = new Vector3(0, 0, 0);
  const inputState: InputState = {
    thrustForward: false,
    rotateLeft: false,
    rotateRight: false
  };

  const position = new Vector3(config.spawnPosition.x, config.spawnPosition.y, config.spawnPosition.z);
  let yawRadians = 0;

  mesh.position.copyFrom(position);
  mesh.rotation.y = yawRadians;

  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        inputState.thrustForward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        inputState.rotateLeft = true;
        break;
      case "KeyD":
      case "ArrowRight":
        inputState.rotateRight = true;
        break;
      default:
        break;
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        inputState.thrustForward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        inputState.rotateLeft = false;
        break;
      case "KeyD":
      case "ArrowRight":
        inputState.rotateRight = false;
        break;
      default:
        break;
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    mesh,
    collisionRadius: config.collisionRadius,
    update: (deltaSeconds: number): void => {
      const turnInput = Number(inputState.rotateLeft) - Number(inputState.rotateRight);
      yawRadians += turnInput * config.turnSpeedRadians * deltaSeconds;

      if (inputState.thrustForward) {
        const forward = new Vector3(Math.sin(yawRadians), 0, Math.cos(yawRadians));
        velocity.addInPlace(forward.scale(config.thrustAcceleration * deltaSeconds));
      }

      const dragFactor = Math.max(0, 1 - config.dragPerSecond * deltaSeconds);
      velocity.scaleInPlace(dragFactor);
      clampSpeed(velocity, config.maxSpeed);

      position.addInPlace(velocity.scale(deltaSeconds));

      mesh.position.copyFrom(position);
      mesh.rotation.y = yawRadians;
    },
    getState: (): PlayerState => ({
      position: position.clone(),
      velocity: velocity.clone(),
      yawRadians
    }),
    setState: (state: PlayerState): void => {
      position.copyFrom(state.position);
      velocity.copyFrom(state.velocity);
      yawRadians = state.yawRadians;

      mesh.position.copyFrom(position);
      mesh.rotation.y = yawRadians;
    },
    dispose: (): void => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);

      if (!mesh.isDisposed()) {
        mesh.dispose(false, true);
      }
    }
  };
}
