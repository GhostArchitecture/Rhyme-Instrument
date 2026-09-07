/* rhyme instrument — offline shell. network-first for the page (so updates land), cache-first for the
 * dictionary. Roadmap 1.6: no tool installs to a home screen it cannot serve.
 *
 * The cache name is the build stamp, substituted by build.js. It was hand-bumped before 1.6, so a deploy
 * that forgot to touch it served returning visitors a stale page from a cache that still looked current.
 * A stamp cannot be forgotten: it changes on every minted build by construction.
 *
 * The three CDN entries are gone with them. React is inlined in the page and babel-standalone no longer
 * exists, so the shell is now genuinely complete — before 1.6 it precached the libraries only AFTER a
 * successful online load, which is exactly the load that failed when the CDN was unreachable. */
const V = "tome-build-20260907011503";
const SHELL = ["./", "./index.html", "./cmu_skel.json", "./google10k.txt", "./subtlex_rank.txt", "./manifest.json", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const isPage = url.origin === location.origin && (url.pathname.endsWith("/") || url.pathname.endsWith("index.html"));
  if (isPage) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
      if (res.ok || res.type === "opaque") { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); } return res; })));
  }
});
