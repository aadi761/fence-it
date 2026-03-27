import express from 'express';
import GeoFence from '../models/GeoFence.js';
import EventLog from '../models/EventLog.js';
import Subscription from '../models/Subscription.js';
import { distanceMeters } from '../utils/geoUtils.js';
import * as turf from '@turf/turf';
import { sendPush } from '../utils/pushUtils.js';
const router = express.Router();

// in-memory last state for demo
const lastState = {}; // key: deviceId:fenceId -> { inside: bool, pendingFlip: bool|null, pendingSince: number|null, lastTransitionAt: number|undefined }

router.post('/', async (req, res) => {
  const { deviceId, lat, lon, accuracy = 30, ts, segments } = req.body;
  if (!deviceId || lat == null || lon == null) return res.status(400).json({ error: 'missing fields' });

  const locationPoint = { type: 'Point', coordinates: [lon, lat] };
  const now = ts ? new Date(ts).getTime() : Date.now();
  const fences = await GeoFence.find({});
  const createdEvents = [];

  for (const f of fences) {
    // activation window
    if (f.activeFrom && now < new Date(f.activeFrom).getTime()) continue;
    if (f.activeTo && now > new Date(f.activeTo).getTime()) continue;
    // segment targeting (simple contains-any)
    if (Array.isArray(f.segments) && f.segments.length && Array.isArray(segments) && !segments.some(s => f.segments.includes(s))) continue;

    const fenceKey = `${deviceId}:${String(f._id)}`;
    let isInside = false;
    if (f.type === 'polygon' && f.polygon) {
      try {
        isInside = turf.booleanPointInPolygon(turf.point([lon, lat]), f.polygon);
      } catch {}
    } else {
      const dist = distanceMeters(lat, lon, f.center.coordinates[1], f.center.coordinates[0]);
      // dynamic radius expansion under poor accuracy, min threshold 10m
      const effectiveRadius = f.radius + Math.max(accuracy || 0, 10);
      isInside = dist <= effectiveRadius;
    }

    const prev = lastState[fenceKey] || { inside: false, pendingFlip: null, pendingSince: null, lastTransitionAt: undefined };

    const dwellMs = 3000; // require 3s stable before transition
    const minAccuracy = 120; // ignore only very poor fixes
    if (accuracy > minAccuracy) continue;

    if (isInside !== prev.inside) {
      // start or continue pending
      const pendingSince = prev.pendingFlip === isInside && prev.pendingSince ? prev.pendingSince : now;
      const pendingFor = now - pendingSince;
      if (pendingFor >= dwellMs) {
        // dedupe: avoid duplicate same transition within 60s
        const lastAt = prev.lastTransitionAt || 0;
        if (now - lastAt < 60000) {
          lastState[fenceKey] = { inside: isInside, pendingFlip: null, pendingSince: null, lastTransitionAt: lastAt };
          continue;
        }
        lastState[fenceKey] = { inside: isInside, pendingFlip: null, pendingSince: null, lastTransitionAt: now };
        const ev = await EventLog.create({
          deviceId, fenceId: f._id, transition: isInside ? 'enter' : 'exit',
          location: locationPoint, accuracy, ts: new Date(now)
        });
        createdEvents.push(ev);

        const subDoc = await Subscription.findOne({ deviceId });
        if (subDoc && subDoc.subscription) {
          await sendPush(subDoc.subscription, {
            title: `${isInside ? 'Entered' : 'Exited'} ${f.name}`,
            body: f.message || `You ${isInside ? 'entered' : 'left'} "${f.name}"`,
            data: { fenceId: String(f._id), transition: isInside ? 'enter' : 'exit' }
          });
          // increment metrics
          try { const app = req.app; const m = app && app.get ? app.get('metrics') : null; if (m) m.alerts++; } catch {}
        }
      } else {
        lastState[fenceKey] = { ...prev, pendingFlip: isInside, pendingSince };
      }
    } else {
      lastState[fenceKey] = { inside: isInside, pendingFlip: null, pendingSince: null, lastTransitionAt: prev.lastTransitionAt };
    }
  }

  res.json({ ok: true, events: createdEvents.length });
});

export default router;
