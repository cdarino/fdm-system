'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useClients } from '@/lib/hooks/use-clients-page';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import { z } from 'zod';

const minimalClientSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
});

type MinimalClientForm = z.infer<typeof minimalClientSchema>;

export function CreateClientModal({ open }: { open: boolean }) {
  const router = useRouter();
  const { createClient, closeDialog } = useClients();

  const form = useForm<MinimalClientForm>({
    resolver: zodResolver(minimalClientSchema),
    defaultValues: {
      full_name: '',
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = form;

  const { state, execute } = useMutation(createClient, {
    setError: form.setError,
    onSuccess: (client: any) => {
      closeDialog();
      toast.success('Client created successfully');
      // Navigate to the client's detail page
      router.push(`/dashboard/clients/${client.client_id}`);
    },
  });

  useEffect(() => {
    if (open) {
      reset({ full_name: '' });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (data) => {
    await execute({ full_name: data.full_name });
  });

  const isPending = state.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>
            Enter the client's full name to create their record. You can complete their profile details later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <FormField
            id="create-client-name"
            label="Full name"
            placeholder="Juan dela Cruz"
            error={errors.full_name?.message}
            autoFocus
            {...register('full_name')}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" isLoading={isPending} loadingText="Creating...">
              Create client
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
