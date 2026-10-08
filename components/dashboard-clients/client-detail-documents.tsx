'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash2,
  Check,
  Circle,
  FileText,
  Upload,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatActivityTime } from '@/lib/format-activity-time';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import {
  REQUIRED_CLIENT_DOCUMENTS,
  type DocType,
} from '@/lib/types/client';

const DOCUMENT_TYPES: DocType[] = ['Valid ID', 'Contract', 'Deed of Sale', 'eCAR', 'Other'];

export function ClientDetailDocuments() {
  const { client, uploadDocument, deleteDocument, getDocumentUrl } = useClientDetail();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocType>('Valid ID');
  const [categoryFilter, setCategoryFilter] = useState<DocType | 'all'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allDocuments = client.client_document || [];

  const counts = DOCUMENT_TYPES.reduce(
    (acc, type) => {
      acc[type] = allDocuments.filter((doc) => doc.document_type === type).length;
      return acc;
    },
    {} as Record<DocType, number>
  );

  const missing = REQUIRED_CLIENT_DOCUMENTS.filter((type) => counts[type] === 0);
  const isComplete = missing.length === 0;

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

      await uploadDocument(formData);

      setSelectedFile(null);
      setIsUploadOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Document uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    try {
      await deleteDocument(documentId);
      toast.success('Document removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document');
    } finally {
      setDeletingId(null);
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

  return (
    <div className="space-y-4">
      {/* Required Documents Checklist */}
      <div className="space-y-3 rounded-lg border border-border bg-row-hover p-4">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              <p className="text-sm font-semibold text-foreground">Required files complete</p>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm font-semibold text-foreground">
                {missing.length} required document{missing.length === 1 ? '' : 's'} missing
              </p>
            </>
          )}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-2">
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

      {/* Upload Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Uploaded Documents</h3>
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
          {isUploadOpen ? 'Cancel' : 'Upload document'}
        </Button>
      </div>

      {isUploadOpen && (
        <form
          onSubmit={handleUpload}
          className="space-y-3 rounded-lg border border-border bg-row-hover p-4"
        >
          <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocType)}>
            <SelectTrigger className="h-9">
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
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="h-9"
          />

          <Button
            type="submit"
            size="sm"
            disabled={isUploading || !selectedFile}
            className="h-9 w-full gap-1.5"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload document
          </Button>
        </form>
      )}

      {/* Category Filter */}
      {allDocuments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('all')}
            className="h-8 text-xs"
          >
            All ({allDocuments.length})
          </Button>
          {DOCUMENT_TYPES.filter((type) => counts[type] > 0).map((type) => (
            <Button
              key={type}
              size="sm"
              variant={categoryFilter === type ? 'default' : 'outline'}
              onClick={() => setCategoryFilter(type)}
              className="h-8 text-xs"
            >
              {type} ({counts[type]})
            </Button>
          ))}
        </div>
      )}

      {/* Documents List */}
      {visibleDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-12">
          <IconBox size="lg">
            <FileText className="h-6 w-6" />
          </IconBox>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {allDocuments.length === 0 ? 'No documents uploaded' : 'No documents in this category'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {allDocuments.length === 0
                ? 'Upload required documents to complete this client profile'
                : 'Try selecting a different category'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleDocuments.map((doc) => (
            <div
              key={doc.document_id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-row-hover"
            >
              <IconBox size="default" shape="rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </IconBox>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{doc.document_type}</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded {formatActivityTime(doc.uploaded_at)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleOpen(doc.document_id)}
                  disabled={openingId === doc.document_id}
                  className="h-8 gap-1.5 text-xs"
                >
                  {openingId === doc.document_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDelete(doc.document_id)}
                  disabled={deletingId === doc.document_id}
                  className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  {deletingId === doc.document_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
