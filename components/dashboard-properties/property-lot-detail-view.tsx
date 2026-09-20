'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, X, LandPlot, User, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { ClientAssignModal } from './client-assign-modal';
import { usePropertyLots, lotLabel } from '@/lib/hooks/use-property-lots';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import type { PropertyLotWithClient } from '@/lib/types/property';
import { STATUSES, STATUS_PILL } from '@/lib/status-colors';

const updateLotSchema = z.object({
  status: z.enum(['Open', 'Reserved', 'Sold', 'Forfeited'] as const),
  price_per_sqm: z
    .number({ error: 'Price is required' })
    .positive('Must be greater than 0'),
  area_size: z
    .number({ error: 'Area is required' })
    .positive('Must be greater than 0'),
});

type UpdateLotFormData = z.infer<typeof updateLotSchema>;

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

export interface PropertyLotDetailViewProps {
  lot: PropertyLotWithClient;
  onBack: () => void;
  onClose: () => void;
}

export function PropertyLotDetailView({ lot, onBack, onClose }: PropertyLotDetailViewProps) {
  const { updateLot } = usePropertyLots();
  const { state, execute } = useMutation(updateLot);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const form = useForm<UpdateLotFormData>({
    resolver: zodResolver(updateLotSchema),
    defaultValues: {
      status: lot.status,
      price_per_sqm: lot.price_per_sqm,
      area_size: lot.area_size,
    },
  });

  const { register, control, watch, reset, formState: { errors, isDirty } } = form;

  // Sync form values when the selected lot changes
  useEffect(() => {
    reset({
      status: lot.status,
      price_per_sqm: lot.price_per_sqm,
      area_size: lot.area_size,
    });
  }, [lot, reset]);

  // Display error toast if update fails
  useEffect(() => {
    if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state]);

  const watchedPrice = watch('price_per_sqm') ?? 0;
  const watchedArea = watch('area_size') ?? 0;
  const calculatedTotal = watchedPrice * watchedArea;

  const onSubmit = form.handleSubmit(async (data) => {
    const ok = await execute(lot.property_id, {
      status: data.status,
      price_per_sqm: data.price_per_sqm,
      area_size: data.area_size,
    });
    if (ok) {
      toast.success(`${lotLabel(lot)} details updated successfully`);
      reset(data);
    }
  });

  const isPending = state.status === 'pending';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card">
      {/* Header with back navigation and close button */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-muted-foreground hover:bg-row-hover hover:text-foreground"
            aria-label="Back to lot list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight text-foreground">{lotLabel(lot)}</h2>
            <p className="truncate text-[11px] text-muted-foreground">{lot.location}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:bg-row-hover hover:text-foreground"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable detail and edit form */}
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Read-only property overview card */}
          <div className="rounded-xl border border-border bg-row-hover p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <LandPlot className="h-4 w-4 text-primary" />
                <span>Property Details</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                B{lot.block_number} • L{lot.lot_number}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border">
              <div>
                <span className="text-muted-foreground">Location</span>
                <p className="font-medium text-foreground truncate">{lot.location}</p>
              </div>
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setIsAssignModalOpen(true)}
                        className="group/client -m-1 flex w-full flex-col rounded-lg p-1 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <span className="text-muted-foreground group-hover/client:text-primary transition-colors">
                          Assigned Client
                        </span>
                        <div className="flex items-center gap-1.5 font-medium text-foreground truncate mt-0.5 max-w-full">
                          <User className="h-3 w-3 text-muted-foreground group-hover/client:text-primary shrink-0 transition-colors" />
                          <span className="truncate group-hover/client:text-primary group-hover/client:underline transition-colors">
                            {lot.client ? lot.client.full_name : 'Unassigned'}
                          </span>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Assign a new client
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Editable Status */}
          <div className="space-y-1.5">
            <Label htmlFor="status-select" className="text-sm font-medium text-foreground">
              Property Status
            </Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status-select" className="w-full bg-background border-border text-foreground">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${STATUS_PILL[st].dot}`}
                          />
                          <span>{st}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status && (
              <p className="text-xs text-destructive">{errors.status.message}</p>
            )}
          </div>

          {/* Editable Pricing & Dimensions */}
          <div className="space-y-4">
            <FormField
              id="price_per_sqm"
              label="Price per Sqm (₱)"
              type="number"
              step="any"
              error={errors.price_per_sqm?.message}
              {...register('price_per_sqm', { valueAsNumber: true })}
            />

            <FormField
              id="area_size"
              label="Area Size (sqm)"
              type="number"
              step="any"
              error={errors.area_size?.message}
              {...register('area_size', { valueAsNumber: true })}
            />
          </div>

          {/* Live contract price calculation callout */}
          <div className="rounded-xl border border-border bg-sidebar-accent p-3.5 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-accent-blue-foreground font-medium">Estimated Total Contract Price</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">
              {PESO.format(calculatedTotal)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Calculated dynamically as {AREA.format(watchedArea || 0)} sqm × ₱{Number(watchedPrice || 0).toLocaleString()}/sqm
            </p>
          </div>
        </div>

        {/* Footer save controls */}
        <div className="shrink-0 border-t border-border bg-card p-4">
          <LoadingButton
            type="submit"
            isLoading={isPending}
            loadingText="Saving Changes..."
            disabled={!isDirty || isPending}
            className="w-full bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Save Changes</span>
          </LoadingButton>
        </div>
      </form>

      <ClientAssignModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        lot={lot}
      />
    </div>
  );
}
