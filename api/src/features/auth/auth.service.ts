import type { User } from '@supabase/supabase-js';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '../../type/binding';
import {
  authenticatedAuthRequest,
  createSupabaseAuthClient,
  throwAuthError,
} from '../../core/utils/supabase';
import { mapAuthUser, mapSession } from './auth.types';
import type {
  LoginDTO,
  RegisterDTO,
  OtpLoginDTO,
  VerifyOtpDTO,
  RefreshTokenDTO,
  UpdateUserDTO,
  ChangePasswordDTO,
} from './auth.types';

export class AuthService {
  constructor(private readonly env: Bindings) {}

  async login(data: LoginDTO) {
    const { data: result, error } = await createSupabaseAuthClient(
      this.env,
    ).auth.signInWithPassword({
      email: data.email,
      password: data.password,
      options: { captchaToken: data.captchaToken },
    });
    if (error || !result.session)
      throwAuthError(error, 401, 'Invalid email or password, or email is not confirmed.');
    return mapSession(result.session);
  }

  async register(data: RegisterDTO) {
    if (this.env.AUTH_ALLOW_REGISTRATION !== 'true') {
      throw new HTTPException(403, { message: 'Public registration is disabled.' });
    }
    const { data: result, error } = await createSupabaseAuthClient(this.env).auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { first_name: data.firstName, last_name: data.lastName ?? '' },
        captchaToken: data.captchaToken,
      },
    });
    if (error) throwAuthError(error, 400, 'Unable to register. Check your details and try again.');
    // Supabase may return an obfuscated user for an existing email. Do not return
    // that object or treat it as a session. Confirmation remains provider-controlled.
    if (!result.session)
      return {
        message:
          'Check your email to confirm your account. If you already have an account, sign in.',
        requiresEmailConfirmation: true as const,
      };
    return { ...mapSession(result.session), requiresEmailConfirmation: false as const };
  }

  async otpLogin(data: OtpLoginDTO) {
    const { error } = await createSupabaseAuthClient(this.env).auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: this.env.AUTH_ALLOW_REGISTRATION === 'true',
        captchaToken: data.captchaToken,
      },
    });
    // Hide account-existence errors, but retain actionable generic failures for
    // invalid CAPTCHA, provider configuration, network errors, and rate limits.
    if (
      error &&
      !['otp_disabled', 'user_not_found', 'signup_disabled'].includes(error.code ?? '')
    ) {
      throwAuthError(
        error,
        400,
        'Unable to send a sign-in code. Check your details and try again.',
      );
    }
    return { message: 'If your account is eligible, a sign-in code has been sent to your email.' };
  }

  async verifyOtp(data: VerifyOtpDTO) {
    const { data: result, error } = await createSupabaseAuthClient(this.env).auth.verifyOtp({
      email: data.email,
      token: data.code,
      type: 'email',
      options: { captchaToken: data.captchaToken },
    });
    if (error || !result.session) throwAuthError(error, 401, 'Invalid or expired sign-in code.');
    return mapSession(result.session);
  }

  async refreshToken(data: RefreshTokenDTO) {
    const { data: result, error } = await createSupabaseAuthClient(this.env).auth.refreshSession({
      refresh_token: data.refreshToken,
    });
    if (error || !result.session) throwAuthError(error, 401, 'Invalid or expired refresh token.');
    return mapSession(result.session);
  }

  async logout(accessToken: string) {
    await authenticatedAuthRequest(this.env, accessToken, '/logout?scope=local', 'POST');
    return { message: 'Signed out successfully.' };
  }

  async updateUser(accessToken: string, data: UpdateUserDTO) {
    const metadata: Record<string, unknown> = {};
    if (data.firstName !== undefined) metadata.first_name = data.firstName;
    if (data.lastName !== undefined) metadata.last_name = data.lastName;
    if (data.avatarUrl !== undefined) metadata.avatar_url = data.avatarUrl;
    const body: Record<string, unknown> = {};
    if (Object.keys(metadata).length) body.data = metadata;
    if (data.email !== undefined) body.email = data.email;
    const response = await authenticatedAuthRequest(this.env, accessToken, '/user', 'PUT', body);
    const user = (await response.json()) as User;
    return {
      user: mapAuthUser(user),
      ...(data.email !== undefined && data.email !== user.email
        ? {
            message: 'Check your email to confirm the email address change.',
          }
        : {}),
    };
  }

  async changePassword(user: User, data: ChangePasswordDTO) {
    if (!user.email)
      throw new HTTPException(400, { message: 'An email and password account is required.' });
    const client = createSupabaseAuthClient(this.env);
    const { data: verified, error } = await client.auth.signInWithPassword({
      email: user.email,
      password: data.currentPassword,
      options: { captchaToken: data.captchaToken },
    });
    if (error || !verified.session) throwAuthError(error, 400, 'Current password is incorrect.');
    try {
      if (verified.user.id !== user.id)
        throw new HTTPException(401, { message: 'Unable to verify your account.' });
      // Use the freshly verified session so Secure password change also works
      // when the caller's original session is more than 24 hours old.
      await authenticatedAuthRequest(this.env, verified.session.access_token, '/user', 'PUT', {
        password: data.newPassword,
      });
    } finally {
      // Password verification creates a temporary session. Revoke its refresh
      // token without signing out the caller's existing session or other devices.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    return { message: 'Password changed successfully.' };
  }
}
