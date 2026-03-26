---
ejs:
  type: journey-adr
  version: 1.1
  adr_id: "0003"
  title: PWA Cache Strategy — Build-Injected Versioned Service Worker
  date: 2026-03-18
  status: accepted
  session_id: ejs-session-2026-03-18-04
  session_journey: ejs-docs/journey/2026/ejs-session-2026-03-18-04.md

actors:
  humans:
    - id: McFuzzySquirrel
      role: project owner
  agents:
    - id: copilot
      role: project orchestrator
    - id: pwa-specialist
      role: offline/PWA implementation

context:
  repo: 3d-space-rocks-demo
  branch: demos/prep
---

# Session Journey

Link to the originating session artifact:
- Session Journey: `ejs-docs/journey/2026/ejs-session-2026-03-18-04.md`

# Context

Phase 5 of the PRD required offline runtime support via a Service Worker and
a PWA manifest. The Vite build pipeline emits **content-hashed asset filenames**
(`babylon-core-CYiv5zo1.js`, etc.), which change with every build. Any Service
Worker that needs to precache those files must have an up-to-date list of their
current names.

PRD security requirements SP-04 and SP-05 also mandate own-origin-only caching:
no external CDN assets may be cached or intercepted.

The cache strategy chosen here is long-lived once deployed — stale Service Workers
are notoriously difficult to evict from end-user browsers — making this a
hard-to-reverse architectural decision.

---

# Session Intent

Implement an offline-capable PWA for the 3D Space Rocks demo that:
- Caches all app assets on first load and serves them offline thereafter.
- Tracks real build output without manual maintenance.
- Stays within the own-origin security boundary.
- Is installable via the browser's native mechanism.

# Collaboration Summary

The `pwa-specialist` sub-agent proposed a Vite build plugin approach (Option A) as
the implementation path. It was accepted immediately; no prototype of Option B or C
was built. The QA agent then validated the outcome via `npm run build` and
`npm run check:bundle`.

---

# Decision Trigger / Significance

- **Introduces a system boundary**: The Service Worker sits between the browser and
  the application, forming a new offline runtime layer.
- **Changes a public contract**: All asset delivery now flows cache-first through the
  SW; cache version mismatches can break the user experience.
- **Has long-lived / hard-to-reverse consequences**: Deployed SWs persist in user
  browsers until explicitly invalidated or updated. A wrong strategy is difficult to
  recover from without a forced SW update cycle.
- **Requires choosing among credible alternatives with meaningful trade-offs** — see below.

# Considered Options

## Option A — Build-Injected Versioned Precache (chosen)
A Vite plugin walks emitted assets after the build completes, computes a deterministic
version hash from the filenames, and injects the full precache URL list plus the
version string directly into `public/sw.js` template placeholders. The SW uses a
versioned cache key (`space-rocks-runtime-<hash>`) and cleans old caches on activate.

**Trade-offs:**
- Requires a small custom Vite plugin (~25 lines).
- Precache list is always accurate — zero drift risk.
- Version string changes with every meaningful build, ensuring stale SWs are evicted.

## Option B — Static/Manual Precache List
Hardcode the expected asset URLs in `sw.js` and update manually after each build.

**Rejected because:**
- Vite-hashed filenames change on every build; manual maintenance is error-prone.
- A missed update silently breaks offline caching for changed files.

## Option C — Workbox / vite-plugin-pwa
Use the Workbox library (via `workbox-webpack-plugin` or `vite-plugin-pwa`) to
generate the Service Worker and precache manifest automatically.

**Rejected because:**
- Adds a heavyweight dependency (~200 kB Workbox runtime) for a demo that already
  targets a minimal PWA setup.
- Introduces a leaky abstraction layer when the existing Vite config is already
  straightforward and the Service Worker logic is small.

---

# Decision

**Use a build-injected versioned precache strategy (Option A): a minimal Vite plugin
injects real emitted asset filenames and a computed version hash into `sw.js`
template placeholders at build time. The Service Worker uses cache-first semantics,
same-origin GET only, and cleans old caches on activate.**

---

# Rationale

Option A is the most reliable approach given Vite's content-hashed output: the
precache list is literally generated from the build artifacts rather than
maintained alongside them. The versioned cache key guarantees stale eviction.
Option B creates a silent breakage risk. Option C's dependency weight and
abstraction cost are disproportionate to the project's scale.

The same-origin fetch restriction directly satisfies SP-04/SP-05 with minimal code.
Production-only registration avoids dev-mode cache contamination without additional
configuration.

---

# Consequences

### Positive
- Offline caching is always in sync with the current build — no drift.
- Stale SWs are automatically evicted when the version hash changes.
- No external runtime dependencies added (Workbox-free).
- Same-origin boundary aligns with PRD security requirements.
- All assets (including Babylon JS chunks) are cached on first load.

### Negative / Trade-offs
- Every production build generates a new version string, which forces a full SW
  update cycle even for cosmetic content changes.
- The custom Vite plugin is non-standard; future maintainers must understand
  the placeholder injection mechanism.
- A large Babylon core chunk (~6 MB) takes longer to cache on first load on
  slow connections; no lazy-loading mitigation is in place.

---

# Key Learnings

- Vite build hooks (`generateBundle`, `writeBundle`) are sufficient for precache
  injection — no Workbox needed for simple, own-origin static PWAs.
- Manual chunking (`manualChunks`) improves browser cache re-use per module but
  does not reduce initial payload; tree-shaking or dynamic imports are needed for
  that.
- A single `check-bundle-size.mjs` script is a robust automated gate for NF-02
  when a full browser test harness is not yet in place.

---

# Agent Guidance

Prefer:
- Vite plugin injection over static lists for any SW that must reference
  content-hashed build outputs.
- Versioned cache keys with `caches.delete()` cleanup in the `activate` event.
- Same-origin-only fetch interception for games/demos without external API deps.
- `skip-waiting` + `clients.claim()` to ensure updated SWs take effect promptly.

Avoid:
- Workbox for demo-scale projects unless the recipe library is genuinely needed.
- Cross-origin cache interception; keep the security surface minimal.
- Deploying SW changes without bumping the precache version (breaks stale eviction).

---

# Reuse Signals

```yaml
reuse:
  patterns:
    - vite-build-plugin-precache-injection
    - same-origin-cache-first-service-worker
    - versioned-cache-key-with-activate-cleanup
  prompts:
    - "inject precache list and version hash into sw.js using a Vite plugin after generateBundle"
    - "service worker: cache-first strategy, same-origin GET only, navigation fallback to index.html"
  anti_patterns:
    - static-hardcoded-hashed-asset-names-in-sw
    - cross-origin-fetch-interception
    - workbox-for-demo-scale-pwa
  future_considerations:
    - lazy-loading or dynamic imports to reduce first-load cache size
    - background-sync or periodic-sync for potential future multiplayer/leaderboard features
```
