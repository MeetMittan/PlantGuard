import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  Plant,
  Observation,
  CareTask,
  CareCompletion,
  SavedPlace,
  SyncChange,
} from '../../models/index.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { logger } from '../../lib/logger.js';

const router = Router();

const syncPayloadSchema = z.object({
  lastSyncedAt: z.string().optional(),
  outbox: z
    .array(
      z.object({
        clientId: z.string().optional(),
        entityType: z.enum(['plant', 'observation', 'careTask', 'careCompletion', 'savedPlace']),
        operation: z.enum(['create', 'update', 'delete']),
        payload: z.record(z.string(), z.any()),
      }),
    )
    .default([]),
});

router.use(requireAuth);

router.post(
  '/',
  validate({ body: syncPayloadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { outbox, lastSyncedAt } = req.body;
      const applied: Array<{ clientId?: string; serverId?: string; status: 'ok' | 'error'; error?: string }> = [];

      for (const item of outbox) {
        try {
          const { entityType, operation, payload, clientId } = item;
          let serverId: string | undefined = payload.id;

          if (entityType === 'plant') {
            if (operation === 'create') {
              const plant = await Plant.create({
                ...payload,
                clientId,
                ownerId: req.userId,
              });
              serverId = plant._id.toString();
            } else if (operation === 'update' && serverId) {
              await Plant.findOneAndUpdate(
                { _id: serverId, ownerId: req.userId },
                { $set: payload },
              );
            } else if (operation === 'delete' && serverId) {
              await Plant.findOneAndDelete({ _id: serverId, ownerId: req.userId });
            }
          } else if (entityType === 'observation') {
            if (operation === 'create') {
              const obs = await Observation.create({
                ...payload,
                clientId,
                ownerId: req.userId,
              });
              serverId = obs._id.toString();
            } else if (operation === 'update' && serverId) {
              await Observation.findOneAndUpdate(
                { _id: serverId, ownerId: req.userId },
                { $set: payload },
              );
            } else if (operation === 'delete' && serverId) {
              await Observation.findOneAndDelete({ _id: serverId, ownerId: req.userId });
            }
          } else if (entityType === 'careTask') {
            if (operation === 'create') {
              const task = await CareTask.create({
                ...payload,
                clientId,
                ownerId: req.userId,
              });
              serverId = task._id.toString();
            } else if (operation === 'update' && serverId) {
              await CareTask.findOneAndUpdate(
                { _id: serverId, ownerId: req.userId },
                { $set: payload },
              );
            } else if (operation === 'delete' && serverId) {
              await CareTask.findOneAndDelete({ _id: serverId, ownerId: req.userId });
            }
          } else if (entityType === 'careCompletion') {
            if (operation === 'create' || operation === 'update') {
              const comp = await CareCompletion.findOneAndUpdate(
                {
                  ownerId: req.userId,
                  taskId: payload.taskId,
                  completedDate: payload.completedDate,
                },
                {
                  $setOnInsert: {
                    ownerId: req.userId,
                    taskId: payload.taskId,
                    completedDate: payload.completedDate,
                  },
                  $set: { notes: payload.notes || '' },
                },
                { upsert: true, new: true },
              );
              serverId = comp._id.toString();
            }
          } else if (entityType === 'savedPlace') {
            if (operation === 'create') {
              const place = await SavedPlace.create({
                ...payload,
                clientId,
                ownerId: req.userId,
              });
              serverId = place._id.toString();
            } else if (operation === 'update' && serverId) {
              await SavedPlace.findOneAndUpdate(
                { _id: serverId, ownerId: req.userId },
                { $set: payload },
              );
            } else if (operation === 'delete' && serverId) {
              await SavedPlace.findOneAndDelete({ _id: serverId, ownerId: req.userId });
            }
          }

          applied.push({ clientId, serverId, status: 'ok' });
        } catch (itemErr) {
          logger.warn({ item, err: itemErr }, 'Sync item processing failed');
          applied.push({
            clientId: item.clientId,
            status: 'error',
            error: itemErr instanceof Error ? itemErr.message : String(itemErr),
          });
        }
      }

      // Fetch server data updated since lastSyncedAt
      const sinceDate = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

      const [plants, observations, careTasks, careCompletions, savedPlaces] = await Promise.all([
        Plant.find({ ownerId: req.userId, updatedAt: { $gt: sinceDate } }),
        Observation.find({ ownerId: req.userId, updatedAt: { $gt: sinceDate } }),
        CareTask.find({ ownerId: req.userId, updatedAt: { $gt: sinceDate } }),
        CareCompletion.find({ ownerId: req.userId, updatedAt: { $gt: sinceDate } }),
        SavedPlace.find({ ownerId: req.userId, updatedAt: { $gt: sinceDate } }),
      ]);

      return res.json({
        success: true,
        data: {
          applied,
          serverVersion: new Date().toISOString(),
          serverState: {
            plants: plants.map((p) => p.toJSON()),
            observations: observations.map((o) => o.toJSON()),
            careTasks: careTasks.map((t) => t.toJSON()),
            careCompletions: careCompletions.map((c) => c.toJSON()),
            savedPlaces: savedPlaces.map((p) => p.toJSON()),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export const syncRouter = router;
