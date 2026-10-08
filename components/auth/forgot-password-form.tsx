"use client";

import { cn } from "@/lib/utils";
import {
  resetPassword,
  verifyResetCode,
  updatePassword,
  logout,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ResetStep = "email" | "verify" | "reset";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

/**
 * 3-step progressive password reset form:
 * 1. Request a 6-digit reset code via email (`resetPassword`)
 * 2. Verify the 6-digit OTP code (`verifyResetCode`) with resend cooldown & email change
 * 3. Set and confirm a new password (`updatePassword`), then sign out and redirect to `/login`
 */
export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await resetPassword({ email });
      setStep("verify");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);

    try {
      await resetPassword({ email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("A new verification code has been sent to your email.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await verifyResetCode({ email, token: code });
      setStep("reset");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid or expired verification code"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await updatePassword({ password, confirmPassword });
      await logout();
      toast.success(
        "Password updated! Please sign in with your new password."
      );
      router.push("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep("email");
    setCode("");
    setError(null);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {step === "email" && (
        <Card>
          <CardHeader>
            <CardTitle size="xl">Reset Your Password</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a 6-digit verification
              code to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendCode}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    required
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending code..." : "Send verification code"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "verify" && (
        <Card>
          <CardHeader>
            <CardTitle size="xl">Enter Verification Code</CardTitle>
            <CardDescription>
              We sent a {OTP_LENGTH}-digit code to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="otp-code">Verification code</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={OTP_LENGTH}
                    placeholder="000000"
                    required
                    disabled={isLoading}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
                    }
                    className="text-center font-mono text-lg tracking-widest"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || code.length < OTP_LENGTH}
                >
                  {isLoading ? "Verifying..." : "Verify code"}
                </Button>
              </div>
              <div className="mt-4 flex flex-col gap-2 text-center text-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cooldown > 0 || isResending || isLoading}
                  onClick={handleResendCode}
                  className="w-full"
                >
                  {isResending
                    ? "Resending..."
                    : cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : "Resend code"}
                </Button>
                <div>
                  Wrong email?{" "}
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Change email
                  </button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "reset" && (
        <Card>
          <CardHeader>
            <CardTitle size="xl">Set New Password</CardTitle>
            <CardDescription>
              Choose a new password of at least {MIN_PASSWORD_LENGTH}{" "}
              characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    disabled={isLoading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save new password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

