'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { getDocumentDefaultLabel } from '@/lib/format-document-name';
import { getDocumentTypeLabel, type ClientDocument } from '@/lib/types/client';

interface ClientDocumentLabelModalProps {
  document: ClientDocument | null;
  onOpenChange: (open: boolean) => void;
  onSave: (documentId: string, label: string) => Promise<void>;
}

export function ClientDocumentLabelModal({
  document,
  onOpenChange,
  onSave,
}: ClientDocumentLabelModalProps) {
  const [label, setLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!document) return;
    setLabel(document.label ?? '');
  }, [document]);

  const defaultName = document ? getDocumentDefaultLabel(document) : '';
  const categoryName = document ? getDocumentTypeLabel(document.document_type) : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!document || isSaving) return;

    setIsSaving(true);
    try {
      const trimmed = label.trim();
      await onSave(document.document_id, trimmed);
      toast.success(trimmed ? 'Document label updated' : 'Document label cleared');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update label');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={document !== null} onOpenChange={(open) => !isSaving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Document Label
          </DialogTitle>
          <DialogDescription>
            {document ? (
              <span className="text-xs">
                Category: <strong className="text-foreground">{categoryName}</strong>
              </span>
            ) : (
              'Give this file a short label to tell it apart from others in the same category.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="min-w-0 space-y-4 py-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="doc-label-input" className="text-xs">
              Label
            </Label>
            <Input
              id="doc-label-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={defaultName || 'e.g. Driver\u2019s License, Spouse ID, Signed Copy'}
              maxLength={120}
              autoFocus
              disabled={isSaving}
              className="h-9 text-sm"
            />
            <p className="truncate text-xs text-muted-foreground" title={defaultName}>
              Leave blank to use default filename ({defaultName}).
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-9"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving} className="h-9 gap-1.5">
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save label
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
