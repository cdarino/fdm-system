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

/**
 * Archiving is reversible and keeps every record, so this confirms without the
 * destructive styling the delete dialog uses. The two sit next to each other in
 * the row menu and must not look like the same weight of action.
 */
export function ArchiveClientDialog({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  const { archiveClient, closeDialog } = useClients();
  const { state, execute } = useMutation(archiveClient);

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('Client archived');
    }
  }, [state.status, closeDialog]);

  const isPending = state.status === 'pending';

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {client.full_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Contacts, documents and activity history are all kept, and the client can be
            restored later.
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
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Archive client
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
