import Dexie from 'dexie';
import { toDayKey, type DayKey } from '@/lib/dates';
import { createId, nowIso } from '@/lib/utils';
import { db } from '../database';
import type { CareCompletion, CareTask, CareTaskKind } from '../schema';

export async function createCareTask(input: { title: string; kind: CareTaskKind; plantId?: string | null }): Promise<CareTask> {
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required.');
  const task: CareTask = {
    id: createId(),
    title,
    kind: input.kind,
    plantId: input.plantId ?? null,
    createdAt: nowIso(),
    archived: 0,
  };
  await db.careTasks.add(task);
  return task;
}

export async function listCareTasks(): Promise<CareTask[]> {
  const tasks = await db.careTasks.where('archived').equals(0).toArray();
  return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function archiveCareTask(id: string): Promise<void> {
  await db.careTasks.update(id, { archived: 1 });
}

/** Deletes a task. Past completions are kept so historical streaks don't change. */
export async function deleteCareTask(id: string): Promise<void> {
  await db.careTasks.delete(id);
}

/**
 * Marks a task complete for a local day. Idempotent: the unique
 * [taskId+dayKey] index means completing twice on one day never double counts.
 */
export async function completeCareTask(task: Pick<CareTask, 'id' | 'kind'>, at: Date = new Date()): Promise<CareCompletion> {
  const dayKey = toDayKey(at);
  return db.transaction('rw', db.careCompletions, async () => {
    const existing = await db.careCompletions.where('[taskId+dayKey]').equals([task.id, dayKey]).first();
    if (existing) return existing;
    const completion: CareCompletion = {
      id: createId(),
      taskId: task.id,
      dayKey,
      completedAt: at.toISOString(),
      kind: task.kind,
    };
    try {
      await db.careCompletions.add(completion);
    } catch (error) {
      // A concurrent tab may have inserted the same completion first.
      if (error instanceof Dexie.ConstraintError) {
        const winner = await db.careCompletions.where('[taskId+dayKey]').equals([task.id, dayKey]).first();
        if (winner) return winner;
      }
      throw error;
    }
    return completion;
  });
}

export async function uncompleteCareTask(taskId: string, dayKey: DayKey): Promise<void> {
  await db.careCompletions.where('[taskId+dayKey]').equals([taskId, dayKey]).delete();
}

export async function completionsForDay(dayKey: DayKey): Promise<CareCompletion[]> {
  return db.careCompletions.where('dayKey').equals(dayKey).toArray();
}

export async function completionsBetween(fromDay: DayKey, toDay: DayKey): Promise<CareCompletion[]> {
  return db.careCompletions.where('dayKey').between(fromDay, toDay, true, true).toArray();
}

export async function allCompletions(): Promise<CareCompletion[]> {
  return db.careCompletions.toArray();
}
