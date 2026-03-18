import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const SW_TEMPLATE_PATH = resolve(PROJECT_ROOT, "public/sw.js");
const PACKAGE_JSON_PATH = resolve(PROJECT_ROOT, "package.json");

function readPackageVersion(): string {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

function injectServiceWorkerBuildAssets(): Plugin {
  let resolvedConfig: ResolvedConfig | undefined;

  return {
    name: "inject-service-worker-build-assets",
    apply: "build",
    configResolved(config) {
      resolvedConfig = config;
    },
    writeBundle(_, bundle) {
      if (!resolvedConfig) {
        throw new Error("Missing resolved Vite config for service worker generation.");
      }

      const serviceWorkerTemplate = readFileSync(SW_TEMPLATE_PATH, "utf8");
      const bundleFiles = Object.values(bundle)
        .map((chunkOrAsset) => `/${chunkOrAsset.fileName}`)
        .filter((fileName) => fileName !== "/sw.js");
      const precacheUrls = Array.from(new Set([
        "/",
        "/index.html",
        "/manifest.webmanifest",
        "/icons/apple-touch-icon.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/icon-maskable-512.png",
        "/icons/icon.svg",
        ...bundleFiles
      ])).sort();
      const cacheVersion = `${readPackageVersion()}-${createHash("sha256")
        .update(precacheUrls.join("\n"))
        .digest("hex")
        .slice(0, 8)}`;
      const outputPath = resolve(resolvedConfig.root, resolvedConfig.build.outDir, "sw.js");
      const populatedServiceWorker = serviceWorkerTemplate
        .replace("__SW_VERSION__", cacheVersion)
        .replace("__PRECACHE_URLS__", JSON.stringify(precacheUrls, null, 2));

      writeFileSync(outputPath, populatedServiceWorker, "utf8");
    }
  };
}

export default defineConfig({
  plugins: [injectServiceWorkerBuildAssets()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@babylonjs/gui")) {
            return "babylon-gui";
          }

          if (id.includes("@babylonjs/core/Engines/")
            || id.includes("@babylonjs/core/Rendering/")
            || id.includes("@babylonjs/core/Materials/")
            || id.includes("@babylonjs/core/Shaders/")) {
            return "babylon-render";
          }

          if (id.includes("@babylonjs/core/Meshes/")
            || id.includes("@babylonjs/core/Maths/")
            || id.includes("@babylonjs/core/Cameras/")
            || id.includes("@babylonjs/core/Lights/")
            || id.includes("@babylonjs/core/scene")) {
            return "babylon-scene";
          }

          if (id.includes("@babylonjs/core/Particles/")
            || id.includes("@babylonjs/core/Physics/")
            || id.includes("@babylonjs/core/Collisions/")
            || id.includes("@babylonjs/core/Animations/")) {
            return "babylon-effects";
          }

          if (id.includes("@babylonjs/core")) {
            return "babylon-core";
          }

          if (id.includes("cannon-es")) {
            return "physics";
          }

          return undefined;
        }
      }
    }
  }
});
