const CACHE_VERSION = "__SW_VERSION__";
const CACHE_PREFIX = "space-rocks-runtime";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const APP_SHELL_URL = "/index.html";
const PRECACHE_URLS = __PRECACHE_URLS__;

function isOwnOriginRequest(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

async function precacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
}

async function cleanupOldCaches() {
  const cacheKeys = await caches.keys();
  const staleCacheKeys = cacheKeys.filter((cacheKey) => {
    return cacheKey.startsWith(CACHE_PREFIX) && cacheKey !== CACHE_NAME;
  });

  await Promise.all(staleCacheKeys.map((cacheKey) => caches.delete(cacheKey)));
}

async function putInRuntimeCache(request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());

  return response;
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  return putInRuntimeCache(request, networkResponse);
}

async function handleNavigationRequest(event) {
  try {
    return await cacheFirst(event.request);
  } catch {
    const appShellResponse = await caches.match(APP_SHELL_URL);

    if (appShellResponse) {
      return appShellResponse;
    }

    return new Response("Offline", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheApplicationShell();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await cleanupOldCaches();
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (!isOwnOriginRequest(requestUrl)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});