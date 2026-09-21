import { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '../services/auth/session.service';
import User from '../models/User';

export async function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  const auth = req.get('authorization') || '';
  const parts = auth.split(' ');
  const token = parts.length === 2 ? parts[1] : null;
  if (!token) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  const session: any = await validateSessionToken(token);
  if (!session) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } });
  // attach user and session
  const user = await User.findById((session.userId as any)?._id || session.userId);
  if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
  req.user = user;
  req.session = session;
  next();
}

export interface AuthRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // reuse ensureAuthenticated then map to older userId property
  await ensureAuthenticated(req as Request, res, (err?: any) => {
    if (err) return next(err);
    req.userId = (req as any).user?._id;
    next();
  });
}
