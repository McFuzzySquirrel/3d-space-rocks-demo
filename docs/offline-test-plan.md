# Offline Test Plan

1. Build and serve the production app, then open it once while online.
Expected: `manifest.webmanifest` is requested, `sw.js` registers successfully, and the Application panel shows one current `space-rocks-runtime-*` cache containing the app shell, icons, and built `/assets/*` files.

2. Refresh once after the service worker activates.
Expected: the page is controlled by the service worker and gameplay starts normally with no missing scripts, styles, icons, audio, or Babylon resources.

3. Switch DevTools network emulation to `Offline`, then reload `/`.
Expected: the app still loads from cache, the canvas renders, controls respond, waves advance, scoring updates, and no cross-origin requests appear.

4. While still offline, navigate directly to `/` in a new tab and reload again.
Expected: navigation falls back to cached `/index.html`, the bundled assets resolve from cache, and the game remains fully playable.

5. Reconnect to the network, deploy a build with a different service worker version, and reload.
Expected: a new `space-rocks-runtime-*` cache is created, old cache versions are removed on activation, and the updated build becomes active without leaving stale hashed assets behind.

6. Rollback check: unregister the service worker and clear site storage in DevTools, then reload online.
Expected: the app still works as a normal web page, proving offline support degrades safely when caches are removed.