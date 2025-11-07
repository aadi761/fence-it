import webpush from 'web-push';
import { VAPID } from '../config/vapidKeys.js';

// configure web-push with VAPID
webpush.setVapidDetails(VAPID.subject, VAPID.publicKey, VAPID.privateKey);

export async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('sendPush error', err);
    return false;
  }
}
