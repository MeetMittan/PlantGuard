import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SavedPlace } from '../../models/index.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const createPlaceSchema = z.object({
  clientId: z.string().optional(),
  name: z.string().min(1).max(120).trim(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().max(1000).trim().optional(),
  category: z.string().trim().default('garden'),
  isPublic: z.boolean().default(false),
});

const updatePlaceSchema = createPlaceSchema.partial();

// 1. GET /api/v1/maps/places (Public places + user's own places if authenticated)
router.get('/places', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = req.userId
      ? { $or: [{ isPublic: true }, { ownerId: req.userId }] }
      : { isPublic: true };

    const places = await SavedPlace.find(filter).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: places.map((p) => p.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/v1/maps/places
router.post(
  '/places',
  requireAuth,
  validate({ body: createPlaceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const place = await SavedPlace.create({
        ...req.body,
        ownerId: req.userId,
      });

      return res.status(201).json({
        success: true,
        data: place.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. PATCH /api/v1/maps/places/:id
router.patch(
  '/places/:id',
  requireAuth,
  validate({ body: updatePlaceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppServerError.badRequest('Invalid place ID');
      }

      const place = await SavedPlace.findOneAndUpdate(
        { _id: id, ownerId: req.userId },
        { $set: req.body },
        { new: true, runValidators: true },
      );

      if (!place) {
        throw AppServerError.notFound('Saved place not found');
      }

      return res.json({
        success: true,
        data: place.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 4. DELETE /api/v1/maps/places/:id
router.delete('/places/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid place ID');
    }

    const place = await SavedPlace.findOneAndDelete({ _id: id, ownerId: req.userId });
    if (!place) {
      throw AppServerError.notFound('Saved place not found');
    }

    return res.json({
      success: true,
      message: 'Saved place deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

export const mapsRouter = router;

