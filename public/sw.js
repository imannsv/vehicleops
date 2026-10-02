// No authenticated responses or evidence are cached. Offline sync is a future milestone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width"><title>VehicleOps offline</title><body style="font-family:system-ui;padding:40px"><h1>Keine Verbindung</h1><p>Verbinde dich mit dem Internet und lade die Seite neu. Lokal gespeicherte Entwürfe bleiben erhalten. Offline-Sync folgt in einer späteren Version.</p><button onclick="location.reload()">Erneut laden</button></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
