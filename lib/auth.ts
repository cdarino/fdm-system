import { createClient } from "@/lib/supabase/client";

export interface LoginParams {
  email: string;
  password: string;
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
