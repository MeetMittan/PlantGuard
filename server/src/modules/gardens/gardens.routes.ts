import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SharedGarden, SharedGardenMembership, Plant } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const createGardenSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(1000).trim().optional(),
  plantIds: z.array(z.string()).default([]),
});

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['viewer', 'contributor', 'admin']).default('viewer'),
});

router.use(requireAuth);

// 1. GET /api/v1/gardens
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);
    const memberships = await SharedGardenMembership.find({ userId: userObjectId });
    const memberGardenIds = memberships.map((m) => m.gardenId);

    const gardens = await SharedGarden.find({
      $or: [{ ownerId: userObjectId }, { _id: { $in: memberGardenIds } }],
    })
      .populate('plantIds', 'name species coverImageUrl')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: gardens.map((g) => g.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/v1/gardens
router.post(
  '/',
  validate({ body: createGardenSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const garden = await SharedGarden.create({
        ...req.body,
        ownerId: req.userId,
      });

      // Add owner as admin member
      await SharedGardenMembership.create({
        gardenId: garden._id,
        userId: req.userId,
        role: 'admin',
      });

      return res.status(201).json({
        success: true,
        data: garden.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/gardens/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid garden ID');
    }

    const garden = await SharedGarden.findById(id).populate('plantIds');
    if (!garden) {
      throw AppServerError.notFound('Shared garden not found');
    }

    const membership = await SharedGardenMembership.findOne({
      gardenId: id,
      userId: req.userId,
    });

    if (garden.ownerId.toString() !== req.userId && !membership) {
      throw AppServerError.forbidden('You do not have access to this shared garden');
    }

    const members = await SharedGardenMembership.find({ gardenId: id }).populate(
      'userId',
      'username displayName avatarUrl',
    );

    return res.json({
      success: true,
      data: {
        ...garden.toJSON(),
        members: members.map((m) => m.toJSON()),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. POST /api/v1/gardens/:id/members
router.post(
  '/:id/members',
  validate({ body: addMemberSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { userId, role } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
        throw AppServerError.badRequest('Invalid garden or user ID');
      }

      const garden = await SharedGarden.findOne({ _id: id, ownerId: req.userId });
      if (!garden) {
        throw AppServerError.forbidden('Only garden owner can manage members');
      }

      const membership = await SharedGardenMembership.findOneAndUpdate(
        { gardenId: id, userId },
        { $set: { role } },
        { upsert: true, new: true },
      );

      return res.status(201).json({
        success: true,
        data: membership.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 5. DELETE /api/v1/gardens/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid garden ID');
    }

    const garden = await SharedGarden.findOneAndDelete({ _id: id, ownerId: req.userId });
    if (!garden) {
      throw AppServerError.notFound('Shared garden not found or unauthorized');
    }

    await SharedGardenMembership.deleteMany({ gardenId: id });

    return res.json({
      success: true,
      message: 'Shared garden deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

export const gardensRouter = router;

