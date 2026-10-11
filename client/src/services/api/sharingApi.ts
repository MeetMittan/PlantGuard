import { apiClient } from '@/lib/api/client';
import type { ObservationEntity } from './observationsApi';
import type { UserProfile } from './authApi';

export interface SharedFeedItem {
  id: string;
  notes?: string;
  canComment: boolean;
  sharedAt: string;
  observation: ObservationEntity & { ownerId: UserProfile };
}

export const sharingApi = {
  async shareObservation(
    observationId: string,
    recipientId: string,
    notes?: string,
  ): Promise<void> {
    await apiClient.post(`/sharing/observations/${observationId}`, {
      recipientId,
      notes,
    });
  },

  async revokeShare(observationId: string, recipientId: string): Promise<void> {
    await apiClient.delete(`/sharing/observations/${observationId}/recipients/${recipientId}`);
  },

  async getReceivedShares(): Promise<SharedFeedItem[]> {
    const res = await apiClient.get<{ success: boolean; data: SharedFeedItem[] }>('/sharing/received');
    return res.data.data;
  },

  async getSentShares(): Promise<any[]> {
    const res = await apiClient.get<{ success: boolean; data: any[] }>('/sharing/sent');
    return res.data.data;
  },
};

