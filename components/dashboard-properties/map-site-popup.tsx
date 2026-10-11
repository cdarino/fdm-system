import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
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
import { useSession } from '@/lib/hooks/use-session';
import { reopenPropertyLotForSale } from '@/lib/actions/properties';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface LotPlotProperties {
  id: string;
  lotKey: string;
  siteLotKey: string;
  propertyId: string;
  siteId: string;
  siteName: string;
  block: number;
  lot: number;
  name: string;
  status: string;
  isRegistered: boolean;
  areaSize: number;
  pricePerSqm: number;
  totalPrice: number;
  clientName: string;
  titleNumber?: string;
  forfeitedAt?: string;
  isSiteArchived?: boolean;
  centerLng: number;
  centerLat: number;
  topLat: number;
}

export interface MapSitePopupProps {
  plot: LotPlotProperties;
  isEditorMode?: boolean;
  onViewDetails: () => void;
  onRegisterLot: () => void;
  onDeletePlot: () => void;
}

export const STATUS_PILL_MAP: Record<string, string> = {
  Open: 'bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success',
  Reserved: 'bg-sidebar-accent text-accent-blue-foreground',
  Sold: 'bg-row-active text-accent-gold-foreground',
  Forfeited: 'bg-[color-mix(in_srgb,#8B5CF6_12%,white)] text-[#7C3AED]',
  Closed: 'bg-muted text-muted-foreground',
  Available: 'bg-muted text-muted-foreground',
  Unregistered: 'bg-muted text-muted-foreground',
};

export function MapSitePopup({
  plot,
  isEditorMode,
  onViewDetails,
  onRegisterLot,
  onDeletePlot,
}: MapSitePopupProps) {
  const router = useRouter();
  const { isSystemAdmin } = useSession();
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const daysRemaining = plot.forfeitedAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(plot.forfeitedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : 0;
  const isGracePeriodActive = daysRemaining > 0;

  // Reopen forfeited lot from map popup with early grace period override
  async function handleReopen() {
    if (isReopening || !plot.propertyId) return;
    setIsReopening(true);
    try {
      const res = await reopenPropertyLotForSale({
        propertyId: plot.propertyId,
        allowEarlyReopen: isGracePeriodActive,
      });
      if (res.success) {
        toast.success(`${plot.name} reopened for sale`);
        setIsReopenOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reopen lot');
    } finally {
      setIsReopening(false);
    }
  }

  const pillClass = STATUS_PILL_MAP[plot.status] ?? STATUS_PILL_MAP.Closed ?? STATUS_PILL_MAP.Unregistered;

  return (
    <div className="min-w-[220px] p-3 font-sans" style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}>
      <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
        <div>
          <p className="text-sm font-bold text-foreground">{plot.name}</p>
          <p className="text-xs text-muted-foreground">{plot.siteName}</p>
        </div>
        {plot.isSiteArchived && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border bg-muted">
            Archived
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold', pillClass)}>
          {plot.isRegistered ? plot.status : 'Closed'}
        </span>
      </div>

      <dl className="mt-2.5 space-y-1 border-t border-border pt-2 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Area:</dt>
          <dd className="font-medium text-foreground">{plot.areaSize} sqm</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{plot.isRegistered ? 'Price/sqm:' : 'Est. Price/sqm:'}</dt>
          <dd className="font-medium text-foreground">₱{Number(plot.pricePerSqm).toLocaleString()}</dd>
        </div>
        {plot.isRegistered ? (
          <>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Price:</dt>
              <dd className="font-semibold text-primary">₱{Number(plot.totalPrice).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Title No:</dt>
              <dd className="font-mono text-foreground">{plot.titleNumber || 'Pending'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Client:</dt>
              <dd className="font-medium text-foreground">{plot.clientName || 'Unassigned'}</dd>
            </div>
            {plot.status === 'Forfeited' && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Grace Period:</dt>
                <dd className={cn('font-medium', isGracePeriodActive ? 'text-[#7C3AED]' : 'text-success')}>
                  {isGracePeriodActive ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left` : 'Ended'}
                </dd>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status:</dt>
            <dd className="font-medium text-foreground">Closed</dd>
          </div>
        )}
      </dl>

      {plot.isRegistered ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <Button size="sm" className="w-full cursor-pointer gap-1.5" onClick={onViewDetails}>
            <span>View Details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>

          {plot.status === 'Forfeited' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full cursor-pointer gap-1.5 border-[color-mix(in_srgb,#8B5CF6_40%,white)] text-[#7C3AED] hover:bg-[color-mix(in_srgb,#8B5CF6_10%,white)]"
              onClick={() => setIsReopenOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>
                {isGracePeriodActive
                  ? `Reopen (${daysRemaining}d left)`
                  : 'Reopen Lot for Sale'}
              </span>
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          <Button
            size="sm"
            variant="quiet"
            className="w-full cursor-pointer gap-1.5"
            onClick={onViewDetails}
          >
            <span>View Details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            disabled={plot.isSiteArchived}
            title={plot.isSiteArchived ? 'Restore site before registering lots' : undefined}
            className="w-full cursor-pointer gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={plot.isSiteArchived ? undefined : onRegisterLot}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Open Lot for Sale</span>
          </Button>
        </div>
      )}

      {!plot.isRegistered && isEditorMode && isSystemAdmin && (
        <Button
          variant="outline"
          size="sm"
          disabled={plot.isSiteArchived}
          title={plot.isSiteArchived ? 'Restore site before deleting plots' : undefined}
          onClick={plot.isSiteArchived ? undefined : onDeletePlot}
          className="mt-2 w-full cursor-pointer gap-1.5 border-[color-mix(in_srgb,var(--destructive)_40%,white)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_18%,white)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3 w-3" />
          <span>Delete Plot</span>
        </Button>
      )}

      <AlertDialog
        open={isReopenOpen}
        onOpenChange={(open) => !isReopening && setIsReopenOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGracePeriodActive ? 'Reopen Lot Early?' : 'Reopen Lot for Sale?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGracePeriodActive
                ? `The legal 30-day grace period is still active (${daysRemaining} day${
                    daysRemaining === 1 ? '' : 's'
                  } remaining). Reopening early will terminate the holding window and make this lot immediately available for new buyers. Proceed anyway?`
                : 'The 30-day grace period has elapsed. This lot will be restored to Open status and made available for new buyers.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReopening}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleReopen();
              }}
              disabled={isReopening}
            >
              {isReopening && <Loader2 className="h-4 w-4 animate-spin" />}
              {isGracePeriodActive ? 'Reopen Lot Early' : 'Reopen Lot'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
