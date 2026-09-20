'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { changePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';

export function useChangePasswordForm() {
  const { state, execute, reset } = useMutation(changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isPending = state.status === 'pending';
  const error = state.status === 'error' ? state.error : null;
  const isComplete = Boolean(currentPassword && newPassword && confirmPassword);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    reset();
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await execute({ currentPassword, newPassword, confirmPassword });
    if (ok) {
      toast.success('Password updated. Use it the next time you sign in.');
      resetForm();
    }
  }

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isPending,
    error,
    isComplete,
    resetForm,
    handleSubmit,
  };
}

export function ChangePasswordForm() {
  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isPending,
    error,
    isComplete,
    resetForm,
    handleSubmit,
  } = useChangePasswordForm();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Enter your current password, then choose a new one of at least{' '}
          {MIN_PASSWORD_LENGTH} characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <FormField
            id="currentPassword"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={isPending}
          />
          <FormField
            id="newPassword"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            disabled={isPending}
          />
          <FormField
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            disabled={isPending}
          />

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <LoadingButton
              type="submit"
              isLoading={isPending}
              loadingText="Updating..."
              disabled={!isComplete}
            >
              Update Password
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={resetForm}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
