import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/hooks/use-session';
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
  Forfeited: 'bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive',
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
  const { isSystemAdmin } = useSession();
  const pillClass = STATUS_PILL_MAP[plot.status] ?? STATUS_PILL_MAP.Unregistered;

  return (
    <div className="min-w-[220px] p-3 font-sans" style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}>
      <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
        <div>
          <p className="text-sm font-bold text-foreground">{plot.name}</p>
          <p className="text-xs text-muted-foreground">{plot.siteName}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold', pillClass)}>
          {plot.isRegistered ? plot.status : 'Available'}
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
              <dt className="text-muted-foreground">Client:</dt>
              <dd className="font-medium text-foreground">{plot.clientName || 'Unassigned'}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status:</dt>
            <dd className="font-medium text-foreground">Available</dd>
          </div>
        )}
      </dl>

      {plot.isRegistered ? (
        <Button size="sm" className="mt-3 w-full cursor-pointer gap-1.5" onClick={onViewDetails}>
          <span>View Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="sm" className="mt-3 w-full cursor-pointer gap-1.5" onClick={onRegisterLot}>
          <Plus className="h-3.5 w-3.5" />
          <span>+ Register Lot</span>
        </Button>
      )}

      {!plot.isRegistered && isEditorMode && isSystemAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDeletePlot}
          className="mt-2 w-full cursor-pointer gap-1.5 border-[color-mix(in_srgb,var(--destructive)_40%,white)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_18%,white)]"
        >
          <Trash2 className="h-3 w-3" />
          <span>Delete Plot</span>
        </Button>
      )}
    </div>
  );
}
