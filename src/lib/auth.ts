import { useEffect, useSyncExternalStore } from 'react';
import type { CountryCode } from '../../shared/countries';
import { api } from './api';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  role: string;
  status: 'active' | 'suspended';
  emailVerified: boolean;
};

type AuthState = {
  user: AuthUser | null;
  /** true once the first session check has finished (or failed). */
  loaded: boolean;
  /** The API couldn't be reached (e.g. static hosting without the backend). */
  unavailable: boolean;
  /** This browser was signed in, but the session is gone (expired or signed out elsewhere). */
  signedOutElsewhere: boolean;
};

const FLAG = 'ar_signed_in';
const readFlag = () => {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    // Storage blocked (private mode): the notice just won't show.
  }
};

let state: AuthState = { user: null, loaded: false, unavailable: false, signedOutElsewhere: false };
const listeners = new Set<() => void>();
const setState = (patch: Partial<AuthState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const signedIn = (user: AuthUser) => {
  writeFlag(true);
  setState({ user, loaded: true, unavailable: false, signedOutElsewhere: false });
  return user;
};

let checking: Promise<void> | null = null;

/** Re-reads the session from the API (shared by every component). */
export function refreshSession(): Promise<void> {
  checking = api
    .get<{ user: AuthUser | null }>('/auth/session')
    .then(({ data }) => {
      if (data.user) signedIn(data.user);
      else {
        const lost = readFlag();
        writeFlag(false);
        setState({ user: null, loaded: true, unavailable: false, signedOutElsewhere: lost });
      }
    })
    .catch(() => setState({ user: null, loaded: true, unavailable: true }));
  return checking;
}

/** Current auth state; triggers the first session check on mount. */
export function useAuth(): AuthState {
  useEffect(() => {
    if (!checking) void refreshSession();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const dismissSignedOutNotice = () => setState({ signedOutElsewhere: false });

export async function login(input: { email: string; password: string; remember: boolean }) {
  const { data } = await api.post<{ user: AuthUser }>('/auth/login', input);
  return signedIn(data.user);
}

export async function register(input: {
  firstName: string;
  email: string;
  country: CountryCode;
  phone?: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  captchaToken?: string;
}) {
  const { data } = await api.post<{ user: AuthUser }>('/auth/register', input);
  return signedIn(data.user);
}

export async function logout(everywhere = false) {
  try {
    await api.post(everywhere ? '/auth/logout-all' : '/auth/logout');
  } finally {
    writeFlag(false);
    setState({ user: null, loaded: true, signedOutElsewhere: false });
  }
}

export const requestPasswordReset = (email: string, captchaToken?: string) =>
  api.post<{ ok: true }>('/auth/password/forgot', { email, captchaToken });

export const resetPassword = (token: string, password: string, confirmPassword: string) =>
  api.post<{ ok: true }>('/auth/password/reset', { token, password, confirmPassword });

export async function verifyEmail(token: string) {
  await api.post<{ verified: true }>('/auth/verify-email', { token });
  if (state.user) setState({ user: { ...state.user, emailVerified: true } });
}

export const resendVerification = () =>
  api.post<{ sent?: true; alreadyVerified?: true }>('/auth/verify-email/resend');
