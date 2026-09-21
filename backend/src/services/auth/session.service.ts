import { Session } from '../../models/session';
import crypto from 'crypto';
import { hashToken } from '../../utils/crypto';
import mongoose from 'mongoose';

export async function createSession(userId: mongoose.Types.ObjectId, opts?: { ttlDays?: number; ip?: string; userAgent?: string }) {
  const ttlDays = opts?.ttlDays ?? 7;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const session = await Session.create({ userId, sessionTokenHash: tokenHash, expiresAt, ipAddress: opts?.ip, userAgent: opts?.userAgent });

  return { rawToken, session };
}

export async function validateSessionToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const session = await Session.findOne({ sessionTokenHash: tokenHash }).populate('userId');
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function revokeSession(sessionId: mongoose.Types.ObjectId) {
  return Session.findByIdAndUpdate(sessionId, { revokedAt: new Date() });
}

export async function revokeAllSessionsForUser(userId: mongoose.Types.ObjectId) {
  return Session.updateMany({ userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
}
