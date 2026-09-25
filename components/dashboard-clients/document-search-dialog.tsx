'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, FileText, ExternalLink, SearchX } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { humanizeDocumentName } from '@/lib/format-document-name';
import { DocumentTextView } from './document-text-view';
import { toast } from 'sonner';
import type { DocumentSearchHit } from '@/lib/types/search';

/** Long enough that typing a word does not fire a query per keystroke. */
const DEBOUNCE_MS = 350;

/**
 * Searches the text recovered from scanned paperwork, across every client.
 *
 * This is the point of the OCR pass: staff who remember a name or a lot number
 * written on a contract can find the file without knowing whose record it was
 * filed under.
 */
export function DocumentSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { searchDocuments, getDocumentUrl } = useClients();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocumentSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  /** When set, the dialog shows this document's full text instead of results. */
  const [readingHit, setReadingHit] = useState<DocumentSearchHit | null>(null);

  // Reset to the results view whenever the dialog is reopened, so it never
  // reopens on a document from a previous search.
  useEffect(() => {
    if (!open) setReadingHit(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSearching(true);
      setError(null);
      searchDocuments(trimmed)
        .then((hits) => {
          // A slower earlier query must not overwrite a newer result.
          if (cancelled) return;
          setResults(hits);
          setHasSearched(true);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, searchDocuments]);

  async function handleOpenDocument(documentId: string) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {readingHit ? 'Document text' : 'Search document contents'}
          </DialogTitle>
          <DialogDescription>
            {readingHit
              ? 'The full text read from this scan, with your search terms marked.'
              : 'Searches the text read from scanned documents, across every client.'}
          </DialogDescription>
        </DialogHeader>

        {readingHit ? (
          <DocumentTextView
            documentId={readingHit.document_id}
            filePath={readingHit.file_path}
            documentType={readingHit.document_type}
            clientName={readingHit.client_name}
            highlightWords={query.trim().split(/[\s_\-.]+/).filter(Boolean)}
            onBack={() => setReadingHit(null)}
          />
        ) : (
        <>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try a name, a lot number, or "deed of absolute sale"'
            aria-label="Search document contents"
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="max-h-96 min-h-48 overflow-y-auto rounded-lg border border-border">
          {error ? (
            <p className="px-4 py-12 text-center text-sm text-destructive">{error}</p>
          ) : !query.trim() ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Type to search inside uploaded documents.
            </p>
          ) : hasSearched && results.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <SearchX className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No documents match</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Only documents uploaded since text reading was switched on are
                searchable. Older files need re-uploading to be read.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((hit) => (
                <li key={hit.document_id} className="p-3 transition-colors hover:bg-row-hover">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-row-hover">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {/* The body is the control: clicking a result opens its
                        full text, which is the usual next step after seeing an
                        excerpt that looks right. */}
                    <button
                      type="button"
                      onClick={() => setReadingHit(hit)}
                      className="min-w-0 flex-1 space-y-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                      aria-label={`Read text of ${humanizeDocumentName(hit.file_path)}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {humanizeDocumentName(hit.file_path)}
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {hit.document_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{hit.client_name}</p>
                      {hit.excerpt && (
                        <p className="line-clamp-2 text-xs italic text-muted-foreground">
                          {hit.excerpt}
                        </p>
                      )}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={openingId === hit.document_id}
                      onClick={() => void handleOpenDocument(hit.document_id)}
                      className="h-8 shrink-0 gap-1.5 border-border bg-card text-xs text-foreground hover:bg-row-hover hover:text-foreground"
                    >
                      {openingId === hit.document_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
