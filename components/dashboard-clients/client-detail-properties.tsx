'use client';

import { LandPlot, MapPin, DollarSign, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { PROPERTY_STATUS_VARIANT } from '@/lib/status-colors';
import { useClientDetail } from '@/lib/hooks/use-client-detail';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

interface ClientDetailPropertiesProps {
  onOpenAssignProperty: () => void;
  /** False for inactive or archived clients, which cannot take new lots. */
  canAssign?: boolean;
}

export function ClientDetailProperties({
  onOpenAssignProperty,
  canAssign = true,
}: ClientDetailPropertiesProps) {
  const { client } = useClientDetail();
  const properties = client.properties || [];
  const assignDisabledReason = canAssign
    ? undefined
    : 'Only active clients can be assigned a lot. Reactivate this client first.';

  return (
    <div className="space-y-6">
      {/* Property List */}
      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-12">
          <IconBox size="lg">
            <LandPlot className="h-6 w-6" />
          </IconBox>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No properties assigned</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {assignDisabledReason ?? 'Click below to assign a property lot to this client.'}
            </p>
          </div>
          <Button
            variant="quiet"
            size="sm"
            onClick={onOpenAssignProperty}
            disabled={!canAssign}
            title={assignDisabledReason}
            className="mt-2 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Assign new property
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Assigned Properties</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {properties.map((property) => {
              const totalPrice = property.area_size * property.price_per_sqm;

              return (
                <div
                  key={property.property_id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-row-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <IconBox size="default" shape="rounded-md">
                        <LandPlot className="h-4 w-4 text-muted-foreground" />
                      </IconBox>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          Block {property.block_number} Lot {property.lot_number}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {property.location}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={PROPERTY_STATUS_VARIANT[property.status]}
                      shape="pill"
                      dot
                      className="shrink-0 text-xs"
                    >
                      {property.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Area</p>
                      <p className="font-medium text-foreground">
                        {AREA.format(property.area_size)} sqm
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price per sqm</p>
                      <p className="font-medium text-foreground">
                        {PESO.format(property.price_per_sqm)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">Total Contract Price</span>
                    <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      {PESO.format(totalPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3 pt-2">
            <Button
              variant="quiet"
              size="sm"
              onClick={onOpenAssignProperty}
              disabled={!canAssign}
              title={assignDisabledReason}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Assign new property
            </Button>
            {assignDisabledReason && (
              <p className="text-xs text-muted-foreground">{assignDisabledReason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
