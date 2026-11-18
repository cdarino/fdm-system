'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { useMutation } from '@/lib/hooks/use-mutation';
import { toast } from 'sonner';
import type { ClientListItem } from '@/lib/types/client';
import { CIVIL_STATUSES, GENDERS, type CivilStatus, type Gender } from '@/lib/types/client';
import { clientSchema, type ClientFormData } from '@/lib/validations/client';

export function EditClientModal({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  const { updateClient, closeDialog } = useClients();
  const [spouseContacts, setSpouseContacts] = useState<string[]>(
    client.spouse_contact && client.spouse_contact.length > 0 ? client.spouse_contact : ['']
  );

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: client.full_name,
      address: client.address ?? '',
      tin_number: client.tin_number ?? '',
      civil_status: client.civil_status ?? null,
      spouse_name: client.spouse_name ?? '',
      spouse_contact: client.spouse_contact ?? [],
      gender: client.gender ?? null,
      status: client.status === 'Inactive' ? 'Inactive' : 'Active',
    },
  });

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = form;
  const currentCivilStatus = watch('civil_status');

  const { state, execute } = useMutation(updateClient, {
    setError: form.setError,
    onSuccess: () => {
      closeDialog();
      toast.success('Client updated successfully');
    },
  });

  useEffect(() => {
    if (open) {
      setSpouseContacts(
        client.spouse_contact && client.spouse_contact.length > 0 ? client.spouse_contact : ['']
      );
      reset({
        full_name: client.full_name,
        address: client.address ?? '',
        tin_number: client.tin_number ?? '',
        civil_status: client.civil_status ?? null,
        spouse_name: client.spouse_name ?? '',
        spouse_contact: client.spouse_contact ?? [],
        gender: client.gender ?? null,
        status: client.status === 'Inactive' ? 'Inactive' : 'Active',
      });
    }
  }, [open, client, reset]);

  const onSubmit = handleSubmit(async (data) => {
    await execute(client.client_id, {
      full_name: data.full_name,
      address: data.address?.trim() || null,
      tin_number: data.tin_number?.trim() || null,
      civil_status: data.civil_status || null,
      spouse_name: data.civil_status === 'Married' ? data.spouse_name?.trim() || null : null,
      spouse_contact: data.civil_status === 'Married' ? spouseContacts.map((c) => c.trim()) : null,
      gender: data.gender || null,
      status: data.status,
    });
  });

  const isPending = state.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <FormField
            id="edit-client-name"
            label="Full name"
            placeholder="Juan dela Cruz"
            error={errors.full_name?.message}
            {...register('full_name')}
          />

          <FormField
            id="edit-client-address"
            label="Address"
            placeholder="Davao City, Philippines"
            error={errors.address?.message}
            {...register('address')}
          />

          <FormField
            id="edit-client-tin"
            label="TIN number"
            placeholder="123-456-789"
            hint="Format: XXX-XXX-XXX (9 digits)"
            error={errors.tin_number?.message}
            {...register('tin_number')}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-client-civil-status" className="text-sm font-medium text-foreground">
                Civil status
              </Label>
              <Controller
                control={control}
                name="civil_status"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={(val) => field.onChange(val as CivilStatus)}
                  >
                    <SelectTrigger id="edit-client-civil-status" className="w-full">
                      <SelectValue placeholder="Select civil status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CIVIL_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.civil_status && (
                <p className="text-[11px] text-destructive">{errors.civil_status.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-client-gender" className="text-sm font-medium text-foreground">
                Gender
              </Label>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={(val) => field.onChange(val as Gender)}
                  >
                    <SelectTrigger id="edit-client-gender" className="w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.gender && (
                <p className="text-[11px] text-destructive">{errors.gender.message}</p>
              )}
            </div>
          </div>

          {currentCivilStatus === 'Married' && (
            <>
              <FormField
                id="edit-client-spouse"
                label="Spouse name"
                placeholder="Maria Santos"
                hint="Required for married clients"
                error={errors.spouse_name?.message}
                {...register('spouse_name')}
              />

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Spouse contact
                </Label>
                <div className="space-y-1.5">
                  {spouseContacts.map((contact, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        value={contact}
                        onChange={(e) => {
                          const updated = [...spouseContacts];
                          updated[idx] = e.target.value;
                          setSpouseContacts(updated);
                        }}
                        placeholder={idx === 0 ? "e.g. 09171234567 or email" : `Contact ${idx + 1}`}
                        className="h-9 text-sm flex-1"
                        maxLength={100}
                        aria-label={`Spouse contact ${idx + 1}`}
                      />
                      {spouseContacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => {
                            setSpouseContacts(spouseContacts.filter((_, i) => i !== idx));
                          }}
                          aria-label={`Remove contact ${idx + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {spouseContacts[spouseContacts.length - 1]?.trim().length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs gap-1 border-dashed text-muted-foreground hover:text-foreground"
                    onClick={() => setSpouseContacts([...spouseContacts, ''])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add another contact
                  </Button>
                )}
                {errors.spouse_contact && (
                  <p className="text-[11px] text-destructive">
                    {Array.isArray(errors.spouse_contact)
                      ? (errors.spouse_contact as any)[0]?.message || 'Spouse contact is required'
                      : errors.spouse_contact.message as string}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-client-status" className="text-sm font-medium text-foreground">
              Status
            </Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-client-status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" isLoading={isPending} loadingText="Saving...">
              Save changes
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
