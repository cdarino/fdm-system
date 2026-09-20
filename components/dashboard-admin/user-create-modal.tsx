'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { RoleCheckboxList } from './role-checkbox-list';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdminUsers } from '@/lib/hooks/use-admin-users';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';

const createUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleIds: z.array(z.string()).min(1, 'Please select at least one role'),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export function useCreateUserForm() {
  const { roles, createUser, closeDialog } = useAdminUsers();
  const { state, execute } = useMutation(createUser);

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleIds: [],
    },
  });

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('User created successfully!');
    }
  }, [state.status, closeDialog]);

  const onSubmit = form.handleSubmit((data) => {
    execute(data);
  });

  const isPending = state.status === 'pending';
  const displayError = state.status === 'error' ? state.error : null;

  return {
    form,
    roles,
    onSubmit,
    closeDialog,
    isPending,
    displayError,
  };
}

export function CreateUserModal({ open }: { open: boolean }) {
  const { form, roles, onSubmit, closeDialog, isPending, displayError } = useCreateUserForm();
  const { register, control, watch, formState: { errors } } = form;
  const selectedRoles = watch('roleIds') ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent
        className="w-full max-w-md bg-card text-foreground border-border rounded-2xl shadow-lg p-0 gap-0"
        showCloseButton={!isPending}
      >
        <DialogHeader className="p-6 border-b border-border">
          <DialogTitle className="text-xl font-bold text-foreground">Create New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
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
              placeholder="Juan"
              disabled={isPending}
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <FormField
              id="lastName"
              label="Last Name"
              type="text"
              placeholder="Dela Cruz"
              disabled={isPending}
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <FormField
            id="email"
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            disabled={isPending}
            error={errors.email?.message}
            {...register('email')}
          />

          <FormField
            id="password"
            label="Temporary Password"
            type="password"
            placeholder="••••••••"
            disabled={isPending}
            hint="User can change this after first login"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="space-y-3">
            <Label className="text-foreground font-medium text-sm">Assign Roles</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <Controller
                name="roleIds"
                control={control}
                render={({ field }) => (
                  <RoleCheckboxList
                    roles={roles}
                    selectedIds={field.value}
                    onChange={(id, checked) => {
                      const next = checked ? [...field.value, id] : field.value.filter((r) => r !== id);
                      field.onChange(next);
                    }}
                    disabled={isPending}
                  />
                )}
              />
            </div>
            {errors.roleIds?.message && (
              <p className="text-xs text-destructive">{errors.roleIds.message}</p>
            )}
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
      </DialogContent>
    </Dialog>
  );
}
