import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { User, AuthSession, PasswordResetToken } from '../../models/index.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateRandomToken,
} from '../../lib/crypto.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rate-limiter.js';
import { AppServerError } from '../../errors.js';
import { env } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

const router = Router();

// Validation Schemas
const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, hyphens, and underscores')
    .transform((v) => v.toLowerCase().trim()),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100),
  displayName: z.string().min(1).max(50).trim(),
});

const loginSchema = z.object({
  login: z.string().min(1).trim(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

// Helper to set auth cookies and return token response
function setAuthCookiesAndRespond(
  res: Response,
  accessToken: string,
  refreshToken: string,
  user: any,
) {
  const isProduction = env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/v1/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        privacySettings: user.privacySettings,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
      },
    },
  });
}

// 1. POST /register
router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, displayName } = req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });
      if (existingUser) {
        if (existingUser.email === email) {
          throw AppServerError.conflict('An account with this email address already exists');
        }
        throw AppServerError.conflict('This username is already taken');
      }

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        username,
        email,
        passwordHash,
        displayName,
        privacySettings: {
          isPublic: true,
          shareObservations: true,
          shareLocations: false,
        },
      });

      // Create session
      const session = await AuthSession.create({
        userId: user._id,
        tokenHash: 'initial-pending',
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        username: user.username,
      });

      const refreshToken = generateRefreshToken({
        userId: user._id.toString(),
        sessionId: session._id.toString(),
      });

      session.tokenHash = hashToken(refreshToken);
      await session.save();

      logger.info({ userId: user._id.toString() }, 'New user registered');
      return setAuthCookiesAndRespond(res, accessToken, refreshToken, user);
    } catch (err) {
      next(err);
    }
  },
);

// 2. POST /login
router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { login, password } = req.body;
      const lowerLogin = login.toLowerCase();

      const user = await User.findOne({
        $or: [{ email: lowerLogin }, { username: lowerLogin }],
      });

      if (!user) {
        throw AppServerError.unauthorized('Invalid username/email or password');
      }

      if (user.status !== 'active') {
        throw AppServerError.forbidden('Account has been suspended. Please contact support.');
      }

      const isValidPassword = await verifyPassword(user.passwordHash, password);
      if (!isValidPassword) {
        throw AppServerError.unauthorized('Invalid username/email or password');
      }

      // Create session
      const session = await AuthSession.create({
        userId: user._id,
        tokenHash: 'pending',
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        username: user.username,
      });

      const refreshToken = generateRefreshToken({
        userId: user._id.toString(),
        sessionId: session._id.toString(),
      });

      session.tokenHash = hashToken(refreshToken);
      await session.save();

      logger.info({ userId: user._id.toString() }, 'User logged in successfully');
      return setAuthCookiesAndRespond(res, accessToken, refreshToken, user);
    } catch (err) {
      next(err);
    }
  },
);

// 3. POST /refresh
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incomingRefreshToken =
        req.body?.refreshToken || req.cookies?.refresh_token;

      if (!incomingRefreshToken) {
        throw AppServerError.unauthorized('Missing refresh token');
      }

      const decoded = verifyRefreshToken(incomingRefreshToken);
      if (!decoded || !decoded.sessionId || !decoded.userId) {
        throw AppServerError.unauthorized('Invalid or expired refresh token');
      }

      const hashedIncoming = hashToken(incomingRefreshToken);
      const session = await AuthSession.findOne({
        _id: decoded.sessionId,
        userId: decoded.userId,
        tokenHash: hashedIncoming,
      });

      if (!session) {
        throw AppServerError.unauthorized('Session revoked or invalid');
      }

      if (session.expiresAt < new Date()) {
        await AuthSession.deleteOne({ _id: session._id });
        throw AppServerError.unauthorized('Session expired');
      }

      const user = await User.findById(decoded.userId);
      if (!user || user.status !== 'active') {
        throw AppServerError.unauthorized('User not found or inactive');
      }

      // Rotate tokens
      const newAccessToken = generateAccessToken({
        userId: user._id.toString(),
        username: user.username,
      });

      const newRefreshToken = generateRefreshToken({
        userId: user._id.toString(),
        sessionId: session._id.toString(),
      });

      session.tokenHash = hashToken(newRefreshToken);
      session.lastUsedAt = new Date();
      await session.save();

      return setAuthCookiesAndRespond(res, newAccessToken, newRefreshToken, user);
    } catch (err) {
      next(err);
    }
  },
);

// 4. POST /logout
router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incomingRefreshToken =
        req.body?.refreshToken || req.cookies?.refresh_token;

      if (incomingRefreshToken) {
        const hashedIncoming = hashToken(incomingRefreshToken);
        await AuthSession.deleteMany({ tokenHash: hashedIncoming });
      }

      res.clearCookie('access_token');
      res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });

      return res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// 5. GET /me
router.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        throw AppServerError.notFound('User not found');
      }
      return res.json({
        success: true,
        data: user.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 6. POST /change-password
router.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.userId);
      if (!user) {
        throw AppServerError.notFound('User not found');
      }

      const isValid = await verifyPassword(user.passwordHash, currentPassword);
      if (!isValid) {
        throw AppServerError.badRequest('Current password is incorrect');
      }

      user.passwordHash = await hashPassword(newPassword);
      await user.save();

      // Revoke all other active sessions for security
      await AuthSession.deleteMany({ userId: user._id });

      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  },
);

// 7. POST /forgot-password
router.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      if (user) {
        const resetToken = generateRandomToken(32);
        const tokenHash = hashToken(resetToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await PasswordResetToken.create({
          userId: user._id,
          tokenHash,
          expiresAt,
        });

        logger.info(
          { userId: user._id.toString(), email },
          `Password reset requested (simulation token generated)`,
        );
      }

      // Always return positive response to prevent user enumeration
      return res.json({
        success: true,
        message: 'If that email exists in our records, password reset instructions have been dispatched.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// 8. POST /reset-password
router.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;
      const tokenHash = hashToken(token);

      const record = await PasswordResetToken.findOne({
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      });

      if (!record) {
        throw AppServerError.badRequest('Invalid or expired password reset token');
      }

      const user = await User.findById(record.userId);
      if (!user) {
        throw AppServerError.notFound('User not found');
      }

      user.passwordHash = await hashPassword(newPassword);
      await user.save();

      record.usedAt = new Date();
      await record.save();

      // Invalidate all active sessions
      await AuthSession.deleteMany({ userId: user._id });

      return res.json({
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.',
      });
    } catch (err) {
      next(err);
    }
  },
);

export const authRouter = router;
