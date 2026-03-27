import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import API from '../services/api';
import { registerPush, useLocationPing, showLocalNotification } from '../services/pushSubscription';
import NotificationTimeline from './NotificationTimeline';

function FenceFromViewButton({ onCreate }) {
  const map = useMap();
  return (
    <div
      style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}
    >
      <button onClick={() => {
        const b = map.getBounds();
        const c = b.getCenter();
        // approximate radius as half of diagonal of bounds
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const diag = distanceMeters(ne.lat, ne.lng, sw.lat, sw.lng);
        const radius = Math.max(50, Math.round(diag / 2));
        onCreate({ name: 'Viewport fence', message: '', lat: c.lat, lon: c.lng, radius });
      }}>Use map view as fence</button>
    </div>
  );
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapView({ deviceId }) {
  const [fences, setFences] = useState([]);
  const [me, setMe] = useState(null);
  const [meAccuracy, setMeAccuracy] = useState(null);
  const [tracking, setTracking] = useState(true);
  const [followMe, setFollowMe] = useState(true);
  useLocationPing(deviceId, pos => {
    setMe({ lat: pos.lat, lon: pos.lon, ts: pos.ts });
    if (pos.accuracy) setMeAccuracy(pos.accuracy);
  }, tracking);

  useEffect(() => { loadFences(); }, []);

  async function loadFences() {
    try {
      const r = await API.get('/api/fences');
      setFences(r.data);
    } catch (e) { console.error('load fences', e); }
  }

  async function createFence(body) {
    try {
      const r = await API.post('/api/fences', body);
      await loadFences();
      // immediate notify on create fallback
      if (r.data && r.data.insideNow) {
        await showLocalNotification({ title: `Entered ${r.data.fence.name}`, body: r.data.fence.message || '' , data: { source: 'local', fenceId: r.data.fence._id, demoTriggerId: r.data.demoTriggerId }});
      }
    } catch (e) { console.error('create fence', e); }
  }

  async function deleteFence(id) {
    try {
      await API.delete(`/api/fences/${id}`);
      await loadFences();
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    registerPush(deviceId).catch(err => console.warn('registerPush', err));
  }, [deviceId]);

  const [mapInstance, setMapInstance] = useState(null);
  const lastCenteredRef = useRef(null);

  function AutoCenter() {
    const map = useMap();
    useEffect(() => {
      setMapInstance(map);
      if (!me || !followMe) return;

      const prev = lastCenteredRef.current;
      const moved = prev ? distanceMeters(prev.lat, prev.lon, me.lat, me.lon) : Infinity;
      const shouldRecenter = moved > 20 || (typeof meAccuracy === 'number' && meAccuracy < 200);

      if (shouldRecenter) {
        map.setView([me.lat, me.lon], 16);
        lastCenteredRef.current = { lat: me.lat, lon: me.lon };
      }
    }, [me, followMe, meAccuracy, map]);
    return null;
  }


  const [showTimeline, setShowTimeline] = useState(false);
  const [name, setName] = useState('Delhi');
  const [message, setMessage] = useState('High pollution area — AQI unsafe!');

  function ControlPanel() {
    const map = useMap() || mapInstance;
    return (
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 6, width: 260 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Controls</div>
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', marginBottom: 6 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />
        <label>Message</label>
        <input value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%', marginBottom: 6 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />
        <button style={{ width: '100%', marginBottom: 8 }} onClick={() => {
          if (!map) return;
          const b = map.getBounds();
          const c = b.getCenter();
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          const diag = distanceMeters(ne.lat, ne.lng, sw.lat, sw.lng);
          const radius = Math.max(50, Math.round(diag / 2));
          createFence({ name, message, lat: c.lat, lon: c.lng, radius, demo: true, deviceId, currentLat: me?.lat, currentLon: me?.lon });
        }}>
          Save fence from view
        </button>
        <button style={{ width: '100%', marginBottom: 8 }} onClick={() => {
          if (!me) return;
          const radius = 40;
          createFence({ name, message, lat: me.lat, lon: me.lon, radius, demo: true, deviceId, currentLat: me.lat, currentLon: me.lon });
        }} disabled={!me}>
          {me ? 'Save fence at my location (40m)' : 'Locating…'}
        </button>
        <button style={{ width: '100%', marginBottom: 8 }} onClick={() => {
          if (me && mapInstance) {
            mapInstance.setView([me.lat, me.lon], 16);
            lastCenteredRef.current = { lat: me.lat, lon: me.lon };
          }
        }} disabled={!me}>
          {me ? '📍 Center on my location' : 'Locating…'}
        </button>
        <button style={{ width: '100%', marginBottom: 8 }} onClick={() => setFollowMe(v => !v)}>
          {followMe ? 'Disable auto-follow' : 'Enable auto-follow'}
        </button>
        <button style={{ width: '100%', marginBottom: 8 }} onClick={() => setTracking(t => !t)}>
          {tracking ? 'Pause tracking' : 'Resume tracking'}
        </button>
        <div style={{ fontSize: 12, color: '#444', marginBottom: 8 }}>
          Accuracy: {typeof meAccuracy === 'number' ? `${Math.round(meAccuracy)} m` : 'unknown'}
        </div>
        <button style={{ width: '100%' }} onClick={() => setShowTimeline(s => !s)}>
          {showTimeline ? 'Hide timeline' : 'Show timeline'}
        </button>
        <div style={{ marginTop: 8, maxHeight: 120, overflow: 'auto' }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          {fences.map(f => (
            <div key={f._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '4px 0' }}>
              <span>{f.name}</span>
              <div>
                <button onClick={async () => {
                  try {
                    const r = await API.post(`/api/fences/${f._id}/test`, { deviceId });
                    if (!r?.data?.sent) {
                      alert('Push not delivered. Re-allow notifications and reload once.');
                    }
                  } catch (e) {
                    const msg = e?.response?.data?.error || 'Push test failed';
                    alert(msg);
                  }
                  await showLocalNotification({ title: `Test: ${f.name}`, body: f.message || '' , data: { source: 'local', fenceId: f._id, transition: 'test' }});
                }} title="Test notification">🔔 Test</button>
                <button onClick={() => deleteFence(f._id)} style={{ marginLeft: 6 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <MapContainer center={[28.6139, 77.2090]} zoom={13} style={{ height: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <AutoCenter />
        <ControlPanel />
        {me && (
          <>
            {meAccuracy && (
              <Circle 
                center={[me.lat, me.lon]} 
                radius={meAccuracy} 
                pathOptions={{ color: '#6a1b9a', fillColor: '#6a1b9a', fillOpacity: 0.1, weight: 1 }} 
              />
            )}
            <CircleMarker center={[me.lat, me.lon]} radius={7} pathOptions={{ color: '#6a1b9a', fillColor: '#6a1b9a', fillOpacity: 1 }} />
          </>
        )}
        {fences.map(f => (
          <Circle key={f._id} center={[f.center.coordinates[1], f.center.coordinates[0]]} radius={f.radius} />
        ))}
      </MapContainer>
      {showTimeline && (
        <div style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 1000, background: 'rgba(255,255,255,0.95)', padding: 8, borderRadius: 6, width: 320, maxHeight: 260, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>Timeline</div>
            <button onClick={async () => { try { await API.delete(`/api/events/device/${deviceId}`); } catch (e) {} }}>Clear</button>
          </div>
          <NotificationTimeline deviceId={deviceId} />
        </div>
      )}
    </div>
  );
}
