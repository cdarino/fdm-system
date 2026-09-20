'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useClients } from '@/lib/hooks/use-clients-page';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import type { ClientListItem } from '@/lib/types/client';

const clientSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required'),
  address: z.string().trim().optional(),
  tin_number: z
    .string()
    .trim()
    .refine(
      (val) => !val || /^\d{3}-\d{3}-\d{3}$/.test(val),
      'TIN must follow the format XXX-XXX-XXX with numbers only'
    )
    .optional(),
  status: z.enum(['Active', 'Inactive']),
});

type ClientFormData = z.infer<typeof clientSchema>;

export function EditClientModal({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  const { updateClient, closeDialog } = useClients();
  const { state, execute } = useMutation(updateClient);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: client.full_name,
      address: client.address ?? '',
      tin_number: client.tin_number ?? '',
      status: client.status === 'Inactive' ? 'Inactive' : 'Active',
    },
  });

  const { register, control, handleSubmit, reset, formState: { errors } } = form;

  useEffect(() => {
    if (open) {
      reset({
        full_name: client.full_name,
        address: client.address ?? '',
        tin_number: client.tin_number ?? '',
        status: client.status === 'Inactive' ? 'Inactive' : 'Active',
      });
    }
  }, [open, client, reset]);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('Client updated successfully');
    } else if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state, closeDialog]);

  const onSubmit = handleSubmit(async (data) => {
    await execute(client.client_id, {
      full_name: data.full_name,
      address: data.address?.trim() || null,
      tin_number: data.tin_number?.trim() || null,
      status: data.status,
    });
  });

  const isPending = state.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <FormField
            id="edit-client-name"
            label="Full name"
            placeholder="Juan dela Cruz"
            error={errors.full_name?.message}
            {...register('full_name')}
          />

          <FormField
            id="edit-client-address"
            label="Address"
            placeholder="Davao City, Philippines"
            error={errors.address?.message}
            {...register('address')}
          />

          <FormField
            id="edit-client-tin"
            label="TIN number"
            placeholder="123-456-789"
            hint="Format: XXX-XXX-XXX (9 digits)"
            error={errors.tin_number?.message}
            {...register('tin_number')}
          />

          <div className="space-y-2">
            <Label htmlFor="edit-client-status" className="text-sm font-medium text-foreground">
              Status
            </Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-client-status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" isLoading={isPending} loadingText="Saving...">
              Save changes
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
