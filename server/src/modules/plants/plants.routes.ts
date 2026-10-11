import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Plant, CareTask, Observation } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const createPlantSchema = z.object({
  clientId: z.string().optional(),
  name: z.string().min(1).max(100).trim(),
  species: z.string().max(150).trim().optional(),
  coverImageUrl: z.string().nullable().optional(),
  carePreferences: z
    .object({
      wateringIntervalDays: z.number().int().min(1).max(365).optional(),
      checkupIntervalDays: z.number().int().min(1).max(365).optional(),
      notes: z.string().optional(),
    })
    .optional(),
  notes: z.string().max(2000).trim().optional(),
  locationLabel: z.string().max(100).trim().optional(),
});

const updatePlantSchema = createPlantSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

// All plant routes require authentication
router.use(requireAuth);

// 1. GET /api/v1/plants
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeArchived = req.query.archived === 'true';
    const filter: Record<string, unknown> = { ownerId: req.userId };
    if (!includeArchived) {
      filter.isArchived = false;
    }

    const plants = await Plant.find(filter).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: plants.map((p) => p.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/v1/plants
router.post(
  '/',
  validate({ body: createPlantSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plant = await Plant.create({
        ...req.body,
        ownerId: req.userId,
      });

      return res.status(201).json({
        success: true,
        data: plant.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/plants/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid plant ID');
    }

    const plant = await Plant.findOne({ _id: id, ownerId: req.userId });
    if (!plant) {
      throw AppServerError.notFound('Plant not found');
    }

    return res.json({
      success: true,
      data: plant.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// 4. PATCH /api/v1/plants/:id
router.patch(
  '/:id',
  validate({ body: updatePlantSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppServerError.badRequest('Invalid plant ID');
      }

      const plant = await Plant.findOneAndUpdate(
        { _id: id, ownerId: req.userId },
        { $set: req.body },
        { new: true, runValidators: true },
      );

      if (!plant) {
        throw AppServerError.notFound('Plant not found');
      }

      return res.json({
        success: true,
        data: plant.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 5. PATCH /api/v1/plants/:id/archive
router.patch('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid plant ID');
    }

    const plant = await Plant.findOne({ _id: id, ownerId: req.userId });
    if (!plant) {
      throw AppServerError.notFound('Plant not found');
    }

    plant.isArchived = !plant.isArchived;
    await plant.save();

    return res.json({
      success: true,
      data: plant.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// 6. DELETE /api/v1/plants/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid plant ID');
    }

    const plant = await Plant.findOneAndDelete({ _id: id, ownerId: req.userId });
    if (!plant) {
      throw AppServerError.notFound('Plant not found');
    }

    // Clean up associated tasks or unlink them
    await CareTask.deleteMany({ plantId: id, ownerId: req.userId });
    await Observation.updateMany({ plantId: id, ownerId: req.userId }, { $unset: { plantId: 1 } });

    return res.json({
      success: true,
      message: 'Plant deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

export const plantsRouter = router;

