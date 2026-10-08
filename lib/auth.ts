import { createClient } from "@/lib/supabase/client";

export interface LoginParams {
  email: string;
  password: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  repeatPassword?: string;
}

export interface ResetPasswordParams {
  email: string;
  redirectTo?: string;
}

export interface VerifyResetCodeParams {
  email: string;
  token: string;
}

export interface UpdatePasswordParams {
  password: string;
  confirmPassword?: string;
}

/** Minimum accepted password length. Mirrors Supabase's minimum_password_length. */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Log in an existing user using email & password.
 */
export async function login({ email, password }: LoginParams) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign up a new user using email & password.
 * Note: New user registration may be restricted. Contact admins for account creation.
 */
export async function signUp({ email, password, repeatPassword }: SignUpParams) {
  if (repeatPassword !== undefined && password !== repeatPassword) {
    throw new Error("Passwords do not match");
  }

  const supabase = createClient();
  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/confirm?next=/login`
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) throw error;
  return data;
}

export async function logout() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) throw error;
}

/**
 * Send password reset email containing a 6-digit recovery code and fallback link.
 * Note that this differs from updatePassword(), which directly changes the password of the currently logged in user.
 */
export async function resetPassword({ email, redirectTo }: ResetPasswordParams) {
  const supabase = createClient();
  const defaultRedirect =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/update-password`
      : undefined;

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo ?? defaultRedirect,
  });

  if (error) throw error;
  return data;
}

/**
 * Verify a 6-digit password recovery OTP code sent to the user's email.
 * Establishes a recovery session so `updatePassword()` can be called next.
 */
export async function verifyResetCode({ email, token }: VerifyResetCodeParams) {
  const cleanedToken = token.trim();
  if (!cleanedToken) {
    throw new Error("Please enter the verification code.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: cleanedToken,
    type: "recovery",
  });

  if (error) throw error;
  return data;
}

/**
 * Update user password (when logged in or from reset flow).
 * Note that this differs from resetPassword(), which sends an email to the user to reset their password.
 */
export async function updatePassword({
  password,
  confirmPassword,
}: UpdatePasswordParams) {
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) throw error;
  return data;
}

export interface ChangePasswordParams {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Changes the signed-in user's password after verifying the current one.
 *
 * Supabase's `updateUser` does not check the existing password, so the current
 * one is verified by re-authenticating first. That re-auth is for the same
 * account, so it simply refreshes the active session.
 */
export async function changePassword({
  currentPassword,
  newPassword,
  confirmPassword,
}: ChangePasswordParams) {
  if (newPassword !== confirmPassword) {
    throw new Error("New passwords do not match.");
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (newPassword === currentPassword) {
    throw new Error("New password must be different from your current password.");
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    throw new Error("You must be signed in to change your password.");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    throw new Error("Your current password is incorrect.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
