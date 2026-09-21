import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '60000', 10); // 1 minute
const MAX_REQUESTS = parseInt(process.env.RATE_MAX_REQUESTS || '10', 10);

const memory: Record<string, { count: number; resetAt: number }> = {};

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const key = String(req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  const entry = memory[key];
  if (!entry || entry.resetAt < now) {
    memory[key] = { count: 1, resetAt: now + WINDOW_MS };
    return next();
  }
  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } });
  }
  next();
}
