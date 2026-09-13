'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { RoleCheckboxList } from '@/components/dashboard/role-checkbox-list';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { useAdminUsers } from '@/lib/hooks/use-admin-users';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';

export function useCreateUserForm() {
  const { roles, createUser, closeDialog } = useAdminUsers();
  const { state, execute } = useMutation(createUser);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('User created successfully!');
    }
  }, [state.status, closeDialog]);

  function handleRoleChange(id: string, checked: boolean) {
    setSelectedRoles((prev) => (checked ? [...prev, id] : prev.filter((r) => r !== id)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setValidationError('First name and last name are required');
      return;
    }
    if (!email || !password) {
      setValidationError('Email and password are required');
      return;
    }
    if (selectedRoles.length === 0) {
      setValidationError('Please select at least one role');
      return;
    }

    execute({
      email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleIds: selectedRoles,
    });
  }

  const isPending = state.status === 'pending';
  const displayError = validationError || (state.status === 'error' ? state.error : null);

  return {
    roles,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    selectedRoles,
    handleRoleChange,
    handleSubmit,
    closeDialog,
    isPending,
    displayError,
  };
}

export function CreateUserModal() {
  const {
    roles,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    selectedRoles,
    handleRoleChange,
    handleSubmit,
    closeDialog,
    isPending,
    displayError,
  } = useCreateUserForm();

  return (
    <div className="fixed inset-0 bg-[color-mix(in_srgb,black_20%,transparent)] flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-card text-foreground border-border rounded-2xl shadow-lg">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Create New User</h2>
          <button onClick={closeDialog} className="p-1 hover:bg-background rounded-lg transition-colors" disabled={isPending}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {displayError && (
            <div className="p-4 bg-[color-mix(in_srgb,var(--destructive)_10%,white)] border border-[color-mix(in_srgb,var(--destructive)_30%,white)] rounded-lg">
              <p className="text-sm text-destructive">{displayError}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="firstName"
              label="First Name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Juan"
              required
              disabled={isPending}
            />
            <FormField
              id="lastName"
              label="Last Name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Dela Cruz"
              required
              disabled={isPending}
            />
          </div>

          <FormField
            id="email"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={isPending}
          />

          <FormField
            id="password"
            label="Temporary Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={isPending}
            hint="User can change this after first login"
          />

          <div className="space-y-3">
            <Label className="text-foreground font-medium text-sm">Assign Roles</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <RoleCheckboxList roles={roles} selectedIds={selectedRoles} onChange={handleRoleChange} disabled={isPending} />
            </div>
            {selectedRoles.length === 0 && <p className="text-xs text-muted-foreground">Select at least one role.</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isPending}
              className="flex-1 bg-card border-border text-foreground hover:bg-background rounded-lg"
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              isLoading={isPending}
              loadingText="Creating..."
              disabled={selectedRoles.length === 0}
              className="flex-1 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)] rounded-lg"
            >
              Create User
            </LoadingButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
