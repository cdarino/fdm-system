'use client';

import { useState } from 'react';
import { AlertOctagon, BadgeCheck, FileCheck, Loader2, Undo2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import { useMutation } from '@/lib/hooks/use-mutation';
import { useSession } from '@/lib/hooks/use-session';
import type { ClientProperty } from '@/lib/types/client';

const DATE = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

interface ClientPropertyClearanceProps {
  property: ClientProperty;
}

/**
 * Manages lot sale clearance between full payment and title, or forfeiture.
 */
export function ClientPropertyClearance({ property }: ClientPropertyClearanceProps) {
  const { clearAccount, undoClearance, forfeitLot } = useClientDetail();
  const { hasPermission } = useSession();
  const canClear = hasPermission('billing.update');
  const canForfeit = hasPermission('properties.update') || hasPermission('billing.update');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isForfeitOpen, setIsForfeitOpen] = useState(false);
  const [forfeitReason, setForfeitReason] = useState('');
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

  const forfeit = useMutation(
    (reason?: string) => forfeitLot(property.property_id, reason),
    {
      onSuccess: () => {
        setIsForfeitOpen(false);
        setForfeitReason('');
        toast.success(`${lotName} marked as forfeited`);
      },
    }
  );

  if (property.has_title) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileCheck className="h-3.5 w-3.5" />
        Title record created by Legal
      </p>
    );
  }

  if (property.status === 'Forfeited') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#7C3AED]">
        <AlertOctagon className="h-3.5 w-3.5" />
        Lot forfeited. Under 30-day grace period.
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

  if (!canClear && !canForfeit) {
    return <p className="text-xs text-muted-foreground">Payments ongoing. Billing clears the account once fully paid.</p>;
  }

  const isPendingClear = clear.state.status === 'pending';
  const isPendingForfeit = forfeit.state.status === 'pending';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canClear && (
          <Button size="sm" variant="quiet" className="h-8 gap-1.5 text-xs" onClick={() => setIsConfirmOpen(true)}>
            <BadgeCheck className="h-3.5 w-3.5" />
            Mark cleared by Billing
          </Button>
        )}
        {canForfeit && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs border-[color-mix(in_srgb,#8B5CF6_40%,white)] text-[#7C3AED] hover:bg-[color-mix(in_srgb,#8B5CF6_10%,white)]"
            onClick={() => setIsForfeitOpen(true)}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Forfeit
          </Button>
        )}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={(open) => !isPendingClear && setIsConfirmOpen(open)}>
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
            <AlertDialogCancel disabled={isPendingClear}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void clear.execute(property.account_id!);
              }}
              disabled={isPendingClear}
            >
              {isPendingClear && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark cleared
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isForfeitOpen} onOpenChange={(open) => !isPendingForfeit && setIsForfeitOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forfeit {lotName}?</AlertDialogTitle>
            <AlertDialogDescription>
              The lot will enter the 30-day redemption grace period and cannot be reassigned to another buyer until reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-1">
            <label htmlFor="forfeit-reason" className="text-xs font-medium text-foreground">
              Reason / remarks (optional)
            </label>
            <Textarea
              id="forfeit-reason"
              placeholder="e.g. Account defaulted after 3 notices"
              value={forfeitReason}
              onChange={(e) => setForfeitReason(e.target.value)}
              className="text-xs min-h-[70px]"
              disabled={isPendingForfeit}
            />
          </div>

          {forfeit.state.status === 'error' && <p className="text-xs text-destructive">{forfeit.state.error}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPendingForfeit}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
              onClick={(e) => {
                e.preventDefault();
                void forfeit.execute(forfeitReason.trim() || undefined);
              }}
              disabled={isPendingForfeit}
            >
              {isPendingForfeit && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirm Forfeiture
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
