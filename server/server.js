import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import fenceRoutes from './routes/fenceRoutes.js';
import pushRoutes from './routes/pushRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import { VAPID } from './config/vapidKeys.js';

await connectDB();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Optional JWT auth: set JWT_SECRET in env to enforce; otherwise pass-through
import jwt from 'jsonwebtoken';
function optionalJwt(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return next();
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try { req.user = jwt.verify(token, secret); return next(); }
  catch { return res.status(401).json({ error: 'invalid token' }); }
}

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/fences', optionalJwt, fenceRoutes);
app.use('/api/push', optionalJwt, pushRoutes);
app.use('/api/location', optionalJwt, locationRoutes);
app.use('/api/events', optionalJwt, eventRoutes);

// Simple metrics
let metrics = { pings: 0, alerts: 0 };
app.set('metrics', metrics);
app.use((req, _res, next) => { if (req.path === '/api/location' && req.method === 'POST') metrics.pings++; next(); });
app.get('/api/metrics', optionalJwt, (_req, res) => res.json(metrics));

// Seed a Delhi fence if none exists
import GeoFence from './models/GeoFence.js';
async function ensureSeed() {
  const count = await GeoFence.countDocuments();
  if (count === 0) {
    await GeoFence.create({
      name: 'Delhi',
      message: 'You entered Delhi — High pollution area detected (AQI 312)',
      type: 'circle',
      center: { type: 'Point', coordinates: [77.2090, 28.6139] },
      radius: 1500,
      createdAt: new Date()
    });
    console.log('Seeded demo fence: Delhi');
  }
}
ensureSeed().catch(() => {});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
