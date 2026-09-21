import { Request, Response, NextFunction } from 'express';

export function requireUserMatch(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const param = (req.params as any)[paramName] || (req.body as any)[paramName];
    if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    if (!param) return res.status(400).json({ success: false, error: { code: 'MISSING_PARAM', message: `Missing ${paramName}` } });
    if (String(user._id) !== String(param)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    next();
  };
}
