import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { config } from '@/app/config';

// In-memory token storage with localStorage fallback
let currentAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (currentAccessToken) return currentAccessToken;
  try {
    return localStorage.getItem('plantguard_access_token');
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string | null): void {
  currentAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('plantguard_access_token', token);
    } else {
      localStorage.removeItem('plantguard_access_token');
    }
  } catch {
    // Ignore storage errors in private browsing
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: config.ai.apiBaseUrl || '/api/v1',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization header
apiClient.interceptors.request.use(
  (reqConfig: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    if (token && reqConfig.headers && !reqConfig.headers.Authorization) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error),
);

// Concurrency lock for refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: auto refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest || !error.response) {
      return Promise.reject(error);
    }

    // Do not retry refresh endpoint itself or auth/login
    if (
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${config.ai.apiBaseUrl || '/api/v1'}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newAccessToken =
          refreshResponse.data?.data?.tokens?.accessToken ||
          refreshResponse.data?.accessToken;

        if (newAccessToken) {
          setStoredAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return apiClient(originalRequest);
        } else {
          processQueue(new Error('No token returned from refresh'));
          setStoredAccessToken(null);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setStoredAccessToken(null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

