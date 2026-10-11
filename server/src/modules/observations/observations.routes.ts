import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Observation, ObservationShare } from '../../models/index.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingleImage } from '../../middleware/upload.js';
import { saveFile } from '../../storage/index.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const createObservationSchema = z.object({
  clientId: z.string().optional(),
  plantId: z.string().optional(),
  clientPlantId: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      label: z.string().optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
  shareVisibility: z.enum(['private', 'connections', 'public']).default('private'),
  assessment: z
    .object({
      provider: z.string().default('gemini'),
      modelId: z.string().default('gemini-3.8-flash'),
      isPlant: z.string().default('yes'),
      plantName: z.string().optional(),
      healthStatus: z.string().default('unknown'),
      visibleSymptoms: z.array(z.string()).default([]),
      possibleCauses: z
        .array(
          z.object({
            name: z.string(),
            confidenceText: z.string().optional(),
            explanation: z.string(),
          }),
        )
        .default([]),
      limitations: z.array(z.string()).default([]),
      recommendations: z.array(z.string()).default([]),
      qualityVerdict: z.string().default('suitable'),
    })
    .optional(),
});

const updateObservationSchema = z.object({
  plantId: z.string().nullable().optional(),
  notes: z.string().max(2000).optional(),
  shareVisibility: z.enum(['private', 'connections', 'public']).optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      label: z.string().optional(),
    })
    .optional(),
});

// 1. GET /api/v1/observations (owner-scoped)
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = { ownerId: req.userId };
    if (req.query.plantId && typeof req.query.plantId === 'string') {
      filter.plantId = req.query.plantId;
    }

    const observations = await Observation.find(filter).sort({ timestamp: -1 });
    return res.json({
      success: true,
      data: observations.map((o) => o.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/v1/observations
router.post(
  '/',
  requireAuth,
  validate({ body: createObservationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const observation = await Observation.create({
        ...req.body,
        ownerId: req.userId,
        timestamp: new Date(),
      });

      return res.status(201).json({
        success: true,
        data: observation.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. GET /api/v1/observations/:id (allows owner, public, or users with valid ObservationShare)
router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid observation ID');
    }

    const observation = await Observation.findById(id);
    if (!observation) {
      throw AppServerError.notFound('Observation not found');
    }

    // Access control check
    const isOwner = req.userId && observation.ownerId.toString() === req.userId;
    const isPublic = observation.shareVisibility === 'public';

    let hasShareAccess = false;
    if (req.userId && !isOwner) {
      const share = await ObservationShare.findOne({
        observationId: observation._id,
        recipientId: req.userId,
        revokedAt: null,
      });
      if (share) {
        hasShareAccess = true;
      }
    }

    if (!isOwner && !isPublic && !hasShareAccess) {
      throw AppServerError.forbidden('You do not have permission to view this observation');
    }

    return res.json({
      success: true,
      data: observation.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// 4. PATCH /api/v1/observations/:id (owner only)
router.patch(
  '/:id',
  requireAuth,
  validate({ body: updateObservationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppServerError.badRequest('Invalid observation ID');
      }

      const observation = await Observation.findOneAndUpdate(
        { _id: id, ownerId: req.userId },
        { $set: req.body },
        { new: true, runValidators: true },
      );

      if (!observation) {
        throw AppServerError.notFound('Observation not found');
      }

      return res.json({
        success: true,
        data: observation.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 5. DELETE /api/v1/observations/:id (owner only)
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid observation ID');
    }

    const observation = await Observation.findOneAndDelete({ _id: id, ownerId: req.userId });
    if (!observation) {
      throw AppServerError.notFound('Observation not found');
    }

    // Clean up observation shares
    await ObservationShare.deleteMany({ observationId: id });

    return res.json({
      success: true,
      message: 'Observation deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// 6. POST /api/v1/observations/:id/photo
router.post(
  '/:id/photo',
  requireAuth,
  uploadSingleImage,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppServerError.badRequest('Invalid observation ID');
      }

      const observation = await Observation.findOne({ _id: id, ownerId: req.userId });
      if (!observation) {
        throw AppServerError.notFound('Observation not found');
      }

      if (!req.file) {
        throw AppServerError.badRequest('No image file provided');
      }

      const saved = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      observation.imageUrl = saved.url;
      await observation.save();

      return res.json({
        success: true,
        data: {
          imageUrl: saved.url,
          filename: saved.filename,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export const observationsRouter = router;

