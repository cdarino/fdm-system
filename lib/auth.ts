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

export interface UpdatePasswordParams {
  password: string;
}

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
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

/**
 * Send password reset email.
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
 * Update user password (when logged in or from reset flow).
 */
export async function updatePassword({ password }: UpdatePasswordParams) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) throw error;
  return data;
}
