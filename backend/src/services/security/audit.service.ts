import { SecurityEvent } from '../../models/SecurityEvent';

export async function recordSecurityEvent(params: { userId?: any; eventType: any; ipAddress?: string; userAgent?: string; metadata?: any }) {
  try {
    await SecurityEvent.create({ userId: params.userId, eventType: params.eventType, ipAddress: params.ipAddress, userAgent: params.userAgent, metadata: params.metadata });
  } catch (err) {
    console.error('Failed to record security event', err);
  }
}
