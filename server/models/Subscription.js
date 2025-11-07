import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  deviceId: String,
  subscription: Object
});

export default mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
