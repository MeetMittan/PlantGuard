import { apiClient } from '@/lib/api/client';

export interface CareTaskEntity {
  id: string;
  clientId?: string;
  plantId?: string;
  clientPlantId?: string;
  type: 'watering' | 'fertilizing' | 'pruning' | 'inspection' | 'custom';
  title: string;
  frequencyDays: number;
  lastCompletedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CareCompletionEntity {
  id: string;
  taskId: string;
  completedDate: string;
  notes?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface StreaksSummary {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastCompletedDate: string | null;
}

export const careApi = {
  async listTasks(): Promise<CareTaskEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: CareTaskEntity[] }>('/care/tasks');
    return res.data.data;
  },

  async createTask(data: Partial<CareTaskEntity>): Promise<CareTaskEntity> {
    const res = await apiClient.post<{ success: boolean; data: CareTaskEntity }>('/care/tasks', data);
    return res.data.data;
  },

  async updateTask(id: string, data: Partial<CareTaskEntity>): Promise<CareTaskEntity> {
    const res = await apiClient.patch<{ success: boolean; data: CareTaskEntity }>(`/care/tasks/${id}`, data);
    return res.data.data;
  },

  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/care/tasks/${id}`);
  },

  async completeTask(
    id: string,
    data?: { completedDate?: string; notes?: string; idempotencyKey?: string },
  ): Promise<{ completion: CareCompletionEntity; task: CareTaskEntity }> {
    const res = await apiClient.post<{
      success: boolean;
      data: { completion: CareCompletionEntity; task: CareTaskEntity };
    }>(`/care/tasks/${id}/complete`, data || {});
    return res.data.data;
  },

  async getStreaks(): Promise<StreaksSummary> {
    const res = await apiClient.get<{ success: boolean; data: StreaksSummary }>('/care/streaks');
    return res.data.data;
  },

  async listCompletions(taskId?: string): Promise<CareCompletionEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: CareCompletionEntity[] }>('/care/completions', {
      params: taskId ? { taskId } : {},
    });
    return res.data.data;
  },
};

