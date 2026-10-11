import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenUserPayload } from '../lib/crypto.js';
import { User } from '../models/User.js';
import { AppServerError } from '../errors.js';

export interface AuthenticatedUser extends TokenUserPayload {
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userId?: string;
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw AppServerError.unauthorized('Missing authorization token');
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.userId) {
      throw AppServerError.unauthorized('Invalid or expired authorization token');
    }

    const user = await User.findById(payload.userId).select('status email username');
    if (!user || user.status !== 'active') {
      throw AppServerError.unauthorized('User not found or account inactive');
    }

    req.user = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    };
    req.userId = user._id.toString();

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    const payload = verifyAccessToken(token);
    if (payload && payload.userId) {
      const user = await User.findById(payload.userId).select('status email username');
      if (user && user.status === 'active') {
        req.user = {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
        };
        req.userId = user._id.toString();
      }
    }
    next();
  } catch {
    next();
  }
}

