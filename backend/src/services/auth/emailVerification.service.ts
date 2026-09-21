import { EmailVerificationToken } from '../../models/EmailVerificationToken';
import { hashToken, generateRandomToken } from '../../utils/crypto';
import mongoose from 'mongoose';

export async function createEmailVerificationToken(userId: mongoose.Types.ObjectId, ttlHours = 24) {
  const raw = generateRandomToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await EmailVerificationToken.create({ userId, tokenHash, expiresAt });
  return raw;
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const token = await EmailVerificationToken.findOne({ tokenHash });
  if (!token) return null;
  if (token.usedAt) return null;
  if (token.expiresAt.getTime() < Date.now()) return null;
  token.usedAt = new Date();
  await token.save();
  return token;
}
