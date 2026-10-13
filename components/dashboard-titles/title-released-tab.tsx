'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { lotRefLabel, useLandTitles } from '@/lib/hooks/use-land-titles';
import { calculateStorageFee } from '@/lib/storage-fee';
import type { LandTitle } from '@/lib/types/title';

const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface TitleReleasedTabProps {
  title: LandTitle;
}

export function TitleReleasedTab({ title }: TitleReleasedTabProps) {
  const { canEdit, updateTitle, uploadReleaseProof, getAttachmentFileUrl } = useLandTitles();
  const storageFee = calculateStorageFee(title);

  const releasedDate = title.released_at
    ? new Date(title.released_at)
    : title.history?.slice().reverse().find((h) => h.status === 'Released')?.changed_at
    ? new Date(title.history.slice().reverse().find((h) => h.status === 'Released')!.changed_at)
    : title.updated_at
    ? new Date(title.updated_at)
    : null;
  const releasedDateStr = releasedDate ? DATE_FORMAT.format(releasedDate) : 'Recorded';

  const clientName = title.client?.full_name ?? 'Client Account';
  const propertyRef = lotRefLabel(title.property);
  const propertyLocation = title.property?.location ?? '';

  const recipientName = title.released_to_name ?? clientName;
  const recipientId = title.released_to_id ?? 'Not recorded';
  const isPrincipalBuyer = !title.released_to_name || title.released_to_name === clientName;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(recipientName);
  const [editId, setEditId] = useState(title.released_to_id ?? '');
  const [editRemarks, setEditRemarks] = useState(title.release_remarks ?? '');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningFile, setIsOpeningFile] = useState(false);

  function openEditModal() {
    setEditName(recipientName);
    setEditId(title.released_to_id ?? '');
    setEditRemarks(title.release_remarks ?? '');
    setNewFile(null);
    setIsEditOpen(true);
  }

  async function handleOpenFile() {
    const attachmentId = title.release_attachment_id ?? title.release_attachment?.attachment_id;
    if (!attachmentId) return;

    try {
      setIsOpeningFile(true);
      const url = await getAttachmentFileUrl(attachmentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retrieve document URL.');
    } finally {
      setIsOpeningFile(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim() || !editId.trim()) {
      toast.error('Recipient name and Valid ID number are required.');
      return;
    }

    try {
      setIsSaving(true);

      let attachmentId = title.release_attachment_id ?? null;
      if (newFile) {
        const uploaded = await uploadReleaseProof(title.title_id, newFile);
        attachmentId = uploaded.attachment_id;
      }

      const result = await updateTitle(title.title_id, {
        released_to_name: editName.trim(),
        released_to_id: editId.trim(),
        release_remarks: editRemarks.trim() || null,
        release_attachment_id: attachmentId,
      });

      if (!result.success) throw new Error(result.error);

      toast.success('Release details updated.');
      setIsEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update release details.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Finalized Banner */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 bg-card text-success">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <h4 className="text-base font-semibold text-foreground">Finalized &amp; Turned Over to Buyer</h4>
            <p className="text-sm text-muted-foreground">
              Original title certificate and notarized Deed of Absolute Sale (DOAS) have been formally handed over.
            </p>
          </div>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openEditModal}
            className="text-foreground gap-1.5 shrink-0"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Release Details
          </Button>
        )}
      </div>

      {/* Claimant & Turnover Dossier */}
      <div className="rounded-lg border border-border p-4 space-y-4 bg-card">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recipient &amp; Turnover Dossier
          </h4>
          <Badge variant={isPrincipalBuyer ? 'secondary' : 'warning'} shape="pill">
            {isPrincipalBuyer ? 'Principal Buyer' : 'Representative / Heir'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Received By:
            </span>
            <p className="font-semibold text-foreground">{recipientName}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Valid ID Presented:
            </span>
            <p className="font-mono text-foreground">{recipientId}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Turnover Timestamp:
            </span>
            <p className="font-medium text-foreground">{releasedDateStr}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Vault Storage Fee:</span>
            <p className="font-medium text-foreground">
              {storageFee?.isOverdue
                ? `₱${storageFee.accruedFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${storageFee.monthsOverdue} ${storageFee.monthsOverdue === 1 ? 'mo' : 'mos'})`
                : '₱0.00'}
            </p>
          </div>

          <div className="col-span-2 space-y-1 pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">Operational Remarks &amp; Receipts:</span>
            <p className="text-foreground text-sm whitespace-pre-wrap">
              {title.release_remarks || <span className="text-muted-foreground italic">None recorded</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Property & Title Summary */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-row-hover">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Property Specifications
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Client Account:</span>
            <p className="font-medium text-foreground">{clientName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Property Lot:</span>
            <p className="font-medium text-foreground">{propertyRef}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Title Number:</span>
            <p className="font-mono text-foreground">{title.property?.title_number ?? 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Location:</span>
            <p className="font-medium text-foreground">{propertyLocation}</p>
          </div>
        </div>
      </div>

      {/* Signed Clearance Document Card */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary shrink-0" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Signed Clearance Document
            </h4>
          </div>
          {title.release_attachment ? (
            <Badge variant="success" shape="pill" dot className="text-xs">
              Attached
            </Badge>
          ) : (
            <Badge variant="muted" shape="pill" className="text-xs">
              Pending Attachment
            </Badge>
          )}
        </div>

        {title.release_attachment ? (
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-row-hover text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {title.release_attachment.file_name ?? 'Signed_Clearance_Sheet.pdf'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Attached proof of physical handover
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenFile}
              disabled={isOpeningFile}
              className="gap-1.5 shrink-0 text-xs"
            >
              {isOpeningFile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              View Document
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <span>No signed clearance copy attached yet.</span>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openEditModal}
                className="text-primary text-xs h-7"
              >
                Attach File
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit Release Details Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Release Details</DialogTitle>
            <DialogDescription className="text-sm">
              Update claimant name, ID presented, remarks, or attach a signed clearance scan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-sm">
                Recipient Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name of person who received title"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-id" className="text-sm">
                Valid Government ID No. <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-id"
                value={editId}
                onChange={(e) => setEditId(e.target.value)}
                placeholder="ID presented during pickup"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-remarks" className="text-sm">
                Operational Remarks &amp; Receipts
              </Label>
              <textarea
                id="edit-remarks"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                rows={3}
                placeholder="e.g. Storage fee OR# 12345, SPA document notes, or relationship"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {title.release_attachment ? 'Replace Signed Clearance Copy' : 'Attach Signed Clearance Copy'}
              </Label>
              <FilePicker
                file={newFile}
                onFileChange={setNewFile}
                accept=".pdf,image/*"
                buttonLabel="Select scan or photo"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !editName.trim() || !editId.trim()}
                className="bg-primary text-primary-foreground gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
