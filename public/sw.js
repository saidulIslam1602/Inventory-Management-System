/* global caches, fetch, self */
/**
 * Aqila IMS service worker (production only — see ServiceWorkerRegister).
 *
 * - Install precache (SHELL): `/offline.html`, `/login`, `/`
 * - /_next/static/* → cache-first (skip put if Cache-Control: no-store)
 * - Navigate `/` or `/login` → stale-while-revalidate in SHELL
 * - Other navigations → network-first → put HTML in PAGES if allowed
 * - postMessage { type: "CLEAR_AUTH_PAGE_CACHES" } → drop PAGES + trim SHELL (keep login + offline)
 *
 * Bump PAGES name after breaking deploys if stale shells become an issue.
 */
const SHELL = "aqila-ims-shell-v1";
const STATIC = "aqila-ims-static-v1";
const PAGES = "aqila-ims-pages-v1";
const OFFLINE_URL = "/offline.html";

/** Entry points warm-cached at install (best-effort). */
const PRECACHE_PATHS = [OFFLINE_URL, "/login", "/"];

/** Public shells where stale-while-revalidate improves first paint / offline revisit. */
const STALE_PUBLIC_PATHS = new Set(["/login", "/"]);

const ALLOWED = new Set([SHELL, STATIC, PAGES]);

function hasNoStore(res) {
  const cc = res.headers.get("cache-control");
  return cc != null && cc.toLowerCase().includes("no-store");
}

function isHtmlResponse(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function shouldPutNavigationShell(res) {
  return res.ok && isHtmlResponse(res) && !hasNoStore(res);
}

/** Keep only offline fallback + login in SHELL; drop precached `/` etc. */
function trimShellToPublicAuthSurfaces() {
  return caches.open(SHELL).then((cache) =>
    cache.keys().then((keys) =>
      Promise.all(
        keys.map((req) => {
          const p = new URL(req.url).pathname;
          if (p === "/offline.html" || p === "/login") return Promise.resolve();
          return cache.delete(req);
        })
      )
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        Promise.all(
          PRECACHE_PATHS.map((path) =>
            cache.add(new Request(path, { cache: "reload" })).catch(() => {
              /* precache best-effort */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !ALLOWED.has(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_AUTH_PAGE_CACHES") return;
  event.waitUntil(
    Promise.all([caches.delete(PAGES), trimShellToPublicAuthSurfaces()])
  );
});

/** Stale-while-revalidate for selected public navigations (SHELL cache). */
async function staleWhileRevalidateShell(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((res) => {
      if (shouldPutNavigationShell(res)) {
        void cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    void refresh;
    return cached;
  }

  const live = await refresh;
  if (live) return live;

  const fallback = await caches.match(OFFLINE_URL);
  return fallback || new Response("Offline", { status: 503, statusText: "Offline" });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req).then((res) => {
            if (res.ok && !hasNoStore(res)) void cache.put(req, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  if (req.mode === "navigate") {
    if (STALE_PUBLIC_PATHS.has(url.pathname)) {
      event.respondWith(staleWhileRevalidateShell(req));
      return;
    }

    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (shouldPutNavigationShell(res)) {
            const cache = await caches.open(PAGES);
            await cache.put(req, res.clone());
          }
          return res;
        } catch {
          const pages = await caches.open(PAGES);
          const cachedDoc = await pages.match(req);
          if (cachedDoc) return cachedDoc;
          const fallback = await caches.match(OFFLINE_URL);
          if (fallback) return fallback;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }
});
