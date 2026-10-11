import { apiClient } from '@/lib/api/client';

export interface PlantEntity {
  id: string;
  clientId?: string;
  name: string;
  species?: string;
  coverImageUrl?: string;
  carePreferences?: {
    wateringIntervalDays?: number;
    checkupIntervalDays?: number;
    notes?: string;
  };
  notes?: string;
  locationLabel?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const plantsApi = {
  async list(includeArchived = false): Promise<PlantEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: PlantEntity[] }>('/plants', {
      params: { archived: includeArchived },
    });
    return res.data.data;
  },

  async getById(id: string): Promise<PlantEntity> {
    const res = await apiClient.get<{ success: boolean; data: PlantEntity }>(`/plants/${id}`);
    return res.data.data;
  },

  async create(data: Partial<PlantEntity>): Promise<PlantEntity> {
    const res = await apiClient.post<{ success: boolean; data: PlantEntity }>('/plants', data);
    return res.data.data;
  },

  async update(id: string, data: Partial<PlantEntity>): Promise<PlantEntity> {
    const res = await apiClient.patch<{ success: boolean; data: PlantEntity }>(`/plants/${id}`, data);
    return res.data.data;
  },

  async toggleArchive(id: string): Promise<PlantEntity> {
    const res = await apiClient.patch<{ success: boolean; data: PlantEntity }>(`/plants/${id}/archive`);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/plants/${id}`);
  },
};

