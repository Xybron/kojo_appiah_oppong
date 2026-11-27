import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../../type/binding';
import { mapAuthUser } from '../../features/auth/auth.types';
import { createSupabaseAuthClient, throwAuthError } from '../utils/supabase';

export function authMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authorization = c.req.header('Authorization');
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) throw new HTTPException(401, { message: 'Sign in to continue.' });

    // Verify with the project's Auth server. This supports legacy and asymmetric
    // signing keys and reads current server-controlled app metadata.
    const { data, error } = await createSupabaseAuthClient(c.env).auth.getUser(token);
    if (error || !data.user)
      throwAuthError(error, 401, 'Invalid or expired session. Please sign in again.');

    c.set('authUser', data.user);
    c.set('user', mapAuthUser(data.user));
    c.set('accessToken', token);
    await next();
  };
}

/** Add after authMiddleware() to any future website management route. */
export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Sign in to continue.' });
    if (user.role !== 'admin')
      throw new HTTPException(403, { message: 'Administrator access is required.' });
    await next();
  };
}
