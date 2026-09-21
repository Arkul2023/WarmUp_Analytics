import { Request, Response } from 'express';
import User from '../models/User';
import { hashPassword, verifyPassword } from '../services/auth/password.service';
import { createSession, validateSessionToken, revokeSession, revokeAllSessionsForUser } from '../services/auth/session.service';
import { createEmailVerificationToken, consumeEmailVerificationToken } from '../services/auth/emailVerification.service';
import { createPasswordResetToken, consumePasswordResetToken } from '../services/auth/passwordReset.service';
import { sendEmail } from '../integrations/email/emailProvider';
import { recordSecurityEvent } from '../services/security/audit.service';
import { apiError, apiSuccess } from '../utils/errors';
import mongoose from 'mongoose';

export async function signup(req: Request, res: Response) {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !email || !password) return res.status(400).json(apiError('MISSING_FIELDS', 'Missing required fields'));
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) return res.status(409).json(apiError('EMAIL_EXISTS', 'Email already in use'));

  const password_hash = await hashPassword(password);
  const user = await User.create({ firstName, lastName, email: normalizedEmail, password_hash });

  // create verification token and send email
  const rawToken = await createEmailVerificationToken(user._id as any);
  const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
  await sendEmail({ to: normalizedEmail, subject: 'Verify your email', text: `Verify: ${verifyUrl}` });

  await recordSecurityEvent({ userId: user._id, eventType: 'SIGNUP', ipAddress: req.ip, userAgent: req.get('user-agent') });

  res.json(apiSuccess({ message: 'Signup successful, check your email for verification' }));
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) return res.status(400).json(apiError('MISSING_TOKEN', 'Missing token'));
  const consumed = await consumeEmailVerificationToken(token);
  if (!consumed) return res.status(400).json(apiError('INVALID_TOKEN', 'Invalid or expired token'));
  const user = await User.findById(consumed.userId);
  if (!user) return res.status(404).json(apiError('USER_NOT_FOUND', 'User not found'));
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();
  await recordSecurityEvent({ userId: user._id, eventType: 'EMAIL_VERIFIED', ipAddress: req.ip, userAgent: req.get('user-agent') });
  res.json(apiSuccess({ message: 'Email verified' }));
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json(apiError('MISSING_FIELDS', 'Missing required fields'));
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    await recordSecurityEvent({ eventType: 'LOGIN_FAILED', ipAddress: req.ip, userAgent: req.get('user-agent'), metadata: { email: normalizedEmail } });
    return res.status(401).json(apiError('INVALID_CREDENTIALS', 'Invalid email or password'));
  }
  if (user.status !== 'active') return res.status(403).json(apiError('ACCOUNT_INACTIVE', 'Account is not active'));
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await recordSecurityEvent({ userId: user._id, eventType: 'LOGIN_FAILED', ipAddress: req.ip, userAgent: req.get('user-agent') });
    return res.status(401).json(apiError('INVALID_CREDENTIALS', 'Invalid email or password'));
  }
  if (!user.emailVerified) {
    return res.status(403).json(apiError('EMAIL_NOT_VERIFIED', 'Email address not verified'));
  }

  const { rawToken, session } = await createSession(user._id as any, { ip: req.ip, userAgent: req.get('user-agent') });
  user.lastLoginAt = new Date();
  await user.save();
  await recordSecurityEvent({ userId: user._id, eventType: 'LOGIN_SUCCESS', ipAddress: req.ip, userAgent: req.get('user-agent') });

  res.json(apiSuccess({ token: rawToken, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, emailVerified: !!user.emailVerified, role: user.role, status: user.status } }));
}

export async function logout(req: Request, res: Response) {
  const auth = req.get('authorization') || '';
  const parts = auth.split(' ');
  const token = parts.length === 2 ? parts[1] : null;
  if (!token) return res.status(401).json(apiError('UNAUTHORIZED', 'No token'));
  const session = await validateSessionToken(token);
  if (!session) return res.status(401).json(apiError('UNAUTHORIZED', 'Invalid session'));
  await revokeSession(session._id as any);
  await recordSecurityEvent({ userId: (session.userId as any)?._id || session.userId, eventType: 'LOGOUT', ipAddress: req.ip, userAgent: req.get('user-agent') });
  res.json(apiSuccess({ message: 'Logged out' }));
}

export async function logoutAll(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  await revokeAllSessionsForUser(user._id);
  await recordSecurityEvent({ userId: user._id, eventType: 'LOGOUT_ALL', ipAddress: req.ip, userAgent: req.get('user-agent') });
  res.json(apiSuccess({ message: 'All sessions revoked' }));
}

export async function me(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  res.json(apiSuccess({ user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, emailVerified: !!user.emailVerified, role: user.role, status: user.status } }));
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) return res.status(400).json(apiError('MISSING_FIELDS', 'Missing email'));
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  // Always respond with generic message
  if (user) {
    const raw = await createPasswordResetToken(user._id as any);
    const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/reset-password?token=${raw}`;
    await sendEmail({ to: normalizedEmail, subject: 'Password reset', text: `Reset: ${resetUrl}` });
    await recordSecurityEvent({ userId: user._id, eventType: 'PASSWORD_RESET_REQUESTED', ipAddress: req.ip, userAgent: req.get('user-agent') });
  }
  res.json(apiSuccess({ message: 'If an account exists, a password reset email has been sent' }));
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json(apiError('MISSING_FIELDS', 'Missing token or password'));
  const consumed = await consumePasswordResetToken(token);
  if (!consumed) return res.status(400).json(apiError('INVALID_TOKEN', 'Invalid or expired token'));
  const user = await User.findById(consumed.userId);
  if (!user) return res.status(404).json(apiError('USER_NOT_FOUND', 'User not found'));
  user.password_hash = await hashPassword(password);
  await user.save();
  // revoke all sessions
  await revokeAllSessionsForUser(user._id as any);
  await recordSecurityEvent({ userId: user._id, eventType: 'PASSWORD_RESET_COMPLETED', ipAddress: req.ip, userAgent: req.get('user-agent') });
  res.json(apiSuccess({ message: 'Password updated' }));
}

export async function changePassword(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json(apiError('UNAUTHORIZED', 'Not authenticated'));
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json(apiError('MISSING_FIELDS', 'Missing fields'));
  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json(apiError('INVALID_CREDENTIALS', 'Current password incorrect'));
  const same = await verifyPassword(newPassword, user.password_hash);
  if (same) return res.status(400).json(apiError('INVALID_PASSWORD', 'New password must be different'));
  user.password_hash = await hashPassword(newPassword);
  await user.save();
  await revokeAllSessionsForUser(user._id as any);
  await recordSecurityEvent({ userId: user._id, eventType: 'PASSWORD_CHANGED', ipAddress: req.ip, userAgent: req.get('user-agent') });
  res.json(apiSuccess({ message: 'Password changed' }));
}
