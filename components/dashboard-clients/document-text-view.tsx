'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, ExternalLink, FileWarning, Sparkles } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import { humanizeDocumentName } from '@/lib/format-document-name';
import { toast } from 'sonner';

/** Escapes a search word so it cannot alter the highlight pattern. */
function escapeForRegExp(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wraps each searched word in the text so a reader can see where the match is.
 *
 * Built with split rather than by injecting HTML: the text comes from OCR of an
 * arbitrary uploaded file, so it must never be interpreted as markup.
 */
function highlight(text: string, words: string[]) {
  const usable = words.filter((word) => word.length > 1).map(escapeForRegExp);
  if (usable.length === 0) return text;

  const pattern = new RegExp(`(${usable.join('|')})`, 'gi');

  return text.split(pattern).map((part, index) =>
    pattern.test(part) && index % 2 === 1 ? (
      <mark
        key={index}
        className="rounded-sm bg-[color-mix(in_srgb,var(--row-accent)_45%,white)] px-0.5 text-foreground"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export interface DocumentTextViewProps {
  documentId: string;
  filePath: string;
  documentType: string;
  clientName?: string;
  /** Words to highlight, normally whatever was searched for. */
  highlightWords?: string[];
  onBack: () => void;
}

/**
 * The full text OCR recovered from one document.
 *
 * Reading this matters as much as searching it: Tesseract can return confident
 * nonsense from a faded photocopy, and until staff can see what was captured
 * there is no way to tell a good scan from a bad one.
 */
export function DocumentTextView({
  documentId,
  filePath,
  documentType,
  clientName,
  highlightWords = [],
  onBack,
}: DocumentTextViewProps) {
  const { getDocumentText, getDocumentUrl } = useClients();
  const { jobs, enqueueRemoteAttachment } = useOcrQueue();

  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);

  // Check if this document is currently in the OCR queue
  const queueJob = jobs.find((j) => j.attachmentId === documentId);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getDocumentText(documentId)
      .then((content) => {
        if (!cancelled) setText(content);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load document text');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, getDocumentText, queueJob?.status]);

  async function handleRunOcr() {
    setIsEnqueuing(true);
    try {
      await enqueueRemoteAttachment({
        attachment_id: documentId,
        file_name: humanizeDocumentName(filePath),
        file_path: filePath,
        file_category: documentType,
        mime_type: 'application/pdf',
        entity_type: 'client_document',
        client_id: null,
        client_name: clientName,
        uploaded_at: new Date().toISOString(),
      });
      toast.success('Document queued for OCR text extraction');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue OCR');
    } finally {
      setIsEnqueuing(false);
    }
  }

  const body = useMemo(
    () => (text ? highlight(text, highlightWords) : null),
    [text, highlightWords]
  );

  async function handleOpenFile() {
    setIsOpeningFile(true);
    try {
      const url = await getDocumentUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    } finally {
      setIsOpeningFile(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Back to results"
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {humanizeDocumentName(filePath)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {clientName ? `${clientName} · ` : ''}
              {documentType}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isOpeningFile}
          onClick={() => void handleOpenFile()}
          className="h-8 shrink-0 gap-1.5 border-border bg-card text-xs text-foreground hover:bg-row-hover hover:text-foreground"
        >
          {isOpeningFile ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          Open file
        </Button>
      </div>

      <div className="max-h-96 min-h-48 overflow-y-auto rounded-lg border border-border bg-row-hover p-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading text…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-destructive">{error}</p>
        ) : !text ? (
          <div className="flex flex-col items-center gap-2.5 py-12 text-center">
            <FileWarning className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No text captured</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Either this document was uploaded before text reading was enabled, or the scan was interrupted.
            </p>
            {queueJob ? (
              <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>
                  {queueJob.status === 'processing'
                    ? `Reading text (${queueJob.page && queueJob.totalPages ? `page ${queueJob.page}/${queueJob.totalPages}` : `${Math.round(queueJob.progress * 100)}%`})...`
                    : 'Queued in background OCR...'}
                </span>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isEnqueuing}
                onClick={() => void handleRunOcr()}
                className="mt-2 gap-1.5 border-border bg-card text-xs text-foreground hover:bg-row-hover"
              >
                {isEnqueuing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
                Extract text (Run OCR)
              </Button>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
            {body}
          </p>
        )}
      </div>

      {text && (
        <p className="text-[11px] text-muted-foreground">
          Text read automatically from the scan. Accuracy depends on scan
          quality, so check against the original before relying on it.
        </p>
      )}

      <div className="flex justify-start">
        <Badge variant="outline" className="text-[10px]">
          {text ? `${text.length.toLocaleString()} characters` : 'No text'}
        </Badge>
      </div>
    </div>
  );
}
