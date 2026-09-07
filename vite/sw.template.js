/* Service worker — generated at build time by vite/pwa-precache.ts.
 * Strategy: precache every built asset (cache-first, immutable hashed URLs);
 * navigations are network-first with the cached app shell as offline fallback.
  * The precache list and version are injected by the build. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `toolbox-${VERSION}`;
const SCOPE = self.registration.scope; // e.g. https://host/toolbox/

const toUrl = (p) => new URL(p, SCOPE).href;
const SHELL = toUrl('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map(toUrl));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('toolbox-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const offlinePage = (reason) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Toolbox</title>
<style>body{margin:0;padding:24px;font:16px/1.45 system-ui,-apple-system,sans-serif}p{margin:0 0 8px}pre{white-space:pre-wrap;font:13px/1.4 ui-monospace,Menlo,monospace}</style></head>
<body><p>Toolbox could not be loaded and no offline copy is stored on this device yet.</p><p>Check your connection, then <a href="./">try again</a>.</p><pre>${escapeHtml(reason)}</pre></body></html>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept API calls etc.

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      let reason = '';
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(SHELL, fresh.clone());
        return fresh;
      } catch (e) {
        reason = (e && e.message) || String(e);
      }
      const shell = await caches.match(SHELL, { ignoreVary: true });
      if (shell) return shell;
      // No network and no cached shell: say so. A network-error response here
      // would leave the user looking at a blank page with nothing to act on.
      return new Response(offlinePage(reason), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    })());
    return;
  }

  event.respondWith((async () => {
    // Hashed asset URLs are immutable, so ignoring Vary is safe; without it a
    // host that sends `Vary: Origin` never matches crossorigin module scripts.
    const cached = await caches.match(req, { ignoreVary: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname.startsWith(new URL(SCOPE).pathname)) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      return Response.error();
    }
  })());
});
