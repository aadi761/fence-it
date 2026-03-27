import dotenv from 'dotenv';
dotenv.config();

export const VAPID = {
  publicKey: process.env.VAPID_PUBLIC || '',
  privateKey: process.env.VAPID_PRIVATE || '',
  subject: process.env.VAPID_SUBJECT || 'mailto:you@example.com'
};
