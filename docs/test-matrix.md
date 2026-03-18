# Cross-Browser & Manual Validation Matrix — Phase 5

## Environment Setup

```bash
npm run build        # production build
npm run preview      # serves at http://localhost:4173 (HTTPS-like context for SW)
```

> DevTools → Application → Service Workers to inspect SW state.
> Use "Offline" throttle in DevTools Network tab for offline scenarios.
> Lighthouse audit (DevTools → Lighthouse → PWA) for O-03 installability.

---

## Browser Coverage (NF-05)

Test against **latest stable** release of each target:

| Browser | Engine | Platform |
|---------|--------|----------|
| Chrome ≥ 120 | Blink / V8 | Windows / macOS / Linux |
| Firefox ≥ 120 | Gecko | Windows / macOS / Linux |
| Edge ≥ 120 | Blink / V8 | Windows |
| Safari ≥ 17 | WebKit | macOS / iOS |

---

## Scenario Matrix

Mark each cell: **P** = Pass · **F** = Fail (link bug) · **S** = Skip (not applicable)

### Load & Service Worker

| # | PRD Ref | Scenario | Expected Result | Chrome | Firefox | Edge | Safari |
|---|---------|----------|-----------------|--------|---------|------|--------|
| L-01 | O-01, NF-03 | First online load — page opens blank URL, no prior cache | `sw.js` registers; `space-rocks-runtime-*` cache appears in Application → Cache Storage; load < 5 s on broadband | | | | |
| L-02 | O-01 | After SW activates, hard-reload (Ctrl+Shift+R) | All assets served; no console errors; game reaches MENU state | | | | |
| L-03 | NF-06 | Full 3-area playthrough — console open | Zero runtime errors and zero unhandled promise rejections in console | | | | |
| L-04 | ACC-07 | Inspect canvas element in DevTools or screen reader | `<canvas id="game-canvas" aria-label="3D Space Rocks game canvas">` present | | | | |

### Rendering & Responsiveness

| # | PRD Ref | Scenario | Expected Result | Chrome | Firefox | Edge | Safari |
|---|---------|----------|-----------------|--------|---------|------|--------|
| R-01 | NF-01 | Gameplay with max asteroid count (Wave 3, Area 3) | FPS ≥ 60 sustained; check via Babylon Inspector or DevTools Performance | | | | |
| R-02 | NF-04 | Resize browser window during play | Canvas fills viewport immediately; no letterbox or overflow | | | | |
| R-03 | NF-05 | 3D scene renders on each browser | Ship, asteroids, barriers, skybox all visible with correct materials | | | | |
| R-04 | NF-05 | Keyboard controls (W/A/S/D, Space, Esc) | All actions respond on each browser; no input lost | | | | |

### Offline & PWA

| # | PRD Ref | Scenario | Expected Result | Chrome | Firefox | Edge | Safari |
|---|---------|----------|-----------------|--------|---------|------|--------|
| O-01 | O-02 | Load once online → switch DevTools to Offline → reload `/` | App loads from cache, canvas renders, game is fully playable | | | | |
| O-02 | O-02 | Offline: open new tab → navigate to `/` | Navigation falls back to cached `index.html`; game starts normally | | | | |
| O-03 | O-03 | Chrome/Edge: open preview URL → check address bar for install icon | Install prompt appears; installed app opens standalone | | | | |
| O-04 | O-04 | Deploy build with bumped `package.json` version → reload online | Old `space-rocks-runtime-*` cache removed; new versioned cache active; no stale chunks | | | | |
| O-05 | O-01 | Inspect cache contents after first online load | Cache contains `/`, `/index.html`, `/manifest.webmanifest`, `/icons/*`, and all `/assets/*.js` chunks | | | | |
| O-06 | O-02 | Unregister SW + clear storage (DevTools) → reload online | App still works as normal web page (graceful degradation) | | | | |

### Security Spot-Checks

| # | PRD Ref | Scenario | Expected Result | Chrome | Firefox | Edge | Safari |
|---|---------|----------|-----------------|--------|---------|------|--------|
| SP-01 | SP-04 | DevTools Network while offline + playing | Zero requests to any cross-origin host | | | | |
| SP-02 | SP-05 | DevTools Network on first load | All JS chunks load from `/assets/*` (own origin), no CDN requests | | | | |
| SP-03 | SP-06 | DevTools Application → Headers for `index.html` | `Content-Security-Policy: default-src 'self'; script-src 'self'; ...` present | | | | |

---

## Defect Template

When recording a failure, capture:

```
ID: <scenario #>
Browser: <name + version>
OS: <name + version>
PRD Ref: <e.g., O-02>
Steps to Reproduce:
  1. ...
Expected: ...
Observed: ...
Console errors: <paste or "none">
```

---

## Sign-Off Checklist (Acceptance Criteria — PRD Section 18)

- [ ] Player controls ship, fires projectiles, destroys asteroids (AC-1)
- [ ] Each area has exactly 3 waves with increasing difficulty (AC-2)
- [ ] Barriers visible and change to green after wave 3 cleared (AC-3)
- [ ] Exit opens after barriers turn green; next area loads on entry (AC-4)
- [ ] Offline play confirmed on all four target browsers (AC-5 / O-02)
- [ ] 60 FPS confirmed on target hardware across all browsers (AC-6 / NF-01)
- [ ] Zero runtime errors during normal play sessions (AC-7 / NF-06)
