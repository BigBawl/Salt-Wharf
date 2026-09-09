const CACHE = "saltwharf-v5";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["./", "./index.html", "./manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Page loads go to the network first. index.html keeps the same URL on every
  // deploy, so cache-first here pins players to the build they first visited and
  // no amount of redeploying reaches them. Vite content-hashes the JS and CSS it
  // bundles, so a fresh index.html pulls a whole new build of the CODE in on its
  // own. Files under public/ are not hashed - see the note on the branch below.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))),
    );
    return;
  }

  // Everything else is cache-first. Vite's bundled output (assets/*.<hash>.js|css)
  // is content-hashed, so a new build simply asks for a new filename and this
  // branch fetches it. But files served straight out of public/ - items/, village/,
  // portraits/, og.jpg, the manifest - keep stable URLs, so CHANGED ART DOES NOT
  // REACH PLAYERS until CACHE is bumped.
  // Rule: any release that touches public/ must also bump CACHE at the top of this
  // file. A future option is to append a build id in asset() and retire the rule.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
