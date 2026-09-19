'use client';

import { useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import type { ClientListItem } from '@/lib/types/client';

export function DeleteClientDialog({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  const { deleteClient, closeDialog } = useClients();
  const { state, execute } = useMutation(deleteClient);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('Client deleted successfully');
    }
  }, [state.status, closeDialog]);

  const isPending = state.status === 'pending';

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete client</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{client.full_name}</strong>? 
            This action cannot be undone and will remove all associated contact information and 
            activity records.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.status === 'error' && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void execute(client.client_id);
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_90%,black)]"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete client
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

