'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePropertyLots } from '@/lib/hooks/use-property-lots';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import type { Site } from '@/lib/types/property';
import { createPropertyLotSchema, type CreatePropertyLotFormData } from '@/lib/validations/property';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

export interface CreatePropertyLotModalProps {
  open: boolean;
  sites: Site[];
  initialValues?: {
    site_id?: string;
    block_number?: number;
    lot_number?: number;
    area_size?: number;
    price_per_sqm?: number;
  };
}

export function CreatePropertyLotModal({ open, sites, initialValues }: CreatePropertyLotModalProps) {
  const { createLot, closeDialog } = usePropertyLots();

  const siteOptions = useMemo(
    () =>
      sites.map((s) => ({
        value: s.site_id,
        label: s.name,
        description: s.description ?? undefined,
      })),
    [sites]
  );

  const form = useForm<CreatePropertyLotFormData>({
    resolver: zodResolver(createPropertyLotSchema),
    defaultValues: {
      site_id: initialValues?.site_id ?? '',
      block_number: initialValues?.block_number ?? undefined,
      lot_number: initialValues?.lot_number ?? undefined,
      area_size: initialValues?.area_size ?? undefined,
      price_per_sqm: initialValues?.price_per_sqm ?? undefined,
    },
  });

  const { state, execute } = useMutation(createLot, {
    setError: form.setError,
    onSuccess: () => {
      closeDialog();
      toast.success('Property lot created successfully');
    },
  });

  // Prefill form when opened with initial values
  useEffect(() => {
    if (open) {
      form.reset({
        site_id: initialValues?.site_id ?? '',
        block_number: initialValues?.block_number ?? undefined,
        lot_number: initialValues?.lot_number ?? undefined,
        area_size: initialValues?.area_size ?? undefined,
        price_per_sqm: initialValues?.price_per_sqm ?? undefined,
      });
    }
  }, [open, initialValues, form]);

  const { register, watch, formState: { errors } } = form;

  const onSubmit = form.handleSubmit((data) => {
    const site = sites.find((s) => s.site_id === data.site_id);
    if (!site) return;
    return execute({
      site_id: data.site_id,
      location: site.name,
      block_number: data.block_number,
      lot_number: data.lot_number,
      area_size: data.area_size,
      price_per_sqm: data.price_per_sqm,
    });
  });

  const area = watch('area_size');
  const rate = watch('price_per_sqm');
  const total = Number(area) > 0 && Number(rate) > 0 ? Number(area) * Number(rate) : null;

  const isPending = state.status === 'pending';
  const serverError = state.status === 'error' ? state.error : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>New Property Lot</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Site picker */}
          <div className="space-y-1.5">
            <Label htmlFor="site_id" className="text-sm font-medium text-foreground">
              Site
            </Label>
            <Controller
              name="site_id"
              control={form.control}
              render={({ field }) => (
                <SearchableSelect
                  id="site_id"
                  options={siteOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending || sites.length === 0}
                  placeholder={sites.length === 0 ? 'No sites available' : 'Select a site'}
                  searchPlaceholder="Search site name or address..."
                />
              )}
            />
            {errors.site_id && (
              <p className="text-xs text-destructive">{errors.site_id.message}</p>
            )}
          </div>

          {/* Block and Lot number inputs */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="block_number"
              label="Block No."
              type="number"
              min={1}
              step={1}
              placeholder="1"
              disabled={isPending}
              error={errors.block_number?.message}
              {...register('block_number', { valueAsNumber: true })}
            />
            <FormField
              id="lot_number"
              label="Lot No."
              type="number"
              min={1}
              step={1}
              placeholder="1"
              disabled={isPending}
              error={errors.lot_number?.message}
              {...register('lot_number', { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="area_size"
              label="Area (sqm)"
              type="number"
              min={0}
              step="0.01"
              placeholder="250.00"
              disabled={isPending}
              error={errors.area_size?.message}
              {...register('area_size', { valueAsNumber: true })}
            />
            <FormField
              id="price_per_sqm"
              label="Price / sqm"
              type="number"
              min={0}
              step="0.01"
              placeholder="3500.00"
              disabled={isPending}
              error={errors.price_per_sqm?.message}
              {...register('price_per_sqm', { valueAsNumber: true })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-row-hover px-3 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total contract price
            </span>
            <span className="text-sm font-semibold text-foreground">
              {total === null ? '—' : PESO.format(total)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            New lots start as <strong className="font-medium text-foreground">Open</strong>. If the block and
            lot match a subdivision on the site plan, it will visually appear on the map.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isPending}
              className="border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground"
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              isLoading={isPending}
              loadingText="Creating..."
              className="bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
            >
              Create Lot
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
