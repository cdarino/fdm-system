'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { createPropertyLot } from '@/lib/actions/properties';
import { createPropertyLotSchema, type CreatePropertyLotFormData } from '@/lib/validations/property';
import type { Site, PropertyLot } from '@/lib/types/property';

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

interface ClientLotCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: Site[];
  onLotCreated: (lot: PropertyLot) => void;
}

export function ClientLotCreateDialog({
  open,
  onOpenChange,
  sites,
  onLotCreated,
}: ClientLotCreateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreatePropertyLotFormData>({
    resolver: zodResolver(createPropertyLotSchema),
    defaultValues: {
      site_id: '',
      block_number: undefined,
      lot_number: undefined,
      area_size: undefined,
      price_per_sqm: undefined,
    },
  });

  const { register, watch, handleSubmit, formState: { errors }, reset } = form;

  const area = watch('area_size');
  const rate = watch('price_per_sqm');
  const total = Number(area) > 0 && Number(rate) > 0 ? Number(area) * Number(rate) : null;

  function handleDialogClose(isOpen: boolean) {
    if (!isOpen) {
      reset();
      setServerError(null);
    }
    onOpenChange(isOpen);
  }

  const onSubmit = handleSubmit(async (data) => {
    const site = sites.find((s) => s.site_id === data.site_id);
    if (!site) {
      setServerError('Please select a valid site');
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const result = await createPropertyLot({
        site_id: data.site_id,
        location: site.name,
        block_number: data.block_number,
        lot_number: data.lot_number,
        area_size: data.area_size,
        price_per_sqm: data.price_per_sqm,
        status: 'Open',
      });

      if (!result.success) {
        setServerError(result.error);
        return;
      }

      toast.success(`Created Block ${result.data.block_number} Lot ${result.data.lot_number}`);
      reset();
      onLotCreated(result.data);
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create lot');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
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

          <div className="space-y-1.5">
            <Label htmlFor="create-lot-site" className="text-sm font-medium text-foreground">
              Site
            </Label>
            <Controller
              name="site_id"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting || sites.length === 0}
                >
                  <SelectTrigger id="create-lot-site" className="w-full">
                    <SelectValue placeholder={sites.length === 0 ? 'No sites available' : 'Select a site'} />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.site_id} value={s.site_id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.site_id && (
              <p className="text-xs text-destructive">{errors.site_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="create_block_number"
              label="Block No."
              type="number"
              min={1}
              step={1}
              placeholder="1"
              disabled={isSubmitting}
              error={errors.block_number?.message}
              {...register('block_number', { valueAsNumber: true })}
            />
            <FormField
              id="create_lot_number"
              label="Lot No."
              type="number"
              min={1}
              step={1}
              placeholder="1"
              disabled={isSubmitting}
              error={errors.lot_number?.message}
              {...register('lot_number', { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="create_area_size"
              label="Area (sqm)"
              type="number"
              min={0}
              step="0.01"
              placeholder="250.00"
              disabled={isSubmitting}
              error={errors.area_size?.message}
              {...register('area_size', { valueAsNumber: true })}
            />
            <FormField
              id="create_price_per_sqm"
              label="Price / sqm"
              type="number"
              min={0}
              step="0.01"
              placeholder="3500.00"
              disabled={isSubmitting}
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogClose(false)}
              disabled={isSubmitting}
              className="border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground"
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              loadingText="Creating..."
              className="bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
            >
              Create & Select Lot
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
