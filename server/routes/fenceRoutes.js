import express from 'express';
import GeoFence from '../models/GeoFence.js';
import EventLog from '../models/EventLog.js';
import Subscription from '../models/Subscription.js';
import { sendPush } from '../utils/pushUtils.js';
import { distanceMeters } from '../utils/geoUtils.js';
import * as turf from '@turf/turf';
const router = express.Router();

router.post('/', async (req, res) => {
  const { name, message = '', type = 'circle', lat, lon, radius, polygon, activeFrom, activeTo, segments = [], priority = 0, demo = false, deviceId, currentLat, currentLon } = req.body;
  if (!name) return res.status(400).json({ error: 'missing name' });
  if (type === 'circle' && (lat == null || lon == null || !radius)) return res.status(400).json({ error: 'missing circle fields' });
  if (type === 'polygon' && !polygon) return res.status(400).json({ error: 'missing polygon' });
  const doc = {
    name, message, type, priority, segments,
    center: lat != null && lon != null ? { type: 'Point', coordinates: [lon, lat] } : undefined,
    radius, polygon: polygon || null,
    activeFrom: activeFrom ? new Date(activeFrom) : null,
    activeTo: activeTo ? new Date(activeTo) : null,
    createdAt: new Date()
  };
  const f = await GeoFence.create(doc);

  // Immediate evaluate if requested (demo mode) and coordinates provided
  let insideNow = false;
  let demoTriggerId = null;
  if (demo && deviceId && (currentLat != null && currentLon != null)) {
    try {
      if (type === 'polygon' && polygon) {
        insideNow = turf.booleanPointInPolygon(turf.point([currentLon, currentLat]), polygon);
      } else {
        const dist = distanceMeters(currentLat, currentLon, lat, lon);
        insideNow = dist <= radius;
      }
      if (insideNow) {
        demoTriggerId = Math.random().toString(36).slice(2, 10);
        await EventLog.create({ deviceId, fenceId: f._id, transition: 'enter', location: { type: 'Point', coordinates: [currentLon, currentLat] }, accuracy: 0, ts: new Date() });
        const subDoc = await Subscription.findOne({ deviceId });
        if (subDoc && subDoc.subscription) {
          await sendPush(subDoc.subscription, {
            source: 'push',
            title: `Entered ${f.name}`,
            body: f.message || `You entered "${f.name}"`,
            data: { fenceId: String(f._id), fenceName: f.name, transition: 'enter', demoTriggerId }
          });
        }
      }
    } catch {}
  }

  res.json({ fence: f, insideNow, demoTriggerId });
});

router.get('/', async (req, res) => {
  const fences = await GeoFence.find({}).sort({ createdAt: -1 });
  res.json(fences);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await GeoFence.deleteOne({ _id: id });
  res.json({ ok: true });
});

export default router;

// Test notification endpoint
router.post('/:id/test', async (req, res) => {
  const { id } = req.params;
  const { deviceId } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  const fence = await GeoFence.findById(id);
  if (!fence) return res.status(404).json({ error: 'fence not found' });
  const subDoc = await Subscription.findOne({ deviceId });
  if (subDoc && subDoc.subscription) {
    await sendPush(subDoc.subscription, {
      source: 'push',
      title: `Test: ${fence.name}`,
      body: fence.message || 'Test notification',
      data: { fenceId: id, fenceName: fence.name, transition: 'test' }
    });
  }
  res.json({ ok: true });
});
