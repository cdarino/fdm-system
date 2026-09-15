'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
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

/**
 * `block_number` / `lot_number` are INT columns and `area_size` /
 * `price_per_sqm` are NUMERIC, so these fields must reach the action as
 * numbers. The conversion is done by react-hook-form's `valueAsNumber` on each
 * `register()` below, not by `z.coerce` — under Zod 4 a coerced field types its
 * *input* as `unknown`, which no longer satisfies the resolver's generics.
 *
 * An empty numeric input yields NaN through `valueAsNumber`, and `z.number()`
 * rejects NaN, so the `error` message doubles as the required-field message.
 * 
 * TODO: what?
 */
const createPropertyLotSchema = z.object({
  location: z.string().trim().min(1, 'Location is required'),
  block_number: z
    .number({ error: 'Block number is required' })
    .int('Must be a whole number')
    .positive('Must be greater than 0'),
  lot_number: z
    .number({ error: 'Lot number is required' })
    .int('Must be a whole number')
    .positive('Must be greater than 0'),
  area_size: z
    .number({ error: 'Area is required' })
    .positive('Must be greater than 0'),
  price_per_sqm: z
    .number({ error: 'Price is required' })
    .positive('Must be greater than 0'),
});

type CreatePropertyLotFormData = z.infer<typeof createPropertyLotSchema>;

// TODO: could refactor
const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

export function CreatePropertyLotModal({ open }: { open: boolean }) {
  const { createLot, closeDialog } = usePropertyLots();
  const { state, execute } = useMutation(createLot);

  const form = useForm<CreatePropertyLotFormData>({
    resolver: zodResolver(createPropertyLotSchema),
    defaultValues: {
      location: '',
      block_number: undefined,
      lot_number: undefined,
      area_size: undefined,
      price_per_sqm: undefined,
    },
  });

  const { register, watch, formState: { errors } } = form;

  useEffect(() => {
    if (state.status === 'success') {
      closeDialog();
      toast.success('Property lot created successfully');
    }
  }, [state.status, closeDialog]);

  const onSubmit = form.handleSubmit((data) => execute(data));

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
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--destructive)_30%,white)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] p-3">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <FormField
            id="location"
            label="Location"
            placeholder="e.g. Samal Island"
            disabled={isPending}
            error={errors.location?.message}
            {...register('location')}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="block_number"
              label="Block No."
              type="number"
              min={1}
              step={1}
              placeholder="3"
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
              placeholder="12"
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
            New lots start as <strong className="font-medium text-foreground">Open</strong>. Assign a
            client and change the status once the lot is reserved or sold.
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
