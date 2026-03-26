import type {
  Scene,
  Mesh,
} from "@babylonjs/core";
import { MeshBuilder, Color3 } from "@babylonjs/core";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/**
 * Simple 3D Perlin-like noise function for vertex displacement.
 * Uses hash-based pseudo-random values seeded by position.
 * @param x X coordinate
 * @param y Y coordinate
 * @param z Z coordinate
 * @returns Noise value between -1 and 1
 */
function simplexNoise(x: number, y: number, z: number): number {
  // Hash function using prime multiplication
  const n =
    Math.sin(x * 12.9898 + y * 78.233 + z * 45.164) * 43758.5453;
  const hash = n - Math.floor(n);

  // Create a smoother curve using Hermite interpolation
  return hash * 2 - 1; // Range: -1 to 1
}

/**
 * Create a material for asteroids with rocky gray-brown appearance.
 * Cached per scene to avoid duplicate material creation.
 * @param scene The Babylon scene
 * @returns StandardMaterial configured for asteroids
 */
function createAsteroidMaterial(scene: Scene): StandardMaterial {
  const material = new StandardMaterial("asteroidMaterial", scene);

  // Rocky gray-brown diffuse color
  material.diffuseColor = new Color3(0.5, 0.45, 0.4);

  // Subtle specular for depth and realism
  material.specularColor = new Color3(0.2, 0.2, 0.2);
  material.specularPower = 16;

  // Slight emissive color for subtle glow
  material.emissiveColor = new Color3(0.1, 0.09, 0.08);

  material.backFaceCulling = true;

  return material;
}

/**
 * Create a material for projectiles with bright cyan glow.
 * Cached per scene to avoid duplicate material creation.
 * @param scene The Babylon scene
 * @returns StandardMaterial configured for projectiles with emissive glow
 */
function createProjectileMaterial(scene: Scene): StandardMaterial {
  const material = new StandardMaterial("projectileMaterial", scene);

  // Bright cyan base color
  const cyanColor = new Color3(0, 1, 1);
  material.diffuseColor = cyanColor;

  // Match emissive to diffuse for strong glow effect
  material.emissiveColor = cyanColor;

  // High specular for shiny appearance
  material.specularColor = new Color3(1, 1, 1);
  material.specularPower = 32;

  // Slight transparency for ethereal feel
  material.alpha = 0.9;

  material.backFaceCulling = true;

  return material;
}

/**
 * Create an asteroid mesh with vertex displacement noise.
 *
 * Creates an icosphere with procedural vertex displacement to approximate
 * an irregular rocky asteroid. Each size uses different subdivision levels
 * for LOD effect.
 *
 * @param size Size of the asteroid: 'Large', 'Medium', or 'Small'
 * @param scene The Babylon scene
 * @returns A Mesh representing the asteroid (not yet added to gameplay system)
 */
/** Shape variant builders for asteroid geometry variety. */
const ASTEROID_SHAPE_COUNT = 6;

function buildAsteroidBaseShape(size: "Large" | "Medium" | "Small", baseRadius: number, subdivisions: number, scene: Scene): Mesh {
  const variant = Math.floor(Math.random() * ASTEROID_SHAPE_COUNT);
  const name = `asteroid_${size}`;

  switch (variant) {
    case 0: // Icosphere — smooth round rock
      return MeshBuilder.CreateIcoSphere(name, { radius: baseRadius, subdivisions }, scene);

    case 1: // Box — cubic/boxy chunk
      return MeshBuilder.CreateBox(name, { size: baseRadius * 1.5 }, scene);

    case 2: // Tetrahedron — sharp angular shard
      return MeshBuilder.CreatePolyhedron(name, { type: 0, size: baseRadius }, scene);

    case 3: // Octahedron — diamond-like
      return MeshBuilder.CreatePolyhedron(name, { type: 1, size: baseRadius }, scene);

    case 4: // Dodecahedron — faceted near-sphere
      return MeshBuilder.CreatePolyhedron(name, { type: 2, size: baseRadius * 0.9 }, scene);

    case 5: // Low-poly prism — crystal / irregular column
    default:
      return MeshBuilder.CreateCylinder(name, {
        height: baseRadius * 1.4,
        diameter: baseRadius * 1.8,
        tessellation: 5 + Math.floor(Math.random() * 3)
      }, scene);
  }
}

export function createAsteroidMesh(
  size: "Large" | "Medium" | "Small",
  scene: Scene
): Mesh {
  // Determine subdivision level and scale based on size
  const subdivisions = size === "Large" ? 4 : size === "Medium" ? 3 : 2;
  const baseRadius = size === "Large" ? 2.0 : size === "Medium" ? 1.2 : 0.6;

  // Pick a random geometric shape for visual variety
  const asteroid = buildAsteroidBaseShape(size, baseRadius, subdivisions, scene);

  // Apply vertex displacement noise for irregular, battle-worn surface
  const positions = asteroid.getVerticesData("position");
  const normals = asteroid.getVerticesData("normal");

  if (positions && normals) {
    const updatedPositions = new Float32Array(positions);
    const displace = baseRadius * 0.12;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      const noise1 = simplexNoise(x, y, z) * displace;
      const noise2 = simplexNoise(x * 2, y * 2, z * 2) * (displace * 0.5);
      const noise3 = simplexNoise(x * 4, y * 4, z * 4) * (displace * 0.25);
      const totalNoise = noise1 + noise2 + noise3;

      const nx = normals[i];
      const ny = normals[i + 1];
      const nz = normals[i + 2];

      updatedPositions[i]     = x + nx * totalNoise;
      updatedPositions[i + 1] = y + ny * totalNoise;
      updatedPositions[i + 2] = z + nz * totalNoise;
    }

    asteroid.updateVerticesData("position", updatedPositions, true);
    asteroid.createNormals(true);
  }

  // Apply rocky asteroid material
  asteroid.material = createAsteroidMaterial(scene);

  return asteroid;
}

/**
 * Create a projectile mesh with emissive glow.
 *
 * Creates a small glowing cylindrical projectile for player firing.
 * The cylinder is tall and narrow to appear like a laser or bullet.
 *
 * @param scene The Babylon scene
 * @returns A Mesh representing the projectile (not yet added to gameplay system)
 */
export function createProjectileMesh(scene: Scene): Mesh {
  // Create small glowing projectile cylinder
  const projectile = MeshBuilder.CreateCylinder(
    "projectile",
    {
      height: 1.0,
      diameterTop: 0.2,
      diameterBottom: 0.2,
      tessellation: 8, // Reasonable polygon count for a small mesh
    },
    scene
  );

  // Apply cyan emissive material
  projectile.material = createProjectileMaterial(scene);

  return projectile;
}
