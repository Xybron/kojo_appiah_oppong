import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import type { ZodTypeAny } from 'zod';
import type { AppEnv } from '../../type/binding';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { AuthService } from './auth.service';
import {
  loginSchema,
  registerSchema,
  otpLoginSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  updateUserSchema,
  changePasswordSchema,
} from './auth.types';

const validate = <T extends ZodTypeAny>(schema: T) =>
  zValidator('json', schema, (result) => {
    if (!result.success)
      throw new HTTPException(400, { message: 'Invalid request body. Check the supplied fields.' });
  });

export const authRouter = new Hono<AppEnv>();

// Schema output is passed through directly, including trimmed/normalized fields.
authRouter.post('/login', validate(loginSchema), async (c) =>
  c.json(await new AuthService(c.env).login(c.req.valid('json'))),
);

authRouter.post('/register', validate(registerSchema), async (c) =>
  c.json(await new AuthService(c.env).register(c.req.valid('json')), 201),
);

authRouter.post('/otp-login', validate(otpLoginSchema), async (c) =>
  c.json(await new AuthService(c.env).otpLogin(c.req.valid('json'))),
);

authRouter.post('/verify-otp', validate(verifyOtpSchema), async (c) =>
  c.json(await new AuthService(c.env).verifyOtp(c.req.valid('json'))),
);

authRouter.post('/refresh', validate(refreshTokenSchema), async (c) =>
  c.json(await new AuthService(c.env).refreshToken(c.req.valid('json'))),
);

authRouter.get('/me', authMiddleware(), (c) => c.json({ user: c.get('user') }));
authRouter.get('/context', authMiddleware(), (c) => c.json({ user: c.get('user') }));

authRouter.patch('/me', validate(updateUserSchema), authMiddleware(), async (c) =>
  c.json(await new AuthService(c.env).updateUser(c.get('accessToken'), c.req.valid('json'))),
);

authRouter.post('/logout', authMiddleware(), async (c) =>
  c.json(await new AuthService(c.env).logout(c.get('accessToken'))),
);

authRouter.post('/change-password', validate(changePasswordSchema), authMiddleware(), async (c) =>
  c.json(await new AuthService(c.env).changePassword(c.get('authUser'), c.req.valid('json'))),
);
