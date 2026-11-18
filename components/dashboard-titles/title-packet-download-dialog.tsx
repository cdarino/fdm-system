'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2 } from 'lucide-react';
import { downloadTitlePacketPdf } from '@/lib/download-client-documents';
import { getDocumentEffectiveLabel } from '@/lib/format-document-name';
import { getRequiredReleaseDocuments } from '@/lib/utils/release-requirements';
import { getDocumentTypeLabel, type ClientDocument } from '@/lib/types/client';
import type { LandTitle } from '@/lib/types/title';

interface TitlePacketDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: LandTitle;
  packetDocuments: ClientDocument[];
  referenceDocuments: ClientDocument[];
}

export function TitlePacketDownloadDialog({
  open,
  onOpenChange,
  title,
  packetDocuments,
  referenceDocuments,
}: TitlePacketDownloadDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const orderedPacketItems = useMemo(() => {
    const latestByType = new Map<string, ClientDocument>();
    for (const doc of packetDocuments) {
      if (!latestByType.has(doc.document_type)) latestByType.set(doc.document_type, doc);
    }
    return getRequiredReleaseDocuments(title.is_legacy_transferred)
      .map((type) => latestByType.get(type))
      .filter((doc): doc is ClientDocument => Boolean(doc));
  }, [packetDocuments, title.is_legacy_transferred]);

  const refCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of referenceDocuments) {
      counts.set(doc.document_type, (counts.get(doc.document_type) ?? 0) + 1);
    }
    return counts;
  }, [referenceDocuments]);

  const allDownloadable = useMemo(
    () => [...orderedPacketItems, ...referenceDocuments],
    [orderedPacketItems, referenceDocuments]
  );

  const defaultSelectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const doc of orderedPacketItems) ids.add(doc.document_id);
    for (const doc of referenceDocuments) {
      if (!doc.property_id && doc.document_type === 'Valid ID') {
        ids.add(doc.document_id);
      }
    }
    return ids;
  }, [orderedPacketItems, referenceDocuments]);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(defaultSelectedIds));
    }
  }, [open, defaultSelectedIds]);

  const allSelected =
    allDownloadable.length > 0 && selectedIds.size === allDownloadable.length;

  function toggleDocument(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAllToggle() {
    if (allSelected) {
      setSelectedIds(new Set(defaultSelectedIds));
    } else {
      setSelectedIds(new Set(allDownloadable.map((d) => d.document_id)));
    }
  }

  async function handleDownload() {
    const documentIds = allDownloadable
      .map((d) => d.document_id)
      .filter((id) => selectedIds.has(id));
    if (documentIds.length === 0) return;

    setIsDownloading(true);
    try {
      const lotLabel = title.property
        ? `Block_${title.property.block_number}_Lot_${title.property.lot_number}_${title.client?.full_name ?? 'client'}`
        : title.client?.full_name;
      const ok = await downloadTitlePacketPdf(title.title_id, {
        documentIds,
        fileLabel: lotLabel,
      });
      if (ok) onOpenChange(false);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isDownloading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Download Packet PDF
          </DialogTitle>
          <DialogDescription>
            Choose which files to merge into a single printable PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between px-0.5 text-xs">
            <span className="text-muted-foreground">
              {selectedIds.size} of {allDownloadable.length}{' '}
              {allDownloadable.length === 1 ? 'file' : 'files'} selected
            </span>
            {allDownloadable.length > defaultSelectedIds.size && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleSelectAllToggle}
                className="font-medium text-primary hover:underline"
              >
                {allSelected ? 'Reset to default' : 'Select all'}
              </button>
            )}
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-3">
            {orderedPacketItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Turnover Packet Requirements
                </p>
                <div className="space-y-1">
                  {orderedPacketItems.map((doc) => {
                    const checked = selectedIds.has(doc.document_id);
                    return (
                      <label
                        key={doc.document_id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-row-hover"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={isDownloading}
                          onCheckedChange={() => toggleDocument(doc.document_id)}
                        />
                        <span className="min-w-0 truncate text-foreground">
                          {getDocumentTypeLabel(doc.document_type)}
                        </span>
                        {doc.label && (
                          <span className="truncate text-xs text-muted-foreground">
                            · {doc.label}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {referenceDocuments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Client Reference Documents
                </p>
                <div className="space-y-1">
                  {referenceDocuments.map((doc) => {
                    const checked = selectedIds.has(doc.document_id);
                    const count = refCategoryCounts.get(doc.document_type) ?? 0;
                    const showLabel = count >= 2 || Boolean(doc.label);
                    return (
                      <label
                        key={doc.document_id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-row-hover"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={isDownloading}
                          onCheckedChange={() => toggleDocument(doc.document_id)}
                        />
                        <span className="min-w-0 truncate text-foreground">
                          {getDocumentTypeLabel(doc.document_type)}
                        </span>
                        {showLabel && (
                          <span className="truncate text-xs text-muted-foreground">
                            · {getDocumentEffectiveLabel(doc)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDownloading}
            className="h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isDownloading || selectedIds.size === 0}
            onClick={() => void handleDownload()}
            className="h-9 gap-1.5"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download PDF ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
