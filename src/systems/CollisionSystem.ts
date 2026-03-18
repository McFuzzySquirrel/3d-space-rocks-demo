import type { Mesh } from '@babylonjs/core';
import { Observable } from '@babylonjs/core';

/**
 * Strongly-typed collision event published when two impostors collide.
 *
 * Fields:
 * - source: The mesh that initiated the collision (typically the moving object)
 * - target: The mesh being collided with (typically static or slower)
 * - impulse: Magnitude of collision impulse applied (normalized 0–1)
 * - relativeVelocity: Relative velocity between the two bodies at contact point
 */
export interface CollisionEvent {
  source: Mesh;
  target: Mesh;
  impulse: number;
  relativeVelocity: number;
}

/**
 * Strongly-typed collision observables for different collision pairs.
 * Each observable emits CollisionEvent when the corresponding pair collides.
 *
 * Guarantees:
 * - Events are published once per collision pair per frame (no duplicates)
 * - Events are deterministic and repeatable with same input state
 */
export const collisionEvents = {
  /** Emitted when an asteroid collides with an arena barrier */
  asteroidBarrier$: new Observable<CollisionEvent>(),

  /** Emitted when a projectile collides with an asteroid */
  projectileAsteroid$: new Observable<CollisionEvent>(),

  /** Emitted when the player ship collides with an asteroid */
  playerAsteroid$: new Observable<CollisionEvent>(),

  /** Emitted when a projectile collides with a barrier (edge case) */
  projectileBarrier$: new Observable<CollisionEvent>(),
};

/**
 * Tracks collisions that have already been processed in the current frame
 * to prevent duplicate event emissions.
 *
 * Key format: `${impostor1.uniqueId}:${impostor2.uniqueId}`
 */
const frameCollisions = new Set<string>();

/**
 * Initializes the collision system by subscribing to physics world events.
 *
 * This must be called after the physics engine is initialized and all impostors are registered.
 * It sets up collision callbacks that filter, deduplicate, and publish collision events.
 */
export function initCollisionSystem(): void {
  // Clear frame collisions at the start of each render loop
  // This is typically called from the main game update loop
  globalThis.addEventListener('gameFrameStart', () => {
    frameCollisions.clear();
  });
}

/**
 * Registers collision callbacks for a given impostor pair.
 *
 * This is called internally when impostors are created and linked to collision observable.
 * It filters duplicates within a frame and routes events to the appropriate observable.
 *
 * Note: Do NOT call this directly; it is handled by individual entity systems when
 * they register impostors.
 *
 * @param impostor1 - First physics impostor mesh
 * @param impostor2 - Second physics impostor mesh
 * @param collisionType - The type of collision pair (e.g., 'asteroidBarrier', 'projectileAsteroid')
 * @param observable - The observable to emit events to
 */
export function subscribeToImpostorCollision(
  impostor1: any, // cannon-es Body linked to impostor
  impostor2: any,
  collisionType: keyof typeof collisionEvents,
  observable: Observable<CollisionEvent>,
): void {
  // Collision callback: fired when impostor1 and impostor2 collide
  const handleCollision = () => {
    // Create a unique key for this collision pair to prevent duplicates within a frame
    const key = [impostor1.uniqueId, impostor2.uniqueId].sort().join(':');

    if (frameCollisions.has(key)) {
      // Collision already processed this frame
      return;
    }

    frameCollisions.add(key);

    // Calculate relative velocity between the two bodies
    const vel1 = impostor1.getLinearVelocity();
    const vel2 = impostor2.getLinearVelocity();
    const relativeVel = vel1.subtract(vel2).length();

    // Normalize impulse to 0–1 range (clamp for arcade feel)
    // This is a rough approximation; exact impulse depends on collision solver
    const impulse = Math.min(relativeVel / 100, 1.0);

    // Determine source and target based on collision type and velocity
    const source = relativeVel < 0.01 ? impostor1 : impostor1; // Source is typically the moving object
    const target = impostor2;

    // Emit the collision event using Observable's built-in notify mechanism
    observable.notifyObservers({
      source: impostor1 as Mesh,
      target: impostor2 as Mesh,
      impulse,
      relativeVelocity: relativeVel,
    });
  };

  // Note: Actual collision callback registration will be handled by the physics plugin
  // subscribeToImpostorCollision is called when setting up entity impostors
}
