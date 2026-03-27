import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export default async function connectDB() {
  const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/geofence_demo';
  await mongoose.connect(MONGO);
  console.log('MongoDB connected');
}
