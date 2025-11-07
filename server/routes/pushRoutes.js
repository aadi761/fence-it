import express from 'express';
import Subscription from '../models/Subscription.js';
import { sendPush } from '../utils/pushUtils.js';
const router = express.Router();

router.post('/subscribe', async (req, res) => {
  const { deviceId, subscription } = req.body;
  if (!deviceId || !subscription) return res.status(400).json({ error: 'missing fields' });
  await Subscription.updateOne({ deviceId }, { deviceId, subscription }, { upsert: true });
  res.json({ ok: true });
});

export default router;

// Custom push to a specific deviceId
router.post('/custom', async (req, res) => {
  const { deviceId, title, body, data } = req.body || {};
  if (!deviceId || !title) return res.status(400).json({ error: 'deviceId and title are required' });
  const subDoc = await Subscription.findOne({ deviceId });
  if (!subDoc || !subDoc.subscription) return res.status(404).json({ error: 'subscription not found' });
  const ok = await sendPush(subDoc.subscription, { title, body: body || '', data: data || {} });
  res.json({ ok });
});
