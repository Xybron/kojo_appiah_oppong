import type { User } from '@supabase/supabase-js';
import type { AuthUser } from '../features/auth/auth.types';

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_COMMERCE_SECRET_KEY?: string;
  COMMERCE_ENABLED?: string;
  CATALOG_VERIFIED?: string;
  COMMERCE_APP_URL?: string;
  COMMERCE_ORDER_TOKEN_SECRET?: string;
  BACHS_SECRET_KEY?: string;
  BACHS_WEBHOOK_SECRET?: string;
  BACHS_ACCOUNT_ID?: string;
  BACHS_ENVIRONMENT?: string;
  AUTH_ALLOW_REGISTRATION?: string;
  ALLOWED_ORIGINS?: string;
};

export type Variables = {
  user: AuthUser;
  authUser: User;
  accessToken: string;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
