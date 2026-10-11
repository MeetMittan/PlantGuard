import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  User,
  UserConnection,
  ConnectionRequest,
  Notification,
  getCanonicalPair,
} from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const sendRequestSchema = z.object({
  recipientId: z.string().min(1),
  message: z.string().max(300).optional(),
});

router.use(requireAuth);

// 1. GET /api/v1/connections (list mutual connections)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.userId);
    const connections = await UserConnection.find({
      $or: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      status: 'connected',
    });

    const friendIds = connections.map((c) =>
      c.user1Id.equals(currentUserId) ? c.user2Id : c.user1Id,
    );

    const friends = await User.find({ _id: { $in: friendIds }, status: 'active' }).select(
      'username displayName avatarUrl bio privacySettings',
    );

    return res.json({
      success: true,
      data: friends.map((f) => f.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/v1/connections/request (send request)
router.post(
  '/request',
  validate({ body: sendRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recipientId, message } = req.body;
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        throw AppServerError.badRequest('Invalid recipient ID');
      }

      if (recipientId === req.userId) {
        throw AppServerError.badRequest('You cannot send a connection request to yourself');
      }

      const recipient = await User.findById(recipientId);
      if (!recipient || recipient.status !== 'active') {
        throw AppServerError.notFound('Recipient user not found');
      }

      // Check for existing block
      const pair = getCanonicalPair(req.userId!, recipientId);
      const existingConn = await UserConnection.findOne(pair);
      if (existingConn) {
        if (existingConn.status === 'blocked') {
          throw AppServerError.forbidden('Cannot connect with this user');
        }
        if (existingConn.status === 'connected') {
          throw AppServerError.conflict('You are already connected with this user');
        }
      }

      // Check existing pending request
      const existingReq = await ConnectionRequest.findOne({
        requesterId: req.userId,
        recipientId,
        status: 'pending',
      });
      if (existingReq) {
        throw AppServerError.conflict('A connection request is already pending for this user');
      }

      const request = await ConnectionRequest.create({
        requesterId: req.userId,
        recipientId,
        message: message || '',
        status: 'pending',
      });

      // Send in-app notification to recipient
      const sender = await User.findById(req.userId).select('displayName');
      await Notification.create({
        recipientId,
        senderId: req.userId,
        type: 'connection_request',
        title: 'New Connection Request',
        message: `${sender?.displayName || 'A gardener'} wants to connect with you!`,
        data: { requestId: request._id },
      });

      return res.status(201).json({
        success: true,
        data: request.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/connections/requests/incoming
router.get('/requests/incoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requests = await ConnectionRequest.find({
      recipientId: req.userId,
      status: 'pending',
    })
      .populate('requesterId', 'username displayName avatarUrl bio')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: requests.map((r) => r.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET /api/v1/connections/requests/outgoing
router.get('/requests/outgoing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requests = await ConnectionRequest.find({
      requesterId: req.userId,
      status: 'pending',
    })
      .populate('recipientId', 'username displayName avatarUrl bio')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: requests.map((r) => r.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 5. POST /api/v1/connections/requests/:id/accept
router.post('/requests/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid request ID');
    }

    const request = await ConnectionRequest.findOne({
      _id: id,
      recipientId: req.userId,
      status: 'pending',
    });

    if (!request) {
      throw AppServerError.notFound('Pending connection request not found');
    }

    request.status = 'accepted';
    await request.save();

    // Establish mutual UserConnection
    const pair = getCanonicalPair(request.requesterId, request.recipientId);
    await UserConnection.findOneAndUpdate(
      pair,
      { ...pair, status: 'connected', blockedById: null },
      { upsert: true, new: true },
    );

    // Notify requester
    const recipientUser = await User.findById(req.userId).select('displayName');
    await Notification.create({
      recipientId: request.requesterId,
      senderId: req.userId,
      type: 'connection_accepted',
      title: 'Connection Accepted',
      message: `${recipientUser?.displayName || 'User'} accepted your connection request!`,
    });

    return res.json({
      success: true,
      message: 'Connection request accepted',
    });
  } catch (err) {
    next(err);
  }
});

// 6. POST /api/v1/connections/requests/:id/decline
router.post('/requests/:id/decline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid request ID');
    }

    const request = await ConnectionRequest.findOneAndUpdate(
      { _id: id, recipientId: req.userId, status: 'pending' },
      { $set: { status: 'declined' } },
      { new: true },
    );

    if (!request) {
      throw AppServerError.notFound('Pending connection request not found');
    }

    return res.json({
      success: true,
      message: 'Connection request declined',
    });
  } catch (err) {
    next(err);
  }
});

// 7. POST /api/v1/connections/requests/:id/cancel
router.post('/requests/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid request ID');
    }

    const request = await ConnectionRequest.findOneAndUpdate(
      { _id: id, requesterId: req.userId, status: 'pending' },
      { $set: { status: 'canceled' } },
      { new: true },
    );

    if (!request) {
      throw AppServerError.notFound('Pending connection request not found');
    }

    return res.json({
      success: true,
      message: 'Connection request canceled',
    });
  } catch (err) {
    next(err);
  }
});

// 8. POST /api/v1/connections/:id/block
router.post('/:id/block', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw AppServerError.badRequest('Invalid user ID');
    }

    const pair = getCanonicalPair(req.userId!, targetUserId);
    await UserConnection.findOneAndUpdate(
      pair,
      { ...pair, status: 'blocked', blockedById: new mongoose.Types.ObjectId(req.userId) },
      { upsert: true, new: true },
    );

    // Cancel any pending requests
    await ConnectionRequest.updateMany(
      {
        $or: [
          { requesterId: req.userId, recipientId: targetUserId },
          { requesterId: targetUserId, recipientId: req.userId },
        ],
        status: 'pending',
      },
      { $set: { status: 'declined' } },
    );

    return res.json({
      success: true,
      message: 'User blocked successfully',
    });
  } catch (err) {
    next(err);
  }
});

// 9. DELETE /api/v1/connections/:id (disconnect)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw AppServerError.badRequest('Invalid user ID');
    }

    const pair = getCanonicalPair(req.userId!, targetUserId);
    await UserConnection.findOneAndDelete({ ...pair, status: 'connected' });

    return res.json({
      success: true,
      message: 'Connection removed successfully',
    });
  } catch (err) {
    next(err);
  }
});

export const connectionsRouter = router;

