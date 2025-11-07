import React, { useState } from 'react';

export default function GeoFenceForm({ onCreate }) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState(60);

  function submit(e) {
    e.preventDefault();
    if (!name || !lat || !lon || !radius) return alert('fill all');
    onCreate({ name, lat: parseFloat(lat), lon: parseFloat(lon), radius: Number(radius) });
    setName(''); setLat(''); setLon(''); setRadius(60);
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} /><br/>
      <input placeholder="lat" value={lat} onChange={e => setLat(e.target.value)} /><br/>
      <input placeholder="lon" value={lon} onChange={e => setLon(e.target.value)} /><br/>
      <input placeholder="radius (m)" value={radius} onChange={e => setRadius(e.target.value)} /><br/>
      <button type="submit">Create Fence</button>
    </form>
  );
}
