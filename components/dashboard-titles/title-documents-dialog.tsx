'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDocumentName } from '@/lib/format-document-name';
import { lotRefLabel } from '@/lib/hooks/use-land-titles';
import { getMissingReleaseDocuments, getRequiredReleaseDocuments } from '@/lib/utils/release-requirements';
import { DOCUMENT_FILE_ACCEPT } from '@/lib/validations/document';
import { DOC_TYPE_LABEL, type ClientDocument } from '@/lib/types/client';
import type { LandTitle, ReleaseDocumentType } from '@/lib/types/title';

const DATE = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

interface TitleDocumentsDialogProps {
  title: LandTitle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpload: boolean;
  loadDocuments: (titleId: string) => Promise<ClientDocument[]>;
  uploadDocument: (titleId: string, type: ReleaseDocumentType, file: File) => Promise<ClientDocument>;
  removeDocument: (document: ClientDocument) => Promise<void>;
  getDocumentUrl: (documentId: string) => Promise<string>;
}

/**
 * The release packet checklist for one title. The files are the client's own
 * documents, so anything uploaded here also shows on the client's profile and
 * anything already uploaded there counts here. Missing items are listed so
 * they can be followed up before the release goes for approval.
 */
export function TitleDocumentsDialog({
  title,
  open,
  onOpenChange,
  canUpload,
  loadDocuments,
  uploadDocument,
  removeDocument,
  getDocumentUrl,
}: TitleDocumentsDialogProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<ClientDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<ReleaseDocumentType | null>(null);

  const titleId = title?.title_id;

  useEffect(() => {
    if (!open || !titleId) return;
    let cancelled = false;
    setDocuments([]);
    setIsLoading(true);
    setLoadError(null);
    loadDocuments(titleId)
      .then((docs) => !cancelled && setDocuments(docs))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load documents'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, titleId, loadDocuments]);

  if (!title) return null;

  const required = getRequiredReleaseDocuments(title.title_holder);
  // Documents arrive newest first, so the first one of each type is current.
  const latestByType = new Map<string, ClientDocument>();
  for (const doc of documents) {
    if (!latestByType.has(doc.document_type)) latestByType.set(doc.document_type, doc);
  }
  const missing = getMissingReleaseDocuments(title.title_holder, latestByType.keys());

  function pickFile(type: ReleaseDocumentType) {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const type = pendingTypeRef.current;
    event.target.value = '';
    if (!file || !type || !title) return;

    setBusyType(type);
    try {
      const saved = await uploadDocument(title.title_id, type, file);
      // The server replaced any earlier file for this lot. Files with no lot stay.
      setDocuments((prev) => [
        saved,
        ...prev.filter((d) => !(d.document_type === type && d.property_id === saved.property_id)),
      ]);
      toast.success(`${DOC_TYPE_LABEL[type]} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusyType(null);
    }
  }

  async function handleView(document: ClientDocument) {
    setBusyType(document.document_type);
    try {
      const url = await getDocumentUrl(document.document_id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    } finally {
      setBusyType(null);
    }
  }

  async function confirmRemove() {
    if (!toRemove) return;
    const target = toRemove;
    setToRemove(null);
    setBusyType(target.document_type);
    try {
      await removeDocument(target);
      setDocuments((prev) => prev.filter((d) => d.document_id !== target.document_id));
      toast.success(`${DOC_TYPE_LABEL[target.document_type]} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document');
    } finally {
      setBusyType(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !busyType && onOpenChange(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Release documents</DialogTitle>
            <DialogDescription>
              {title.client?.full_name ?? 'Unknown client'}, {lotRefLabel(title.property)}
              {title.title_number ? `, ${title.title_number}` : ''}
            </DialogDescription>
          </DialogHeader>

          {loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading documents...
            </div>
          ) : (
            <div className="space-y-4">
              {missing.length > 0 ? (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Missing before approval: {missing.map((type) => DOC_TYPE_LABEL[type]).join(', ')}.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    The release packet is complete and ready for review.
                  </AlertDescription>
                </Alert>
              )}

              {!title.title_holder && (
                <p className="text-xs text-muted-foreground">
                  Whose name this title is in has not been recorded, so the Deed of Sale is listed. Edit the
                  title record to set it.
                </p>
              )}

              <ul className="divide-y divide-border rounded-lg border border-border">
                {required.map((type) => {
                  const document = latestByType.get(type);
                  const isBusy = busyType === type;
                  return (
                    <li key={type} className="flex flex-wrap items-center gap-3 px-3 py-3">
                      {document ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Uploaded" />
                      ) : (
                        <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Missing" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{DOC_TYPE_LABEL[type]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {document
                            ? `${formatDocumentName(document.file_path)}, uploaded ${DATE.format(new Date(document.uploaded_at))}${
                                document.property_id ? '' : ', from the client profile'
                              }`
                            : 'Not uploaded'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {document && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5 text-xs"
                            disabled={Boolean(busyType)}
                            onClick={() => void handleView(document)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Button>
                        )}
                        {canUpload && (
                          <Button
                            size="sm"
                            variant={document ? 'ghost' : 'quiet'}
                            className="h-8 gap-1.5 text-xs"
                            disabled={Boolean(busyType)}
                            onClick={() => pickFile(type)}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {document ? 'Replace' : 'Upload'}
                          </Button>
                        )}
                        {canUpload && document && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            disabled={Boolean(busyType)}
                            onClick={() => setToRemove(document)}
                            aria-label={`Remove ${DOC_TYPE_LABEL[type]}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="text-xs text-muted-foreground">
                These are the client&apos;s documents, so they also appear on the client profile. PDF, JPEG or
                PNG, up to 10MB each.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={DOCUMENT_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => void handleFileChosen(e)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={toRemove !== null} onOpenChange={(next) => !next && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {toRemove ? DOC_TYPE_LABEL[toRemove.document_type] : 'document'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.property_id
                ? "The file is deleted from the client's documents and the item goes back to missing."
                : "This file was uploaded on the client profile without a lot, so deleting it also removes it from the client's other lots."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRemove()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
