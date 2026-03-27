import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  deviceId: String,
  fenceId: mongoose.Types.ObjectId,
  transition: String,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  accuracy: Number,
  ts: Date
});
eventSchema.index({ location: '2dsphere' });

export default mongoose.models.EventLog || mongoose.model('EventLog', eventSchema);
