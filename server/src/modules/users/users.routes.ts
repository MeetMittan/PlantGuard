import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  User,
  Plant,
  CareTask,
  CareCompletion,
  Observation,
  SavedPlace,
  UserConnection,
  ConnectionRequest,
  ObservationShare,
  Notification,
  AuthSession,
} from '../../models/index.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';
import { logger } from '../../lib/logger.js';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).trim().optional(),
  bio: z.string().max(250).trim().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  privacySettings: z
    .object({
      isPublic: z.boolean().optional(),
      shareObservations: z.boolean().optional(),
      shareLocations: z.boolean().optional(),
    })
    .optional(),
});

// 1. GET /api/v1/users/profile
router.get('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      throw AppServerError.notFound('User not found');
    }
    return res.json({ success: true, data: user.toJSON() });
  } catch (err) {
    next(err);
  }
});

// 2. PATCH /api/v1/users/profile
router.patch(
  '/profile',
  requireAuth,
  validate({ body: updateProfileSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        throw AppServerError.notFound('User not found');
      }

      const { displayName, bio, avatarUrl, privacySettings } = req.body;
      if (displayName !== undefined) user.displayName = displayName;
      if (bio !== undefined) user.bio = bio;
      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
      if (privacySettings !== undefined) {
        user.privacySettings = { ...user.privacySettings, ...privacySettings };
      }

      await user.save();
      return res.json({ success: true, data: user.toJSON() });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/users/search?q=query
router.get('/search', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query || query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(query, 'i');
    const users = await User.find({
      _id: { $ne: req.userId },
      status: 'active',
      $or: [{ username: regex }, { displayName: regex }],
    })
      .select('username displayName avatarUrl bio privacySettings')
      .limit(20);

    return res.json({
      success: true,
      data: users.map((u) => u.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/v1/users/:id
router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid user ID');
    }

    const targetUser = await User.findById(id).select(
      'username displayName bio avatarUrl privacySettings createdAt',
    );
    if (!targetUser) {
      throw AppServerError.notFound('User not found');
    }

    // Check relationship if viewer is logged in
    let connectionStatus: 'none' | 'connected' | 'blocked' = 'none';
    if (req.userId && req.userId !== id) {
      const strA = req.userId < id ? req.userId : id;
      const strB = req.userId < id ? id : req.userId;
      const conn = await UserConnection.findOne({
        user1Id: new mongoose.Types.ObjectId(strA),
        user2Id: new mongoose.Types.ObjectId(strB),
      });
      if (conn) {
        connectionStatus = conn.status;
      }
    }

    return res.json({
      success: true,
      data: {
        ...targetUser.toJSON(),
        connectionStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. DELETE /api/v1/users/account
router.delete('/account', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    // Cascading deletion
    await Promise.all([
      Plant.deleteMany({ ownerId: userId }),
      CareTask.deleteMany({ ownerId: userId }),
      CareCompletion.deleteMany({ ownerId: userId }),
      Observation.deleteMany({ ownerId: userId }),
      SavedPlace.deleteMany({ ownerId: userId }),
      UserConnection.deleteMany({ $or: [{ user1Id: userId }, { user2Id: userId }] }),
      ConnectionRequest.deleteMany({ $or: [{ requesterId: userId }, { recipientId: userId }] }),
      ObservationShare.deleteMany({ $or: [{ ownerId: userId }, { recipientId: userId }] }),
      Notification.deleteMany({ $or: [{ recipientId: userId }, { senderId: userId }] }),
      AuthSession.deleteMany({ userId }),
      User.deleteOne({ _id: userId }),
    ]);

    logger.info({ userId: req.userId }, 'User account deleted with cascading cleanup');

    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });

    return res.json({
      success: true,
      message: 'Account and associated data deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

export const usersRouter = router;

