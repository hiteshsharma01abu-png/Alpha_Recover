import type { CountryCode } from '../../shared/countries';
import { api, ApiError } from './api';

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
  image: string | null;
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

export const updateProfile = (patch: Partial<Omit<Profile, 'id' | 'email' | 'role' | 'emailVerified' | 'createdAt' | 'image'>>) =>
  api.patch<Profile>('/me', patch).then((r) => r.data);

/** JPEG / PNG / WebP profile photo (max 2 MB). Relayed to Bunny Storage by the API. */
export async function uploadAvatar(file: File): Promise<Profile> {
  const body = new FormData();
  body.append('file', file);
  let res: Response;
  try {
    res = await fetch('/api/v1/me/avatar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
      body,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Check your connection and try again.');
  }
  const json = (await res.json().catch(() => null)) as
    | { data: Profile }
    | { error: { code: string; message: string; details?: { path: string; message: string }[]; requestId?: string } }
    | null;
  if (!res.ok || !json || 'error' in json) {
    const err = json && 'error' in json ? json.error : undefined;
    throw new ApiError(
      res.status,
      err?.code ?? 'INTERNAL_ERROR',
      err?.message ?? 'Something went wrong. Please try again.',
      err?.details ?? [],
      err?.requestId,
    );
  }
  return json.data;
}

export const clearAvatar = () => api.delete<Profile>('/me/avatar').then((r) => r.data);

export const listDevices = () => api.get<Device[]>('/me/sessions').then((r) => r.data);

export const signOutDevice = (id: string) => api.delete<{ ok: true; current: boolean }>(`/me/sessions/${id}`);

export const changePassword = (currentPassword: string, password: string, confirmPassword: string) =>
  api.post<{ ok: true }>('/auth/password/change', { currentPassword, password, confirmPassword });
