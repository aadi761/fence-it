import React from 'react';
import MapView from './components/MapView';

const DEVICE_ID_KEY = 'geofence-device-id';
let deviceId = localStorage.getItem(DEVICE_ID_KEY);
if (!deviceId) {
  deviceId = 'device-' + Math.random().toString(36).slice(2, 9);
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
}

export default function App() {
  return (
    <div className="app">
      <div className="mapPane">
        <MapView deviceId={deviceId} />
      </div>
    </div>
  );
}
