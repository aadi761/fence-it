self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'GeoFence', body: 'You have a notification' }; }
  const title = data.title || 'GeoFence';
  const options = {
    body: data.body || '',
    data: data.data || {},
    tag: 'geofence-notif'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
