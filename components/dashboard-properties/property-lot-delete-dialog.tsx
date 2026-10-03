'use client';

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
import { Loader2, AlertTriangle } from 'lucide-react';
import { usePropertyLots, lotLabel } from '@/lib/hooks/use-property-lots';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import { getArchiveEligibility } from '@/lib/utils/archive-rules';
import type { PropertyLotWithClient } from '@/lib/types/property';

export function DeletePropertyLotDialog({
  lot,
  open,
  onOpenChange,
  onSuccess,
}: {
  lot: PropertyLotWithClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { deleteLot } = usePropertyLots();
  const isArchived = Boolean(lot.is_archived);
  const eligibility = getArchiveEligibility(isArchived, lot.archived_at);

  const { state, execute } = useMutation(deleteLot, {
    onSuccess: () => {
      onOpenChange(false);
      toast.success(`${lotLabel(lot)} permanently deleted`);
      onSuccess?.();
    },
  });

  const isPending = state.status === 'pending';

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Property Lot</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently delete <strong>{lotLabel(lot)}</strong>?
            This action cannot be undone and will permanently remove this lot record.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!eligibility.isEligibleForDelete && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-[color-mix(in_srgb,var(--destructive)_10%,white)] p-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{eligibility.tooltipReason}</span>
          </div>
        )}

        {state.status === 'error' && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void execute(lot.property_id);
            }}
            disabled={isPending || !eligibility.isEligibleForDelete}
            className="bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_90%,black)]"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete Property Lot
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
