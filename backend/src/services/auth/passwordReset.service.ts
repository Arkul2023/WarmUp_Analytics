import { PasswordResetToken } from '../../models/PasswordResetToken';
import { hashToken, generateRandomToken } from '../../utils/crypto';
import mongoose from 'mongoose';

export async function createPasswordResetToken(userId: mongoose.Types.ObjectId, ttlHours = 2) {
  const raw = generateRandomToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await PasswordResetToken.create({ userId, tokenHash, expiresAt });
  return raw;
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const token = await PasswordResetToken.findOne({ tokenHash });
  if (!token) return null;
  if (token.usedAt) return null;
  if (token.expiresAt.getTime() < Date.now()) return null;
  token.usedAt = new Date();
  await token.save();
  return token;
}
