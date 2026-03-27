import { useEffect, useRef } from 'react';
import API from './api';

export async function registerPush(deviceId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported by browser');
    return;
  }
  const reg = await navigator.serviceWorker.register('/service-worker.js');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }
  let PUBLIC_KEY = '';
  try {
    const { data } = await API.get('/api/push/public-key');
    PUBLIC_KEY = data?.publicKey || '';
  } catch (e) {
    // Fallback to manual paste only if endpoint is unavailable
    PUBLIC_KEY = prompt('Paste VAPID public key from server (VAPID_PUBLIC):', '') || '';
  }
  if (!PUBLIC_KEY) {
    console.warn('No VAPID public key provided');
    return;
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
    });
  }

  await API.post('/api/push/subscribe', { deviceId, subscription: sub });
  console.log('Push subscription saved');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function useLocationPing(deviceId, onUpdate, enabled = true) {
  const last = useRef(null);
  const queue = useRef([]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    let lastSent = null;
    async function flushQueue() {
      if (queue.current.length === 0) return;
      const batch = [...queue.current];
      queue.current = [];
      for (const item of batch) {
        try { await API.post('/api/location', item); }
        catch (e) { queue.current.unshift(item); break; }
      }
    }

    const onOnline = () => { flushQueue(); };
    window.addEventListener('online', onOnline);

    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      console.log('📍 Location update:', { lat, lon, accuracy, source: pos.coords.altitude !== null ? 'GPS' : 'network' });
      const now = Date.now();
      const dist = last.current ? distanceMeters(last.current.lat, last.current.lon, lat, lon) : Infinity;
      if (!lastSent || dist > 25 || (now - lastSent > 8000)) {
        last.current = { lat, lon, ts: now };
        lastSent = now;
        onUpdate && onUpdate({ lat, lon, accuracy, ts: now });
        const payload = { deviceId, lat, lon, accuracy, ts: now };
        try {
          await API.post('/api/location', payload);
        } catch (e) {
          queue.current.push(payload);
        }
      }
    }, (err) => {
      console.error('Geo error', err);
      if (err.code === 1) console.warn('⚠️ Location permission denied');
      if (err.code === 2) console.warn('⚠️ Location unavailable');
      if (err.code === 3) console.warn('⚠️ Location timeout');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });

    return () => { navigator.geolocation.clearWatch(watchId); window.removeEventListener('online', onOnline); };
  }, [deviceId, enabled]);
}

export async function showLocalNotification({ title, body, data }) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.showNotification(title || 'GeoAlert', {
      body: body || '',
      data: data || {},
      tag: 'geoalert-demo'
    });
  } catch (e) { /* ignore */ }
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
