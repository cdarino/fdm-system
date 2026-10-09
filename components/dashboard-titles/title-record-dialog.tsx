'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { LoadingButton } from '@/components/ui/loading-button';
import { RadioCard } from '@/components/ui/radio-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMutation } from '@/lib/hooks/use-mutation';
import { titleRecordFormSchema, type TitleRecordFormData } from '@/lib/validations/title';
import { TITLE_HOLDER_LABEL, type LandTitle, type TitleHolder } from '@/lib/types/title';
import type { ActionResult } from '@/lib/actions/action-result';

const HOLDER_HINT: Record<TitleHolder, string> = {
  client: 'The title has already been transferred to the client.',
  fdm: "The title is still in FDM's name. A Deed of Sale is needed before release.",
};

interface TitleRecordDialogProps {
  /** 'create' makes the title for a cleared account. 'edit' corrects an existing one. */
  mode: 'create' | 'edit';
  /** Client and lot, shown under the heading. */
  subject: string;
  defaults?: Partial<TitleRecordFormData>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: TitleRecordFormData) => Promise<ActionResult<LandTitle>>;
}

export function TitleRecordDialog({
  mode,
  subject,
  defaults,
  open,
  onOpenChange,
  onSubmit,
}: TitleRecordDialogProps) {
  const form = useForm<TitleRecordFormData>({
    resolver: zodResolver(titleRecordFormSchema),
  });
  const { register, handleSubmit, reset, formState: { errors } } = form;

  useEffect(() => {
    if (open) {
      reset({ title_holder: defaults?.title_holder, title_number: defaults?.title_number ?? '' });
    }
  }, [open, defaults, reset]);

  const { state, execute } = useMutation(onSubmit, {
    setError: form.setError,
    onSuccess: () => {
      toast.success(mode === 'create' ? 'Title record created' : 'Title record updated');
      onOpenChange(false);
    },
  });

  const isPending = state.status === 'pending';

  const submit = handleSubmit(async (data) => {
    await execute(data);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create title record' : 'Edit title record'}</DialogTitle>
          <DialogDescription>{subject}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-5 pt-1">
          <fieldset className="space-y-2" aria-describedby={errors.title_holder ? 'title-holder-error' : undefined}>
            <legend className="text-sm font-medium text-foreground">Whose name is the title in?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['client', 'fdm'] as const).map((holder) => (
                <RadioCard
                  key={holder}
                  value={holder}
                  disabled={isPending}
                  label={TITLE_HOLDER_LABEL[holder]}
                  description={HOLDER_HINT[holder]}
                  {...register('title_holder')}
                />
              ))}
            </div>
            {errors.title_holder && (
              <p id="title-holder-error" className="text-xs text-destructive">
                {errors.title_holder.message}
              </p>
            )}
          </fieldset>

          <FormField
            id="title-number"
            label="Title number"
            placeholder="e.g. TCT-2024-12345"
            maxLength={100}
            className="font-mono"
            disabled={isPending}
            error={errors.title_number?.message}
            {...register('title_number')}
          />

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <LoadingButton type="submit" isLoading={isPending} loadingText="Saving...">
              {mode === 'create' ? 'Create title record' : 'Save changes'}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
