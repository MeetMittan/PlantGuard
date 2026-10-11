import { apiClient } from '@/lib/api/client';

export interface SyncPayload {
  lastSyncedAt?: string;
  outbox: Array<{
    clientId?: string;
    entityType: 'plant' | 'observation' | 'careTask' | 'careCompletion' | 'savedPlace';
    operation: 'create' | 'update' | 'delete';
    payload: Record<string, any>;
  }>;
}

export interface SyncResult {
  applied: Array<{ clientId?: string; serverId?: string; status: 'ok' | 'error'; error?: string }>;
  serverVersion: string;
  serverState: {
    plants: any[];
    observations: any[];
    careTasks: any[];
    careCompletions: any[];
    savedPlaces: any[];
  };
}

export const syncApi = {
  async sync(data: SyncPayload): Promise<SyncResult> {
    const res = await apiClient.post<{ success: boolean; data: SyncResult }>('/sync', data);
    return res.data.data;
  },
};

