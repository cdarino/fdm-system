'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Check,
  Circle,
  FileText,
  Upload,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ScanText,
  X,
} from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { formatActivityTime } from '@/lib/format-activity-time';
import { humanizeDocumentName } from '@/lib/format-document-name';
import { DocumentTextView } from './document-text-view';
import { toast } from 'sonner';
import {
  REQUIRED_CLIENT_DOCUMENTS,
  type ClientListItem,
  type ClientWithDetails,
  type ClientDocument,
  type DocType,
} from '@/lib/types/client';
import type { OcrStatus } from '@/lib/types/search';

/** Upload categories, and the display order of the filter chips. */
const DOCUMENT_TYPES: DocType[] = ['Valid ID', 'Contract', 'Deed of Sale', 'eCAR', 'Other'];

export function ClientProfileDocuments({
  client,
  details,
  onDetailsChange,
}: {
  client: ClientListItem;
  details: ClientWithDetails;
  onDetailsChange: (updater: (prev: ClientWithDetails) => ClientWithDetails) => void;
}) {
  const {
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
    indexDocumentText,
    refreshMissingDocumentAlerts,
  } = useClients();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocType>('Valid ID');
  const [categoryFilter, setCategoryFilter] = useState<DocType | 'all'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [readingDoc, setReadingDoc] = useState<ClientDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lives only while the profile is open; the stored result is in search_index.
  const [ocrStatus, setOcrStatus] = useState<Record<string, OcrStatus>>({});
  const [ocrProgress, setOcrProgress] = useState<Record<string, number>>({});

  const allDocuments = details.client_document;

  const counts = DOCUMENT_TYPES.reduce(
    (acc, type) => {
      acc[type] = allDocuments.filter((doc) => doc.document_type === type).length;
      return acc;
    },
    {} as Record<DocType, number>,
  );

  const missing = REQUIRED_CLIENT_DOCUMENTS.filter((type) => counts[type] === 0);
  const isComplete = missing.length === 0;
  const presentCategories = DOCUMENT_TYPES.filter((type) => counts[type] > 0);

  const visibleDocuments =
    categoryFilter === 'all'
      ? allDocuments
      : allDocuments.filter((doc) => doc.document_type === categoryFilter);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('document_type', documentType);

      const created = await uploadDocument(client.client_id, formData);
      onDetailsChange((prev) => ({
        ...prev,
        client_document: [created, ...prev.client_document],
      }));

      const fileForOcr = selectedFile;
      const categoryForOcr = documentType;
      setSelectedFile(null);
      setIsUploadOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Document uploaded');
      void refreshMissingDocumentAlerts();

      // Not awaited: the file is stored and listed already, so reading it is
      // follow-up work the staff member should not wait through.
      void runOcr(created.document_id, fileForOcr, categoryForOcr);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  }

  /**
   * Reads the scan in the browser and stores the text. Failure is not raised as
   * an error: the document is safely uploaded either way, and an unreadable
   * scan is a normal outcome, so the row just reports that it found nothing.
   */
  async function runOcr(documentId: string, file: File, category: DocType) {
    setOcrStatus((prev) => ({ ...prev, [documentId]: 'running' }));
    setOcrProgress((prev) => ({ ...prev, [documentId]: 0 }));

    try {
      const { extractDocumentText, tidyExtractedText } = await import(
        '@/lib/ocr/extract-document-text'
      );

      const result = await extractDocumentText(file, (fraction) =>
        setOcrProgress((prev) => ({ ...prev, [documentId]: fraction })),
      );

      const content = tidyExtractedText(result.text);
      const keywords = [category, humanizeDocumentName(file.name)].join(' ');

      await indexDocumentText(documentId, content, keywords);
      setOcrStatus((prev) => ({ ...prev, [documentId]: content ? 'done' : 'failed' }));
    } catch (err) {
      console.error('OCR failed for document', documentId, err);
      setOcrStatus((prev) => ({ ...prev, [documentId]: 'failed' }));
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await deleteDocument(documentId);
      onDetailsChange((prev) => ({
        ...prev,
        client_document: prev.client_document.filter(
          (d) => d.document_id !== documentId,
        ),
      }));
      toast.success('Document removed');
      void refreshMissingDocumentAlerts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document');
    }
  }

  async function handleOpen(documentId: string) {
    setOpeningId(documentId);
    try {
      const url = await getDocumentUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    } finally {
      setOpeningId(null);
    }
  }

  if (readingDoc) {
    return (
      <DocumentTextView
        documentId={readingDoc.document_id}
        filePath={readingDoc.file_path}
        documentType={readingDoc.document_type}
        onBack={() => setReadingDoc(null)}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Documents</h3>
          <Badge variant="secondary">{allDocuments.length}</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant={isUploadOpen ? 'ghost' : 'outline'}
          onClick={() => setIsUploadOpen((open) => !open)}
          className="h-8 gap-1.5 text-xs"
        >
          {isUploadOpen ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
          {isUploadOpen ? 'Cancel' : 'Upload'}
        </Button>
      </div>

      {/* Required-document checklist, shown complete or not: staff need to see
          what counts as a full file, not only what is absent today. */}
      <div
        className={`space-y-2 rounded-lg border p-3 ${
          isComplete
            ? 'border-success bg-[color-mix(in_srgb,var(--success)_8%,white)]'
            : 'border-border bg-row-hover'
        }`}
      >
        <div className="flex items-center gap-2">
          {isComplete ? (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              <p className="text-xs font-semibold text-success">File complete</p>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs font-semibold text-foreground">
                {missing.length} required document{missing.length === 1 ? '' : 's'} missing
              </p>
            </>
          )}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {REQUIRED_CLIENT_DOCUMENTS.map((type) => {
            const isPresent = counts[type] > 0;
            return (
              <li key={type} className="flex items-center gap-1.5 text-xs">
                {isPresent ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                <span className={isPresent ? 'text-foreground' : 'text-destructive'}>
                  {type}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {isUploadOpen && (
        <form
          onSubmit={handleUpload}
          className="space-y-2.5 rounded-lg border border-border bg-row-hover p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocType)}>
              <SelectTrigger className="h-9 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              aria-label="Choose a document to upload"
              className="h-9 flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isUploading || !selectedFile}
              className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Upload
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            PDF, JPEG or PNG, up to 10MB. Text is read from the scan automatically
            so the document can be searched later.
          </p>
        </form>
      )}

      {/* Only categories this client has, so every chip leads somewhere. */}
      {presentCategories.length > 1 && (
        <div
          role="tablist"
          aria-label="Filter documents by category"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-row-hover p-1"
        >
          {(['all', ...presentCategories] as const).map((category) => {
            const isActive = categoryFilter === category;
            const count =
              category === 'all' ? allDocuments.length : counts[category as DocType];

            return (
              <button
                key={category}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setCategoryFilter(category as DocType | 'all')}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {category === 'all' ? 'All' : category}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {allDocuments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No documents uploaded yet.
        </p>
      ) : visibleDocuments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No {categoryFilter} documents.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {visibleDocuments.map((doc) => (
            <li
              key={doc.document_id}
              className="flex items-center gap-3 p-2.5 transition-colors hover:bg-row-hover"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-row-hover ring-1 ring-inset ring-border">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {humanizeDocumentName(doc.file_path)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.document_type} · {formatActivityTime(doc.uploaded_at)}
                  {ocrStatus[doc.document_id] === 'running' && (
                    <span className="ml-1 text-primary">
                      · reading text {Math.round((ocrProgress[doc.document_id] ?? 0) * 100)}%
                    </span>
                  )}
                  {ocrStatus[doc.document_id] === 'done' && (
                    <span className="ml-1 text-success">· text captured</span>
                  )}
                  {ocrStatus[doc.document_id] === 'failed' && (
                    <span className="ml-1 text-muted-foreground">· no text found</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Read text of ${humanizeDocumentName(doc.file_path)}`}
                  title="View extracted text"
                  onClick={() => setReadingDoc(doc)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <ScanText className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={openingId === doc.document_id}
                  aria-label={`Open ${humanizeDocumentName(doc.file_path)}`}
                  title="Open file"
                  onClick={() => void handleOpen(doc.document_id)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {openingId === doc.document_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${humanizeDocumentName(doc.file_path)}`}
                  title="Remove document"
                  onClick={() => void handleDelete(doc.document_id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
