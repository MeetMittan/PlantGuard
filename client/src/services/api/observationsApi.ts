import { apiClient } from '@/lib/api/client';

export interface ObservationEntity {
  id: string;
  clientId?: string;
  plantId?: string;
  clientPlantId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
  };
  notes?: string;
  timestamp: string;
  shareVisibility: 'private' | 'connections' | 'public';
  assessment?: {
    provider: string;
    modelId: string;
    isPlant: string;
    plantName?: string;
    healthStatus: string;
    visibleSymptoms: string[];
    possibleCauses: Array<{
      name: string;
      confidenceText?: string;
      explanation: string;
    }>;
    limitations: string[];
    recommendations: string[];
    qualityVerdict: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const observationsApi = {
  async list(plantId?: string): Promise<ObservationEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: ObservationEntity[] }>('/observations', {
      params: plantId ? { plantId } : {},
    });
    return res.data.data;
  },

  async getById(id: string): Promise<ObservationEntity> {
    const res = await apiClient.get<{ success: boolean; data: ObservationEntity }>(`/observations/${id}`);
    return res.data.data;
  },

  async create(data: Partial<ObservationEntity>): Promise<ObservationEntity> {
    const res = await apiClient.post<{ success: boolean; data: ObservationEntity }>('/observations', data);
    return res.data.data;
  },

  async update(id: string, data: Partial<ObservationEntity>): Promise<ObservationEntity> {
    const res = await apiClient.patch<{ success: boolean; data: ObservationEntity }>(`/observations/${id}`, data);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/observations/${id}`);
  },

  async uploadPhoto(id: string, file: Blob, filename = 'plant.jpg'): Promise<{ imageUrl: string; filename: string }> {
    const formData = new FormData();
    formData.append('image', file, filename);
    const res = await apiClient.post<{ success: boolean; data: { imageUrl: string; filename: string } }>(
      `/observations/${id}/photo`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return res.data.data;
  },
};

