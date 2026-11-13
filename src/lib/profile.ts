import type { CountryCode } from '../../shared/countries';
import { api } from './api';

export type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  certificateName: string | null;
  phone: string | null;
  country: CountryCode;
  role: string;
  emailVerified: boolean;
  whatsappOptIn: boolean;
  createdAt: string;
};

export type Device = {
  id: string;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
};

export const getProfile = () => api.get<Profile>('/me').then((r) => r.data);

export const updateProfile = (patch: Partial<Omit<Profile, 'id' | 'email' | 'role' | 'emailVerified' | 'createdAt'>>) =>
  api.patch<Profile>('/me', patch).then((r) => r.data);

export const listDevices = () => api.get<Device[]>('/me/sessions').then((r) => r.data);

export const signOutDevice = (id: string) => api.delete<{ ok: true; current: boolean }>(`/me/sessions/${id}`);

export const changePassword = (currentPassword: string, password: string, confirmPassword: string) =>
  api.post<{ ok: true }>('/auth/password/change', { currentPassword, password, confirmPassword });
