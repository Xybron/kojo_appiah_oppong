import type { Session, User } from '@supabase/supabase-js';
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const name = z.string().trim().min(1).max(100);
const captchaToken = z.string().min(1).max(4096).optional();

export const loginSchema = z
  .object({
    email,
    // Existing accounts may use a shorter password than the signup policy.
    password: z.string().min(1).max(128),
    captchaToken,
  })
  .strict();

export const registerSchema = z
  .object({
    email,
    password,
    firstName: name,
    lastName: name.optional(),
    captchaToken,
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).max(4096),
  })
  .strict();

export const otpLoginSchema = z.object({ email, captchaToken }).strict();

export const verifyOtpSchema = z
  .object({
    email,
    // Supabase projects can configure email codes from 6 to 10 digits.
    code: z.string().regex(/^\d{6,10}$/),
    captchaToken,
  })
  .strict();

export const updateUserSchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    email: email.optional(),
    avatarUrl: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === 'https:' || protocol === 'http:';
        } catch {
          return false;
        }
      }, 'Avatar must be an HTTP or HTTPS URL')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one profile field');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    captchaToken,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Choose a different password',
  });

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterDTO = z.infer<typeof registerSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type OtpLoginDTO = z.infer<typeof otpLoginSchema>;
export type VerifyOtpDTO = z.infer<typeof verifyOtpSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: 'admin' | 'visitor';
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function mapAuthUser(user: User): AuthUser {
  const metadata = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    firstName: text(metadata.first_name) || text(metadata.given_name),
    lastName: text(metadata.last_name) || text(metadata.family_name),
    avatarUrl: text(metadata.avatar_url) || text(metadata.picture) || null,
    // user_metadata is editable by the account owner and never grants access.
    role: user.app_metadata?.role === 'admin' ? 'admin' : 'visitor',
  };
}

export function mapSession(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    expiresAt: session.expires_at,
    user: mapAuthUser(session.user),
  };
}
