'use client';

import { useState } from 'react';
import { Calendar, FileCheck, Loader2 } from 'lucide-react';
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
import { useLandTitles } from '@/lib/hooks/use-land-titles';
import { getClearanceProgress } from './title-record-card';
import type { LandTitle, TitleStatus } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

interface TitleClearanceTabProps {
  title: LandTitle;
  onStatusChange: (status: TitleStatus) => void;
  isUpdatingStatus: boolean;
}

export function TitleClearanceTab({
  title,
  onStatusChange,
  isUpdatingStatus,
}: TitleClearanceTabProps) {
  const { canEdit, isAdmin } = useLandTitles();
  const [confirmReadyOpen, setConfirmReadyOpen] = useState(false);

  const clearance = getClearanceProgress(title.clearance_started_at);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-5 bg-card space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">30-Day Clearance Period</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {clearance.isComplete
                ? 'Clearance window has ended. Title is eligible to be marked ready for claim.'
                : clearance.targetDate
                ? `Clears on ${DATE_FORMAT.format(clearance.targetDate)} (${Math.max(0, clearance.daysRemaining)} days remaining)`
                : 'Clearance period active'}
            </p>
          </div>

          {title.status === 'Clearance Period' && canEdit && (
            <Button
              size="sm"
              disabled={isUpdatingStatus || (!clearance.isComplete && !isAdmin)}
              onClick={() => setConfirmReadyOpen(true)}
              className="text-sm gap-2 h-9 px-4 shrink-0"
            >
              <FileCheck className="h-4 w-4" />
              Mark Ready for Claim
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Alert to Mark Ready for Claim */}
      <AlertDialog open={confirmReadyOpen} onOpenChange={setConfirmReadyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearance.isComplete
                ? 'Mark Title Ready for Claim?'
                : 'Mark Ready for Claim (Early Clearance)?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {clearance.isComplete
                ? 'The 30-day internal clearance period has concluded. This will move the title to Ready for Claim in the vault and enable client notice letters or turnover to the buyer.'
                : `The 30-day clearance period is still ongoing (${Math.max(0, clearance.daysRemaining)} days remaining). Marking this ready now will bypass the remaining clearance window and make the title ready for client release. Are you sure you want to proceed?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdatingStatus}
              onClick={() => {
                setConfirmReadyOpen(false);
                onStatusChange('Ready for Claim');
              }}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {isUpdatingStatus ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
