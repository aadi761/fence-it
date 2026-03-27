import React, { useEffect, useState } from 'react';
import API from '../services/api';

export default function NotificationTimeline({ deviceId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const url = deviceId ? `/api/events/device/${deviceId}` : '/api/events';
        const r = await API.get(url);
        if (mounted) setEvents(r.data);
      } catch (e) { /* ignore */ }
    }
    load();
    const t = setInterval(load, 3000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  return (
    <div>
      {/* Custom push UI removed per requirements */}
      {events.length === 0 && <div style={{ color: '#777' }}>No events yet</div>}
      {events.map(e => (
        <div key={e._id} style={{ borderBottom: '1px solid #eee', padding: 8 }}>
          <strong>{e.transition}</strong> — {e.fenceName || 'fence'}
          <div style={{ fontSize: 12, color: '#666' }}>{new Date(e.ts).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
