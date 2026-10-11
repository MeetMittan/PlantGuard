import { Router, type Request, type Response, type NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppServerError } from '../../errors.js';

const router = Router();

router.use(requireAuth);

// 1. GET /api/v1/notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await Notification.find({ recipientId: req.userId })
      .populate('senderId', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      data: notifications.map((n) => n.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/v1/notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.userId,
      isRead: false,
    });

    return res.json({
      success: true,
      data: { count },
    });
  } catch (err) {
    next(err);
  }
});

// 3. PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid notification ID');
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: req.userId },
      { $set: { isRead: true } },
      { new: true },
    );

    if (!notification) {
      throw AppServerError.notFound('Notification not found');
    }

    return res.json({
      success: true,
      data: notification.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// 4. POST /api/v1/notifications/mark-all-read
router.post('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await Notification.updateMany(
      { recipientId: req.userId, isRead: false },
      { $set: { isRead: true } },
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
});

// 5. DELETE /api/v1/notifications/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid notification ID');
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipientId: req.userId,
    });

    if (!notification) {
      throw AppServerError.notFound('Notification not found');
    }

    return res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (err) {
    next(err);
  }
});

export const notificationsRouter = router;

