'use client';

import { useState } from 'react';
import { BadgeCheck, FileCheck, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import { useMutation } from '@/lib/hooks/use-mutation';
import { useSession } from '@/lib/hooks/use-session';
import type { ClientProperty } from '@/lib/types/client';

const DATE = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

interface ClientPropertyClearanceProps {
  property: ClientProperty;
}

/**
 * Where a lot's sale stands between full payment and the title: Billing
 * clears the account, then Legal creates the title on the Legal page.
 */
export function ClientPropertyClearance({ property }: ClientPropertyClearanceProps) {
  const { clearAccount, undoClearance } = useClientDetail();
  const { hasPermission } = useSession();
  const canClear = hasPermission('billing.update');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const lotName = `Block ${property.block_number} Lot ${property.lot_number}`;

  const clear = useMutation(clearAccount, {
    onSuccess: () => {
      setIsConfirmOpen(false);
      toast.success(`${lotName} cleared by Billing`);
    },
  });

  const undo = useMutation(undoClearance, {
    onSuccess: () => {
      toast.success(`Clearance undone for ${lotName}`);
    },
  });

  if (property.has_title) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileCheck className="h-3.5 w-3.5" />
        Title record created by Legal
      </p>
    );
  }

  if (!property.account_id) return null;

  if (property.cleared_at) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-foreground">
          <BadgeCheck className="h-3.5 w-3.5 text-success" />
          Cleared by Billing {DATE.format(new Date(property.cleared_at))}. Awaiting title from Legal.
        </p>
        {canClear && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            disabled={undo.state.status === 'pending'}
            onClick={() => void undo.execute(property.account_id!)}
          >
            {undo.state.status === 'pending' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
            Undo
          </Button>
        )}
      </div>
    );
  }

  if (!canClear) {
    return <p className="text-xs text-muted-foreground">Payments ongoing. Billing clears the account once fully paid.</p>;
  }

  const isPending = clear.state.status === 'pending';

  return (
    <>
      <Button size="sm" variant="quiet" className="h-8 gap-1.5 text-xs" onClick={() => setIsConfirmOpen(true)}>
        <BadgeCheck className="h-3.5 w-3.5" />
        Mark cleared by Billing
      </Button>

      <AlertDialog open={isConfirmOpen} onOpenChange={(open) => !isPending && setIsConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear {lotName} as fully paid?</AlertDialogTitle>
            <AlertDialogDescription>
              The lot will be marked Sold and sent to Legal to create the title. You can undo this
              until Legal creates the title.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {clear.state.status === 'error' && <p className="text-xs text-destructive">{clear.state.error}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void clear.execute(property.account_id!);
              }}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark cleared
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
