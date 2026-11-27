import type { User } from '@supabase/supabase-js';
import type { AuthUser } from '../features/auth/auth.types';

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  AUTH_ALLOW_REGISTRATION?: string;
  ALLOWED_ORIGINS?: string;
};

export type Variables = {
  user: AuthUser;
  authUser: User;
  accessToken: string;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
