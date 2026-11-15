'use client';

import { useState } from 'react';
import {
  CreditCard,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Receipt,
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
import { SectionCard, SectionHeader } from '@/components/ui/section-card';
import { lotRefLabel, useLandTitles } from '@/lib/hooks/use-land-titles';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import { formatMediumDate, formatMediumDateTime } from '@/lib/format-date';
import { calculateStorageFee } from '@/lib/storage-fee';
import { getReleasedDate } from '@/lib/title-progress';
import type { LandTitle } from '@/lib/types/title';

function formatFileSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TitleReleasedTabProps {
  title: LandTitle;
}

export function TitleReleasedTab({ title }: TitleReleasedTabProps) {
  const { canEdit, updateTitle, uploadReleaseProof, getAttachmentFileUrl } = useLandTitles();
  const { enqueueFile } = useOcrQueue();
  const storageFee = calculateStorageFee(title);

  const releasedDate = getReleasedDate(title);
  const releasedDateStr = releasedDate ? formatMediumDateTime(releasedDate) : 'Recorded';

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

        // Enqueue release proof into background OCR worker for search indexing.
        enqueueFile({
          attachmentId: uploaded.attachment_id,
          file: newFile,
          fileName: newFile.name,
          entityType: 'land_title',
          keywords: ['Release Proof', title.client?.full_name].filter(Boolean).join(' '),
        });
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
    <div className="space-y-4">
      {/* Top Release Summary & Edit Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge variant="success" shape="pill" dot className="text-xs">
            Turnover Archive Finalized
          </Badge>
          <Badge variant={isPrincipalBuyer ? 'secondary' : 'warning'} shape="pill" className="text-xs">
            {isPrincipalBuyer ? 'Principal Buyer' : 'Representative / Heir'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Released on <strong className="text-foreground">{releasedDateStr}</strong>
          </span>
        </div>

        {canEdit && (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={openEditModal}
            className="text-xs gap-1.5 h-8 px-3 shrink-0 self-end sm:self-center"
          >
            <Edit2 className="h-3 w-3" />
            Edit Release Details
          </Button>
        )}
      </div>

      {/* Unified Certificate-Grade Dossier */}
      <SectionCard className="space-y-4">
        <SectionHeader title="Release & Turnover Dossier" />
        <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Column 1: Recipient Verification */}
          <div className="space-y-3.5 sm:pr-4">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recipient Verification
            </h5>

            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Received By
              </span>
              <p className="font-semibold text-foreground text-sm">{recipientName}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Valid ID Presented
              </span>
              <p className="font-mono text-foreground text-sm font-medium">{recipientId}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Vault Storage Fee
              </span>
              <p className="text-foreground text-sm font-mono">
                {storageFee?.isOverdue
                  ? `₱${storageFee.accruedFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${storageFee.monthsOverdue} mo overdue)`
                  : '₱0.00 (Settled / Grace Period)'}
              </p>
            </div>

            {title.release_remarks && (
              <div className="space-y-0.5 pt-1">
                <span className="text-xs text-muted-foreground">Receipt Remarks:</span>
                <p className="text-xs text-foreground bg-muted/40 p-2 rounded-md border border-border">
                  {title.release_remarks}
                </p>
              </div>
            )}
          </div>

          {/* Column 2: Parcel Identification & Signed Clearance Document */}
          <div className="space-y-3.5 pt-4 sm:pt-0 sm:pl-4">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Property &amp; Clearance File
            </h5>

            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Property Lot</span>
              <p className="font-semibold text-foreground text-sm">{propertyRef}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Subdivision / Location
              </span>
              <p className="font-medium text-foreground text-sm">{propertyLocation}</p>
            </div>

            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Title Number</span>
              <p className="text-sm font-mono font-medium text-foreground">
                {title.property?.title_number ?? 'N/A'}
              </p>
            </div>

            {/* Signed Clearance Form Attachment Tile */}
            <div className="pt-2">
              <span className="text-xs text-muted-foreground block mb-1.5">Signed Clearance Attachment</span>
              {title.release_attachment ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[160px]">
                        {title.release_attachment.file_name ?? 'Signed_Clearance_Sheet.pdf'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[
                          formatFileSize(title.release_attachment.file_size),
                          formatMediumDate(title.release_attachment.uploaded_at),
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    onClick={handleOpenFile}
                    disabled={isOpeningFile}
                    className="gap-1 shrink-0 text-xs h-7 px-2"
                  >
                    {isOpeningFile ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    View
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No signed clearance scan attached.</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Edit Release Details Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Release Details</DialogTitle>
              <DialogDescription className="text-xs">
                Update recipient information or attach a replacement clearance sheet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="space-y-1">
                <Label htmlFor="edit-recipient-name" className="text-xs">
                  Received By (Full Name) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-recipient-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-recipient-id" className="text-xs">
                  Valid ID Presented <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-recipient-id"
                  value={editId}
                  onChange={(e) => setEditId(e.target.value)}
                  placeholder="e.g. UMID CRN-0111-XXXXXXX-X"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-remarks" className="text-xs">
                  Operational Remarks &amp; Receipts
                </Label>
                <Input
                  id="edit-remarks"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Receipt #, SPA details, etc."
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs">Replace Clearance Document Scan (Optional)</Label>
                <FilePicker
                  file={newFile}
                  onFileChange={setNewFile}
                  accept="application/pdf,image/*"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5 font-medium text-xs">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
