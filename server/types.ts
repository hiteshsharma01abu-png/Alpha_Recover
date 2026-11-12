import type { Env } from './env';
import type { Database } from './db';
import type { Auth } from './auth/auth';
import type { Mailer } from './notifications/mailer';
import type { UserRole } from './db/schema';

/** Everything a request handler needs; injected so tests can swap pieces (e.g. the mailer). */
export type Deps = {
  env: Env;
  db: Database;
  auth: Auth;
  mailer: Mailer;
};

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  role: UserRole;
  status: 'active' | 'suspended';
  emailVerified: boolean;
};

export type AppEnv = {
  Variables: {
    deps: Deps;
    requestId: string;
    /** undefined = not loaded yet, null = anonymous */
    user: SessionUser | null | undefined;
  };
};
