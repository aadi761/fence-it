import React from 'react';
import MapView from './components/MapView';

const deviceId = 'device-' + Math.random().toString(36).slice(2, 9);

export default function App() {
  return (
    <div className="app">
      <div className="mapPane">
        <MapView deviceId={deviceId} />
      </div>
    </div>
  );
}
