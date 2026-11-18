/* Service worker: recibe archivos compartidos (Web Share Target) y da uso offline.
   Estrategia: red primero, caché como respaldo (así los precios nunca quedan viejos si hay conexión). */
const V = 'cotizador-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'menu.js', 'site.webmanifest', 'precios.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V && k !== 'shared').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method === 'POST' && u.pathname.endsWith('/share-target')) return e.respondWith(receive(r));
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }))
  );
});

// Guarda los archivos compartidos en caché 'shared' y abre la app; app.js los toma y los borra.
async function receive(r) {
  const c = await caches.open('shared');
  for (const k of await c.keys()) await c.delete(k);
  const files = (await r.formData()).getAll('files').filter(f => typeof f !== 'string');
  let i = 0;
  for (const f of files)
    await c.put('shared/' + i++, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name) } }));
  return Response.redirect(new URL('./?shared=' + i, self.registration.scope).href, 303);
}
