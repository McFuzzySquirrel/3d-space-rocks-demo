#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 *
 * Validates the production build output against the NF-02 budget:
 * "Total bundled asset size should be under 15 MB for fast caching"
 *
 * Usage:  node scripts/check-bundle-size.mjs [dist-path]
 * Exit 0: all checks pass
 * Exit 1: budget exceeded or dist/ not found
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const BUDGET_BYTES = 15 * 1024 * 1024; // NF-02: 15 MB
const WARN_THRESHOLD = 0.8;             // warn at 80 % of budget

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = process.argv[2] ?? join(PROJECT_ROOT, "dist");

/** Recursively collect all file sizes under a directory. */
function collectFileSizes(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFileSizes(fullPath));
    } else {
      results.push({ path: fullPath, size: statSync(fullPath).size });
    }
  }
  return results;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

let files;
try {
  files = collectFileSizes(distDir);
} catch {
  console.error(`[check-bundle-size] ERROR: dist directory not found at ${distDir}`);
  console.error("Run 'npm run build' first.");
  process.exit(1);
}

const total = files.reduce((sum, f) => sum + f.size, 0);
const budgetPct = ((total / BUDGET_BYTES) * 100).toFixed(1);

// Print per-file summary sorted by size descending
const sorted = [...files].sort((a, b) => b.size - a.size);
console.log("\n[check-bundle-size] Build output files:");
for (const f of sorted) {
  const rel = relative(PROJECT_ROOT, f.path);
  console.log(`  ${formatBytes(f.size).padStart(9)}  ${rel}`);
}

console.log(`\n[check-bundle-size] Total: ${formatBytes(total)} (${budgetPct}% of ${formatBytes(BUDGET_BYTES)} NF-02 budget)`);

if (total > BUDGET_BYTES) {
  console.error(`\n[check-bundle-size] FAIL [NF-02]: Total size ${formatBytes(total)} exceeds 15 MB budget.`);
  process.exit(1);
}

if (total > BUDGET_BYTES * WARN_THRESHOLD) {
  console.warn(`\n[check-bundle-size] WARN [NF-02]: Total size ${formatBytes(total)} exceeds 80% of budget. Consider reviewing chunk sizes.`);
}

console.log("[check-bundle-size] PASS [NF-02]: Bundle size within budget.\n");
