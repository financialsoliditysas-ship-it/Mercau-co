self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", () => {
  // Chrome uses this worker as the installed web app controller; requests stay network-first.
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const notification = self.registration.showNotification(data.title || "NUEVO PEDIDO EN MERCÁU", {
    body: data.body || "Abre el panel para revisar y aceptar el pedido.", icon: data.icon || "/logo-mercau.png",
    badge: data.badge || "/logo-mercau.png", tag: data.tag || "mercau-new-order", renotify: true,
    requireInteraction: true, silent: false, timestamp: Date.now(),
    vibrate: [700, 180, 700, 180, 900, 180, 900],
    data: { url: data.url || "/mi-cuenta/negocio", orderId: data.orderId || "" },
  });
  const alertOpenClients = clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    windows.forEach((client) => client.postMessage({ type: "MERCAU_NEW_ORDER_PUSH", orderId: data.orderId || "" }));
  });
  event.waitUntil(Promise.all([notification, alertOpenClients]));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/mi-cuenta/negocio", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ("focus" in client) { client.navigate(target); return client.focus(); }
    }
    return clients.openWindow ? clients.openWindow(target) : undefined;
  }));
});
