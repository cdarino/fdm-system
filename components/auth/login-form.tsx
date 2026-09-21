'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { login } from '@/lib/auth';

export function useLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
      // Without this the router can serve a cached RSC payload rendered before
      // the auth cookie existed, so the proxy bounces straight back to /login.
      // Refresh router so newly set auth cookies take effect in RSC payload.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login. Please try again.');
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    error,
    handleSubmit,
  };
}

/**
 * Interactive part of the login page.
 *
 * Reads the `next` query param via `useSearchParams`, which opts this subtree
 * out of prerendering — it must stay inside a <Suspense> boundary so the rest
 * of the page can still be prerendered. See app/(auth)/login/page.tsx.
 */
export function LoginForm() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    error,
    handleSubmit,
  } = useLoginForm();

  return (
    <>
      {/* Error Alert */}
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive bg-[color-mix(in_srgb,var(--destructive)_10%,white)] p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Login Card */}
      <Card variant="prominent" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-medium text-sm">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary rounded-lg"
              disabled={isLoading}
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium text-sm">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary rounded-lg"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] rounded-lg h-11 font-semibold mt-6"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-card text-muted-foreground">or</span>
          </div>
        </div>

        {/* Password recovery */}
        <div className="flex flex-col space-y-3">
          <Link href="/auth/forgot-password">
            <Button
              variant="ghost"
              className="w-full text-secondary hover:bg-[color-mix(in_srgb,var(--secondary)_15%,white)] font-medium"
            >
              Forgot Password?
            </Button>
          </Link>
        </div>
      </Card>
    </>
  );
}

/** Placeholder shown while the login form hydrates. Mirrors the card's footprint. */
export function LoginFormFallback() {
  return (
    <Card variant="prominent" padding="lg">
      <div className="animate-pulse space-y-5">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-border" />
          <div className="h-9 w-full rounded-lg bg-background border border-border" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-border" />
          <div className="h-9 w-full rounded-lg bg-background border border-border" />
        </div>
        <div className="h-11 w-full rounded-lg bg-border mt-6" />
        <div className="h-9 w-full rounded-lg bg-background" />
      </div>
    </Card>
  );
}
