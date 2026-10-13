'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilePicker } from '@/components/ui/file-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLandTitles } from '@/lib/hooks/use-land-titles';
import { calculateStorageFee } from '@/lib/storage-fee';
import type { LandTitle } from '@/lib/types/title';

interface TitleReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: LandTitle;
  onReleased?: (updated: LandTitle) => void;
}

export function TitleReleaseDialog({
  open,
  onOpenChange,
  title,
  onReleased,
}: TitleReleaseDialogProps) {
  const { recordRelease, uploadReleaseProof } = useLandTitles();
  const buyerName = title.client?.full_name ?? '';
  const storageFee = calculateStorageFee(title);

  const [isPrincipalBuyer, setIsPrincipalBuyer] = useState(true);
  const [recipientName, setRecipientName] = useState(buyerName);
  const [relationship, setRelationship] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [skipAttachmentConfirmed, setSkipAttachmentConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIsPrincipalBuyer(true);
      setRecipientName(buyerName);
      setRelationship('');
      setIdNumber('');
      setRemarks('');
      setFile(null);
      setSkipAttachmentConfirmed(false);
      setIsSubmitting(false);
    }
  }, [open, buyerName]);

  const canSubmit =
    recipientName.trim().length >= 2 &&
    idNumber.trim().length >= 2 &&
    (file !== null || skipAttachmentConfirmed) &&
    !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);

      // Upload signed document attachment first if selected
      let attachmentId: string | null = null;
      if (file) {
        const attachment = await uploadReleaseProof(title.title_id, file);
        attachmentId = attachment.attachment_id;
      }

      // Combine relation tag with notes if claimed by representative
      const combinedRemarks = [
        !isPrincipalBuyer && relationship.trim() ? `Representative (${relationship.trim()})` : null,
        remarks.trim() ? remarks.trim() : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const result = await recordRelease({
        title_id: title.title_id,
        released_to_name: recipientName.trim(),
        released_to_id: idNumber.trim(),
        release_remarks: combinedRemarks || null,
        release_attachment_id: attachmentId,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('Title marked as officially Released.');
      onReleased?.(result.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record release.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Title Release to Buyer</DialogTitle>
          <DialogDescription className="text-sm">
            Record physical turnover of the original title and executed Deed of Absolute Sale.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {storageFee?.isOverdue && (
            <div className="rounded-lg border border-warning bg-[color-mix(in_srgb,var(--warning)_8%,var(--card))] p-3 text-xs text-foreground flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-warning">
                  ₱{storageFee.accruedFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({storageFee.monthsOverdue} {storageFee.monthsOverdue === 1 ? 'month' : 'months'} overdue)
                </p>
                <p className="text-muted-foreground">
                  Please verify cashier payment clearance or executive compromise waiver. You can note the OR # or waiver approval in the remarks below.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border p-3.5 space-y-3 bg-row-hover">
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-principal-buyer"
                checked={isPrincipalBuyer}
                onCheckedChange={(checked) => {
                  const isChecked = Boolean(checked);
                  setIsPrincipalBuyer(isChecked);
                  if (isChecked) {
                    setRecipientName(buyerName);
                    setRelationship('');
                  } else {
                    setRecipientName('');
                  }
                }}
              />
              <Label htmlFor="is-principal-buyer" className="text-sm font-medium cursor-pointer">
                Claimed by principal buyer ({buyerName || 'Buyer on record'})
              </Label>
            </div>

            {!isPrincipalBuyer && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="rep-name" className="text-xs text-muted-foreground">
                    Recipient Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rep-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Representative name"
                    className="h-9 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rep-rel" className="text-xs text-muted-foreground">
                    Relationship to Buyer
                  </Label>
                  <Input
                    id="rep-rel"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    placeholder="e.g. Spouse, Sibling, SPA"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valid-id" className="text-sm">
              Valid Government ID No. <span className="text-destructive">*</span>
            </Label>
            <Input
              id="valid-id"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. UMID CRN-0123-4567, Driver's License N01-..."
              className="h-9 text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="release-remarks" className="text-sm">
              Operational Remarks (Optional)
            </Label>
            <textarea
              id="release-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Storage fee paid via OR# 12345, SPA Doc 349, or special notes"
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="rounded-lg border border-border p-3.5 space-y-2.5 bg-card">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Signed Clearance Document
            </Label>
            <FilePicker
              file={file}
              onFileChange={(newFile) => {
                setFile(newFile);
                if (newFile) setSkipAttachmentConfirmed(false);
              }}
              accept=".pdf,image/*"
              buttonLabel="Select scan or photo"
            />

            {!file && (
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="skip-attachment"
                  checked={skipAttachmentConfirmed}
                  onCheckedChange={(checked) => setSkipAttachmentConfirmed(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label htmlFor="skip-attachment" className="text-xs text-muted-foreground cursor-pointer leading-tight">
                  Proceed without attaching signed copy (can be uploaded later from the Released tab)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-primary text-primary-foreground gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm &amp; Mark Released
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
