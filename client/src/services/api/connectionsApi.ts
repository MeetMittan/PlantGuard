import { apiClient } from '@/lib/api/client';
import type { UserProfile } from './authApi';

export interface ConnectionRequestEntity {
  id: string;
  requesterId: UserProfile;
  recipientId: UserProfile;
  status: 'pending' | 'accepted' | 'declined' | 'canceled';
  message?: string;
  createdAt: string;
}

export const connectionsApi = {
  async listConnections(): Promise<UserProfile[]> {
    const res = await apiClient.get<{ success: boolean; data: UserProfile[] }>('/connections');
    return res.data.data;
  },

  async sendRequest(recipientId: string, message?: string): Promise<ConnectionRequestEntity> {
    const res = await apiClient.post<{ success: boolean; data: ConnectionRequestEntity }>(
      '/connections/request',
      { recipientId, message },
    );
    return res.data.data;
  },

  async getIncomingRequests(): Promise<ConnectionRequestEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: ConnectionRequestEntity[] }>(
      '/connections/requests/incoming',
    );
    return res.data.data;
  },

  async getOutgoingRequests(): Promise<ConnectionRequestEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: ConnectionRequestEntity[] }>(
      '/connections/requests/outgoing',
    );
    return res.data.data;
  },

  async acceptRequest(id: string): Promise<void> {
    await apiClient.post(`/connections/requests/${id}/accept`);
  },

  async declineRequest(id: string): Promise<void> {
    await apiClient.post(`/connections/requests/${id}/decline`);
  },

  async cancelRequest(id: string): Promise<void> {
    await apiClient.post(`/connections/requests/${id}/cancel`);
  },

  async blockUser(id: string): Promise<void> {
    await apiClient.post(`/connections/${id}/block`);
  },

  async removeConnection(id: string): Promise<void> {
    await apiClient.delete(`/connections/${id}`);
  },

  async searchUsers(query: string): Promise<UserProfile[]> {
    const res = await apiClient.get<{ success: boolean; data: UserProfile[] }>('/users/search', {
      params: { q: query },
    });
    return res.data.data;
  },
};

