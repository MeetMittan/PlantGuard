import { apiClient } from '@/lib/api/client';

export interface SavedPlaceEntity {
  id: string;
  clientId?: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  category?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export const mapsApi = {
  async listPlaces(): Promise<SavedPlaceEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: SavedPlaceEntity[] }>('/maps/places');
    return res.data.data;
  },

  async createPlace(data: Partial<SavedPlaceEntity>): Promise<SavedPlaceEntity> {
    const res = await apiClient.post<{ success: boolean; data: SavedPlaceEntity }>('/maps/places', data);
    return res.data.data;
  },

  async updatePlace(id: string, data: Partial<SavedPlaceEntity>): Promise<SavedPlaceEntity> {
    const res = await apiClient.patch<{ success: boolean; data: SavedPlaceEntity }>(`/maps/places/${id}`, data);
    return res.data.data;
  },

  async deletePlace(id: string): Promise<void> {
    await apiClient.delete(`/maps/places/${id}`);
  },
};

