import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { CareTask, CareCompletion } from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppServerError } from '../../errors.js';

const router = Router();

const createTaskSchema = z.object({
  clientId: z.string().optional(),
  plantId: z.string().optional(),
  clientPlantId: z.string().optional(),
  type: z.enum(['watering', 'fertilizing', 'pruning', 'inspection', 'custom']).default('watering'),
  title: z.string().min(1).max(100).trim(),
  frequencyDays: z.number().int().min(1).max(365).default(7),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  frequencyDays: z.number().int().min(1).max(365).optional(),
  type: z.enum(['watering', 'fertilizing', 'pruning', 'inspection', 'custom']).optional(),
  isActive: z.boolean().optional(),
});

const completeTaskSchema = z.object({
  completedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'completedDate must be in YYYY-MM-DD format')
    .optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().optional(),
});

// All care routes require authentication
router.use(requireAuth);

// 1. GET /api/v1/care/tasks
router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await CareTask.find({ ownerId: req.userId, isActive: true }).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: tasks.map((t) => t.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/v1/care/tasks
router.post(
  '/tasks',
  validate({ body: createTaskSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await CareTask.create({
        ...req.body,
        ownerId: req.userId,
      });

      return res.status(201).json({
        success: true,
        data: task.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 3. PATCH /api/v1/care/tasks/:id
router.patch(
  '/tasks/:id',
  validate({ body: updateTaskSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppServerError.badRequest('Invalid care task ID');
      }

      const task = await CareTask.findOneAndUpdate(
        { _id: id, ownerId: req.userId },
        { $set: req.body },
        { new: true, runValidators: true },
      );

      if (!task) {
        throw AppServerError.notFound('Care task not found');
      }

      return res.json({
        success: true,
        data: task.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// 4. DELETE /api/v1/care/tasks/:id
router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppServerError.badRequest('Invalid care task ID');
    }

    const task = await CareTask.findOneAndDelete({ _id: id, ownerId: req.userId });
    if (!task) {
      throw AppServerError.notFound('Care task not found');
    }

    await CareCompletion.deleteMany({ taskId: id, ownerId: req.userId });

    return res.json({
      success: true,
      message: 'Care task deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// 5. POST /api/v1/care/tasks/:id/complete (Idempotent completion)
router.post(
  '/tasks/:id/complete',
  validate({ body: completeTaskSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppServerError.badRequest('Invalid care task ID');
      }

      const task = await CareTask.findOne({ _id: id, ownerId: req.userId });
      if (!task) {
        throw AppServerError.notFound('Care task not found');
      }

      const completedDate = req.body.completedDate || new Date().toISOString().slice(0, 10);
      const idempotencyKey = req.body.idempotencyKey;

      // Upsert completion to guarantee idempotency
      const completion = await CareCompletion.findOneAndUpdate(
        {
          ownerId: req.userId,
          taskId: id,
          completedDate,
        },
        {
          $setOnInsert: {
            ownerId: req.userId,
            taskId: id,
            completedDate,
            idempotencyKey,
          },
          $set: {
            notes: req.body.notes || '',
          },
        },
        { upsert: true, new: true },
      );

      task.lastCompletedAt = new Date();
      await task.save();

      return res.json({
        success: true,
        data: {
          completion: completion.toJSON(),
          task: task.toJSON(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// 6. GET /api/v1/care/completions
router.get('/completions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = { ownerId: req.userId };
    if (req.query.taskId && typeof req.query.taskId === 'string') {
      filter.taskId = req.query.taskId;
    }

    const completions = await CareCompletion.find(filter)
      .sort({ completedDate: -1 })
      .limit(100);

    return res.json({
      success: true,
      data: completions.map((c) => c.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// 7. GET /api/v1/care/streaks
router.get('/streaks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const completions = await CareCompletion.find({ ownerId: req.userId })
      .sort({ completedDate: -1 })
      .select('completedDate');

    if (completions.length === 0) {
      return res.json({
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          totalCompletions: 0,
          lastCompletedDate: null,
        },
      });
    }

    // Unique dates set in descending order
    const dates = Array.from(new Set(completions.map((c) => c.completedDate))).sort().reverse();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Calculate current streak
    if (dates[0] === today || dates[0] === yesterday) {
      let expectedDate = new Date(dates[0]);
      for (const d of dates) {
        const currentDate = new Date(d);
        const diffDays = Math.round(
          (expectedDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays === 0) {
          currentStreak++;
          expectedDate = new Date(currentDate.getTime() - 86400000);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let prevDate: Date | null = null;
    for (const d of dates.slice().reverse()) {
      const cur = new Date(d);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      prevDate = cur;
    }

    return res.json({
      success: true,
      data: {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        totalCompletions: completions.length,
        lastCompletedDate: dates[0] || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const careRouter = router;

