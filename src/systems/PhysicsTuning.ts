/**
 * Physics tuning parameters for arcade-style gameplay.
 *
 * All values are tuned for:
 * - Immediate, responsive feel (low damping, high restitution)
 * - Stable simulation on mid-range hardware (reasonable mass ratios, iteration counts)
 * - Arcade gravity-free space environment (zero gravity, bouncy collisions)
 *
 * These values are used by entity systems (Player, Asteroid, etc.) when creating impostors.
 * If tweaking values, test on actual hardware and monitor FPS (target: 60 FPS).
 */
export const PhysicsTuning = {
  /**
   * World-level physics settings
   */
  WORLD: {
    /** Gravitational acceleration vector (0,0,0) = no gravity, space environment */
    gravity: [0, 0, 0] as [number, number, number],

    /** Fixed simulation time step: 1/60 second (60 Hz) for deterministic arcade gameplay */
    timeStep: 1 / 60,

    /** Solver iterations: 4 = good balance of stability and performance for browser physics */
    solverIterations: 4,

    /** Maximum number of frames to track collisions per impostor (prevent stale callbacks) */
    frameCollisionExpires: 1,
  },

  /**
   * Asteroid physics tuning
   *
   * Asteroids move with constant velocity in space (no gravity, no drag).
   * They bounce off barriers and the player with high energy retention.
   * Mass is scaled based on asteroid size to ensure consistent bounce behavior.
   */
  ASTEROIDS: {
    /** Base mass for medium asteroids (scales with size multiplier) */
    baseMass: 1.0,

    /** Mass multipliers per asteroid size category */
    massMultiplier: {
      Large: 2.0,   // Largest asteroids are 2x heavier
      Medium: 1.0,  // Reference mass
      Small: 0.5,   // Smallest asteroids are lighter for faster splits
    },

    /** Coefficient of restitution: 1.0 = perfectly elastic (no energy loss in bounce) */
    restitution: 1.0,

    /** Linear velocity damping: 0.1 = 10% energy loss per second (prevents infinite speeds) */
    damping: 0.1,

    /** Angular damping: prevents unrealistic spin-ups from glancing collisions */
    angularDamping: 0.3,

    /** Friction: 0 = frictionless surface (arcade feel, no resistance) */
    friction: 0,
  },

  /**
   * Player ship physics tuning
   *
   * The player is lighter than large asteroids, allowing quick dodging.
   * Slightly lower restitution (0.8 vs 1.0) to absorb some impact energy,
   * making collisions feel less "bouncy" and more "damaging".
   */
  SHIP: {
    /** Mass of the player ship */
    mass: 0.5,

    /** Restitution: 0.8 = retains 80% of collision energy (feels less bouncy than asteroids) */
    restitution: 0.8,

    /** Linear damping: 0.15 = quick velocity decay when engines are off */
    damping: 0.15,

    /** Angular damping: prevents unwanted spin from asymmetric collisions */
    angularDamping: 0.2,

    /** Friction: 0 = frictionless (no drag in space) */
    friction: 0,
  },

  /**
   * Projectile physics tuning
   *
   * Projectiles are lightweight, do not bounce (restitution 0), and do not experience drag.
   * They are deleted on collision with any object, so bouncing is not needed.
   */
  PROJECTILES: {
    /** Mass of a projectile (very light) */
    mass: 0.05,

    /** Restitution: 0.0 = projectiles do not bounce (absorbed on impact) */
    restitution: 0.0,

    /** Damping: 0 = no velocity decay (projectiles move in straight lines) */
    damping: 0,

    /** Angular damping: no rotation */
    angularDamping: 0,

    /** Friction: 0 = frictionless */
    friction: 0,
  },

  /**
   * Arena barrier physics tuning
   *
   * Barriers are static and immobile. They have high restitution (0.9) to bounce
   * asteroids and the player back energetically. They do not move or rotate.
   */
  BARRIERS: {
    /** Static: barriers are fixed in place (mass = 0 in physics engines) */
    static: true,

    /** Restitution: 0.9 = very bouncy (asteroids bounce back with most energy) */
    restitution: 0.9,

    /** Friction: 0 = frictionless (no directional resistance) */
    friction: 0,
  },
};

/**
 * Helper function to get mass for an asteroid of given size.
 *
 * @param size - 'Large' | 'Medium' | 'Small'
 * @returns Computed mass value
 */
export function getAsteroidMass(size: keyof typeof PhysicsTuning.ASTEROIDS.massMultiplier): number {
  return PhysicsTuning.ASTEROIDS.baseMass * PhysicsTuning.ASTEROIDS.massMultiplier[size];
}
