import { apiClient, setStoredAccessToken } from '@/lib/api/client';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  privacySettings: {
    isPublic: boolean;
    shareObservations: boolean;
    shareLocations: boolean;
  };
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: UserProfile;
    tokens: {
      accessToken: string;
      refreshToken: string;
      tokenType: string;
    };
  };
}

export const authApi = {
  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResponse['data']> {
    const res = await apiClient.post<AuthResponse>('/auth/register', data);
    setStoredAccessToken(res.data.data.tokens.accessToken);
    return res.data.data;
  },

  async login(data: { login: string; password: string }): Promise<AuthResponse['data']> {
    const res = await apiClient.post<AuthResponse>('/auth/login', data);
    setStoredAccessToken(res.data.data.tokens.accessToken);
    return res.data.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setStoredAccessToken(null);
    }
  },

  async getMe(): Promise<UserProfile> {
    const res = await apiClient.get<{ success: boolean; data: UserProfile }>('/auth/me');
    return res.data.data;
  },

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    const res = await apiClient.patch<{ success: boolean; data: UserProfile }>('/users/profile', data);
    return res.data.data;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  },
};

