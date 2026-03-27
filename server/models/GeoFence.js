import mongoose from 'mongoose';

const fenceSchema = new mongoose.Schema({
  name: String,
  message: { type: String, default: '' },
  // type: 'circle' | 'polygon'
  type: { type: String, enum: ['circle', 'polygon'], default: 'circle' },
  center: { type: { type: String, default: 'Point' }, coordinates: [Number] }, // for circle: [lon, lat]
  radius: Number,
  // for polygon: GeoJSON Polygon
  polygon: { type: Object, default: null },
  // activation window
  activeFrom: { type: Date, default: null },
  activeTo: { type: Date, default: null },
  // targeting
  segments: { type: [String], default: [] },
  priority: { type: Number, default: 0 },
  createdAt: Date
});
fenceSchema.index({ center: '2dsphere' });

export default mongoose.models.GeoFence || mongoose.model('GeoFence', fenceSchema);
