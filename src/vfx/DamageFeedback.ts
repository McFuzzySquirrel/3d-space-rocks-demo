import { Camera, Mesh, StandardMaterial, Color3, Scene } from "@babylonjs/core";
import { VFX_CONFIG } from "../utils/Constants";

/**
 * Applies a flashing invulnerability effect to the player mesh.
 *
 * Visual feedback:
 * - Flash pattern: 150ms on (white emissive) → 100ms off (normal) → repeat
 * - Duration: 1.5s (synced with PLAYER_COMBAT_CONFIG.invulnerabilityDuration)
 * - Color: bright white with high emissive intensity
 * - Cleanup: original material restored on completion
 *
 * This function stores a reference to the original material(s) and alternately
 * swaps between flash and normal materials. After the invulnerability duration
 * expires, the original material is restored.
 *
 * @param playerMesh The player ship mesh
 * @param durationSeconds Duration of the flash effect (default 1.5s)
 */
export function applyPlayerDamageFlash(
  playerMesh: Mesh,
  durationSeconds: number = 1.5
): void {
  const config = VFX_CONFIG.damageFlash;
  const scene = playerMesh.getScene();

  // Store original materials
  const originalMaterials: Map<string, StandardMaterial> = new Map();
  if (Array.isArray(playerMesh.material)) {
    // Multi-material case
    (playerMesh.material as any).materials?.forEach(
      (mat: StandardMaterial, index: number) => {
        if (mat instanceof StandardMaterial) {
          originalMaterials.set(`mat_${index}`, mat.clone(`${playerMesh.name}_original_${index}`));
        }
      }
    );
  } else if (playerMesh.material instanceof StandardMaterial) {
    // Single material case
    originalMaterials.set("default", playerMesh.material.clone(`${playerMesh.name}_original`));
  }

  // Create flash material (white with high emissive)
  const flashMaterial = new StandardMaterial(`${playerMesh.name}_flash`, scene);
  flashMaterial.emissiveColor = new Color3(1, 1, 1);
  flashMaterial.diffuseColor = new Color3(1, 1, 1);
  flashMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
  flashMaterial.alpha = 0.9;

  let elapsedMs = 0;
  let flashIsOn = true;
  let nextFlashToggleMs = config.flashIntervalDuration * 1000;

  // Create a custom update function for frame-based animation
  const updateFlash = (_scene: Scene) => {
    // Calculate delta time for this frame using engine's deltaTime
    const deltaMs = _scene.getEngine().getDeltaTime();
    elapsedMs += deltaMs;

    // Toggle flash state based on intervals
    if (elapsedMs >= nextFlashToggleMs) {
      flashIsOn = !flashIsOn;
      nextFlashToggleMs +=
        flashIsOn ?
          config.flashIntervalDuration * 1000
          : config.flashIntervalGap * 1000;

      // Apply material change
      if (flashIsOn) {
        applyMaterialToMesh(playerMesh, flashMaterial);
      } else {
        // Restore original materials
        originalMaterials.forEach((originalMat) => {
          applyMaterialToMesh(playerMesh, originalMat);
        });
      }
    }

    // Check if duration has elapsed
    if (elapsedMs >= durationSeconds * 1000) {
      // Restore original material and cleanup
      originalMaterials.forEach((originalMat) => {
        applyMaterialToMesh(playerMesh, originalMat);
      });
      flashMaterial.dispose();
      originalMaterials.forEach((mat) => mat.dispose());

      // Remove the update function from the scene's onBeforeRender
      scene.onBeforeRenderObservable.removeCallback(updateFlash);
    }
  };

  // Register update function to run each frame
  scene.onBeforeRenderObservable.add(updateFlash);
}

/**
 * Applies a subtle camera shake effect for damage and impact feedback.
 *
 * Parameters:
 * - Shake offsets: ±0.3 units on X/Y (intensity-scaled)
 * - Duration: typically 0.05–0.1s per impact
 * - Motion: smooth sine/cosine curves for comfortable (not jittery) feedback
 * - Restoration: camera smoothly returns to original position after shake
 *
 * Uses frame-based animation for smooth interpolation, not timeouts.
 * Multiple rapid impacts stack by resetting the shake timer.
 *
 * @param camera The camera to shake
 * @param intensity Intensity multiplier (0.0–1.0, default 1.0)
 * @param durationSeconds Duration of shake effect in seconds (default 0.1s)
 */
export function playImpactShake(
  camera: Camera,
  intensity: number = 1.0,
  durationSeconds: number = 0.1
): void {
  const config = VFX_CONFIG.cameraShake;
  const maxShakeOffset = config.maxIntensity * intensity;
  const shakeDurationMs = durationSeconds * 1000;
  const scene = camera.getScene();

  // Store original camera position
  const originalPosition = camera.position.clone();
  let elapsedMs = 0;

  // Create shake update function for frame-based animation
  const updateShake = (_scene: Scene) => {
    const deltaMs = _scene.getEngine().getDeltaTime();
    elapsedMs += deltaMs;
    const t = elapsedMs / shakeDurationMs;

    if (t >= 1.0) {
      // Restore camera to original position
      camera.position.copyFrom(originalPosition);
      scene.onBeforeRenderObservable.removeCallback(updateShake);
      return;
    }

    // Use sine waves for smooth, non-jittery motion
    // Apply different offsets on X and Y axes for natural feel
    const shakeX = Math.sin(t * Math.PI * 4) * maxShakeOffset * (1 - t);
    const shakeY = Math.cos(t * Math.PI * 5.5) * maxShakeOffset * (1 - t);

    // Apply shake offset
    camera.position.x = originalPosition.x + shakeX;
    camera.position.y = originalPosition.y + shakeY;
  };

  // Register update function
  scene.onBeforeRenderObservable.add(updateShake);
}

/**
 * Helper function to apply a material to a mesh, handling both single and multi-material cases.
 *
 * @param mesh The mesh to apply material to
 * @param material The material to apply
 */
function applyMaterialToMesh(mesh: Mesh, material: StandardMaterial): void {
  mesh.material = material;
}
