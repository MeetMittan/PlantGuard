import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  Observation,
  ObservationShare,
  UserConnection,
  Notification,
  User,
  getCanonicalPair,
} from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const shareObservationSchema = z.object({
  recipientId: z.string().min(1),
  notes: z.string().max(500).optional(),
  canComment: z.boolean().default(false),
});

router.use(requireAuth);

// 1. POST /api/v1/sharing/observations/:id (Share observation with a connection)
router.post(
  '/observations/:id',
  validate({ body: shareObservationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { recipientId, notes, canComment } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(recipientId)) {
        throw AppServerError.badRequest('Invalid observation or recipient ID');
      }

      const observation = await Observation.findOne({ _id: id, ownerId: req.userId });
      if (!observation) {
        throw AppServerError.notFound('Observation not found');
      }

      // Verify mutual connection
      const pair = getCanonicalPair(req.userId!, recipientId);
      const conn = await UserConnection.findOne({ ...pair, status: 'connected' });
      if (!conn) {
        throw AppServerError.forbidden('You can only share observations with connected friends');
      }

      const share = await ObservationShare.findOneAndUpdate(
        {
          observationId: id,
          recipientId,
        },
        {
          $set: {
            ownerId: req.userId,
            notes: notes || '',
            canComment,
            revokedAt: null,
          },
        },
        { upsert: true, new: true },
      );

      // Notify recipient
      const sender = await User.findById(req.userId).select('displayName');
      await Notification.create({
        recipientId,
        senderId: req.userId,
        type: 'observation_shared',
        title: 'Observation Shared',
        message: `${sender?.displayName || 'A friend'} shared a plant observation with you!`,
        data: { observationId: id },
      });

      return res.status(201).json({
        success: true,
        data: share.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 2. DELETE /api/v1/sharing/observations/:id/recipients/:recipientId (Revoke share)
router.delete(
  '/observations/:id/recipients/:recipientId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, recipientId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(recipientId)) {
        throw AppServerError.badRequest('Invalid observation or recipient ID');
      }

      const share = await ObservationShare.findOneAndUpdate(
        {
          observationId: id,
          ownerId: req.userId,
          recipientId,
        },
        { $set: { revokedAt: new Date() } },
        { new: true },
      );

      if (!share) {
        throw AppServerError.notFound('Active share not found');
      }

      return res.json({
        success: true,
        message: 'Observation share revoked successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/sharing/received (Feed of observations shared with current user)
router.get('/received', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shares = await ObservationShare.find({
      recipientId: req.userId,
      revokedAt: null,
    })
      .populate({
        path: 'observationId',
        populate: { path: 'ownerId', select: 'username displayName avatarUrl' },
      })
      .sort({ createdAt: -1 });

    const validShares = shares.filter((s) => s.observationId != null);

    return res.json({
      success: true,
      data: validShares.map((s) => ({
        id: s._id,
        notes: s.notes,
        canComment: s.canComment,
        sharedAt: s.createdAt,
        observation: s.observationId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/v1/sharing/sent (List of shares initiated by current user)
router.get('/sent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shares = await ObservationShare.find({
      ownerId: req.userId,
      revokedAt: null,
    })
      .populate('recipientId', 'username displayName avatarUrl')
      .populate('observationId')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: shares.map((s) => s.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

export const sharingRouter = router;

