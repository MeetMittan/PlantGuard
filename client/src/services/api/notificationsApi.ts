import { apiClient } from '@/lib/api/client';
import type { UserProfile } from './authApi';

export interface NotificationEntity {
  id: string;
  senderId?: UserProfile;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  async list(): Promise<NotificationEntity[]> {
    const res = await apiClient.get<{ success: boolean; data: NotificationEntity[] }>('/notifications');
    return res.data.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count');
    return res.data.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await apiClient.post('/notifications/mark-all-read');
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },
};

