import express from 'express';
import EventLog from '../models/EventLog.js';
import GeoFence from '../models/GeoFence.js';
const router = express.Router();

router.get('/', async (req, res) => {
  const ev = await EventLog.find({}).sort({ ts: -1 }).limit(100);
  const fenceIds = [...new Set(ev.map(e => String(e.fenceId)))];
  const fences = await GeoFence.find({ _id: { $in: fenceIds } });
  const fenceMap = Object.fromEntries(fences.map(f => [String(f._id), f.name]));
  const out = ev.map(e => ({ ...e.toObject(), fenceName: fenceMap[String(e.fenceId)] || 'unknown' }));
  res.json(out);
});

// Export all events for a device
router.get('/device/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const ev = await EventLog.find({ deviceId }).sort({ ts: -1 });
  res.json(ev);
});

// Delete all data for a device
router.delete('/device/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  await EventLog.deleteMany({ deviceId });
  res.json({ ok: true });
});

export default router;
