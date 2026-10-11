'use client';

import { useState } from 'react';
import { ArrowRight, Inbox, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { useLandTitles, lotRefLabel, type TitleDialogItem } from '@/lib/hooks/use-land-titles';
import { useMutation } from '@/lib/hooks/use-mutation';
import type { LandTitle } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

interface TitleIntakeTabProps {
  item: TitleDialogItem;
  onStartedProcessing?: (title: LandTitle) => void;
}

export function TitleIntakeTab({ item, onStartedProcessing }: TitleIntakeTabProps) {
  const { createTitle, revertClearance, canCreate, canEdit } = useLandTitles();
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false);

  const activeTitle = item.type === 'title' ? item.data : null;
  const activeAwaiting = item.type === 'awaiting' ? item.data : null;

  const clientName = activeTitle?.client?.full_name ?? activeAwaiting?.client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(activeTitle?.property ?? activeAwaiting?.property);

  const { state: startState, execute: runStart } = useMutation(createTitle, {
    onSuccess: (created) => {
      toast.success(`Legal processing started for ${propertyRef}`);
      onStartedProcessing?.(created);
    },
  });

  const { state: returnState, execute: runReturn } = useMutation(revertClearance, {
    onSuccess: () => {
      toast.success(`Account for ${propertyRef} returned to Billing`);
      setConfirmReturnOpen(false);
    },
  });

  const isStarting = startState.status === 'pending';
  const isReturning = returnState.status === 'pending';

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <Inbox className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Billing cleared this account as fully paid
          {activeAwaiting?.cleared_at ? (
            <>
              {' '}on{' '}
              <span className="font-semibold text-foreground">
                {DATE_FORMAT.format(new Date(activeAwaiting.cleared_at))}
              </span>
            </>
          ) : null}
          . {activeAwaiting ? 'Accept this account to start document preparation, or return it to billing if there is a discrepancy.' : 'Account intake completed.'}
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account Intake Overview
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Principal Buyer:</span>
            <p className="font-medium text-foreground">{clientName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Co-Buyers:</span>
            <p className="font-medium text-foreground">
              {activeAwaiting && activeAwaiting.co_buyers.length > 0
                ? activeAwaiting.co_buyers.join(', ')
                : 'None'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Property Lot:</span>
            <p className="font-medium text-foreground">{propertyRef}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Title Number on Lot:</span>
            <p className="font-mono text-foreground">
              {activeTitle?.property?.title_number ?? activeAwaiting?.property.title_number ?? 'Not yet recorded'}
            </p>
          </div>
        </div>
      </div>

      {activeAwaiting && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          {canEdit && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isReturning || isStarting}
              onClick={() => setConfirmReturnOpen(true)}
              className="text-sm h-9 px-4 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Send back to Billing
            </Button>
          )}
          {canCreate && (
            <Button
              type="button"
              size="sm"
              className="gap-2 ml-auto text-sm h-9 px-4"
              disabled={isStarting || isReturning}
              onClick={() => void runStart(activeAwaiting.property.property_id)}
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Start Legal Processing
            </Button>
          )}
        </div>
      )}

      {/* Confirmation Alert to Return Account to Billing */}
      <AlertDialog open={confirmReturnOpen} onOpenChange={setConfirmReturnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return account to Billing?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will remove this account from Legal intake and return it to Billing as uncleared.
              Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReturning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isReturning}
              onClick={(e) => {
                e.preventDefault();
                if (activeAwaiting) void runReturn(activeAwaiting.account_id);
              }}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              {isReturning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirm Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
