# Performance & Offline Checklist — Phase 5

Run after every production build (`npm run build`). Items marked **Must** block release.

---

## 1. Bundle Size (NF-02)

```bash
npm run check:bundle    # automated — exits non-zero if over 15 MB
```

Manual fallback:
```bash
du -sh dist/
ls -lh dist/assets/
```

- [ ] **[NF-02 Must-proxy]** Total cached payload < 15 MB — current baseline ≈ 6.8 MB; headroom exists for future audio assets
- [ ] **[NF-02]** Single largest chunk (`babylon-core-*.js`) reviewed; verify tree-shaking is not regressing across builds
- [ ] No new CDN URLs introduced into source (would violate SP-05)

---

## 2. Initial Load Time (NF-03)

Tool: DevTools → Network → Disable cache → reload | Lighthouse → Performance

- [ ] **[NF-03]** Time-to-interactive on broadband < 5 s (target)
- [ ] **[NF-03]** Repeat-visit load (cached) < 3 s (Lighthouse "repeat visit" scenario)
- [ ] Check Lighthouse score ≥ 90 Performance; review any flagged render-blocking resources

---

## 3. Frame Rate (NF-01)

Tool: Babylon.js Inspector (`B` key or `BABYLON.Inspector.Show(scene)`) or DevTools Performance panel

- [ ] **[NF-01 Must]** FPS ≥ 60 sustained during Wave 3, Area 3 (maximum asteroid count)
- [ ] **[NF-01]** No frame-time spikes > 33 ms during wave transitions or area resets
- [ ] **[NF-01]** FPS stable on integrated GPU (tested on hardware from 2020 or equivalent VM)

---

## 4. Viewport Responsiveness (NF-04)

- [ ] **[NF-04 Must]** Canvas fills 100 % of viewport at 1920×1080
- [ ] **[NF-04]** Canvas fills 100 % of viewport at 1280×720 and 2560×1440
- [ ] **[NF-04]** Resize during gameplay: canvas adapts without distortion or overflow (`engine.resize()` fires)

---

## 5. Runtime Stability (NF-06)

- [ ] **[NF-06 Must]** Zero unhandled JS errors in console during a full 3-area session
- [ ] **[NF-06]** Zero unhandled promise rejections (DevTools → Console; filter "Uncaught")
- [ ] **[NF-06]** No memory leak: heap stable across ≥ 3 area transitions (DevTools → Memory → Timeline)

---

## 6. Service Worker — Cache Priming (O-01)

After first `npm run build && npm run preview`:

- [ ] **[O-01 Must]** SW registers successfully: DevTools Application → Service Workers shows `sw.js` active
- [ ] **[O-01]** Cache Storage shows exactly one `space-rocks-runtime-<version>` cache
- [ ] **[O-01]** Cache entries include: `/`, `/index.html`, `/manifest.webmanifest`, all `/assets/*.js` chunks, all `/icons/*` files
- [ ] **[SP-04 Must]** Cache contains **only** own-origin URLs — no `http(s)://` external entries
- [ ] **[SP-05 Must]** Network tab (first load): all JS from `/assets/` — zero CDN requests

---

## 7. Offline Playability (O-02)

Steps: load once online → DevTools → Network → Offline → reload

- [ ] **[O-02 Must]** Game loads and reaches MENU state while offline
- [ ] **[O-02 Must]** Full gameplay is functional: thrust, fire, wave completion, scoring, area transition
- [ ] **[O-02]** Opening a new tab to `/` while offline serves cached `index.html` (navigation fallback)
- [ ] **[O-02]** No cross-origin requests appear in Network panel while offline

---

## 8. PWA Install (O-03)

- [ ] **[O-03 Should]** Chrome/Edge: install icon visible in address bar at `localhost:4173` or production HTTPS origin
- [ ] **[O-03]** Installed app opens in `standalone` window (no browser chrome)
- [ ] **[O-03]** App icon (192 px, 512 px, maskable) displays correctly in OS launcher / home screen
- [ ] **[O-03]** Lighthouse PWA audit passes installability checks

---

## 9. Cache Update Strategy (O-04)

Steps: build → serve → load once → bump `version` in `package.json` → rebuild → reload online

- [ ] **[O-04 Should]** New `space-rocks-runtime-<new-version>` cache created on updated build
- [ ] **[O-04]** Old `space-rocks-runtime-<old-version>` cache deleted after activation (`cleanupOldCaches`)
- [ ] **[O-04]** `skipWaiting` fires — new SW activates without manual refresh
- [ ] **[O-04]** No stale hashed asset chunks remain in cache after update

---

## 10. Security Spot-Checks

- [ ] **[SP-04 Must]** SW `isOwnOriginRequest` guard verified: SW only caches same-origin responses
- [ ] **[SP-05 Must]** `package.json` dependencies: all pinned versions; no `http:` in import paths
- [ ] **[SP-06]** Response headers for `index.html` include `Content-Security-Policy: default-src 'self'; script-src 'self'; ...`

---

## 11. Accessibility Spot-Check

- [ ] **[ACC-07 Should]** `<canvas id="game-canvas" aria-label="3D Space Rocks game canvas">` in `index.html` — **already implemented**
- [ ] Screen reader announces canvas label when canvas is focused

---

## Measurement Log Template

Record results for each release candidate:

```
Date: YYYY-MM-DD
Build hash (sw.js CACHE_VERSION):
Browser tested:

NF-01 Max FPS: ___   Min FPS during Wave 3 Area 3: ___
NF-02 dist/ total size: ___ MB
NF-03 First load TTI: ___ s   Cached load TTI: ___ s
NF-06 Console errors: ___
O-01  SW registered: Y/N
O-02  Offline playable: Y/N
O-03  PWA install prompt: Y/N
O-04  Old cache removed after update: Y/N

Tester:
Notes:
```
