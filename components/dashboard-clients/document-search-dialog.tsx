'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { FileTree, FileTreeFolder, FileTreeItem } from '@/components/ui/file-tree';
import {
  Search,
  Loader2,
  ExternalLink,
  SearchX,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { getDocumentEffectiveLabel } from '@/lib/format-document-name';
import { formatActivityTime } from '@/lib/format-activity-time';
import { compareDocumentsByCategory, getDocumentTypeLabel } from '@/lib/types/client';
import { toast } from 'sonner';
import type { DocumentSearchHit } from '@/lib/types/search';

const DEBOUNCE_MS = 350;

interface SearchFolderGroup {
  id: string;
  label: string;
  sublabel?: string;
  hits: DocumentSearchHit[];
}

interface ClientSearchGroup {
  id: string;
  clientId: string;
  clientName: string;
  totalHits: number;
  folders: SearchFolderGroup[];
}

function escapeForRegExp(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Split rather than injecting HTML so OCR output is never parsed as markup.
function highlightSearchTerms(text: string, words: string[]) {
  const usable = Array.from(new Set(words.filter((word) => word.length > 1)))
    .sort((a, b) => b.length - a.length)
    .map(escapeForRegExp);
  if (usable.length === 0) return text;

  const pattern = new RegExp(`(${usable.join('|')})`, 'gi');

  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={index}
        className="rounded-sm bg-[color-mix(in_srgb,var(--row-accent)_40%,var(--card))] px-0.5 font-semibold not-italic text-[var(--row-accent-foreground)]"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

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
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setExpandedFolders({});
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
          // Ignore stale responses from slower earlier queries.
          if (cancelled) return;
          setResults(hits);
          setExpandedFolders({});
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

  const highlightWords = useMemo(
    () => query.trim().split(/[\s_\-.]+/).filter(Boolean),
    [query]
  );

  // Group matches by client, then Personal Documents vs property lot folders.
  const clientGroups: ClientSearchGroup[] = useMemo(() => {
    const clientOrder: string[] = [];
    const clientMap = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        totalHits: number;
        personalHits: DocumentSearchHit[];
        propertyOrder: string[];
        propertyMap: Map<string, SearchFolderGroup>;
      }
    >();

    for (const hit of results) {
      const clientKey = hit.client_id || '__unknown__';
      let entry = clientMap.get(clientKey);
      if (!entry) {
        entry = {
          clientId: hit.client_id,
          clientName: hit.client_name,
          totalHits: 0,
          personalHits: [],
          propertyOrder: [],
          propertyMap: new Map(),
        };
        clientMap.set(clientKey, entry);
        clientOrder.push(clientKey);
      }

      entry.totalHits += 1;

      if (!hit.property_id) {
        entry.personalHits.push(hit);
      } else {
        const folderId = `${clientKey}:${hit.property_id}`;
        let folder = entry.propertyMap.get(folderId);
        if (!folder) {
          folder = {
            id: folderId,
            label: hit.property_label ?? 'Property Documents',
            sublabel: hit.property_location ?? undefined,
            hits: [],
          };
          entry.propertyMap.set(folderId, folder);
          entry.propertyOrder.push(folderId);
        }
        folder.hits.push(hit);
      }
    }

    return clientOrder.map((clientKey) => {
      const entry = clientMap.get(clientKey)!;
      const folders: SearchFolderGroup[] = [];

      if (entry.personalHits.length > 0) {
        folders.push({
          id: `${clientKey}:personal`,
          label: 'Personal Documents',
          hits: [...entry.personalHits].sort(compareDocumentsByCategory),
        });
      }

      for (const folderId of entry.propertyOrder) {
        const folder = entry.propertyMap.get(folderId)!;
        folders.push({
          ...folder,
          hits: [...folder.hits].sort(compareDocumentsByCategory),
        });
      }

      return {
        id: `client:${clientKey}`,
        clientId: entry.clientId,
        clientName: entry.clientName,
        totalHits: entry.totalHits,
        folders,
      };
    });
  }, [results]);

  const allFolderIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of clientGroups) {
      ids.push(group.id);
      for (const folder of group.folders) {
        ids.push(folder.id);
      }
    }
    return ids;
  }, [clientGroups]);

  const areAllExpanded = useMemo(
    () => allFolderIds.every((id) => expandedFolders[id] ?? true),
    [allFolderIds, expandedFolders]
  );

  function isFolderExpanded(folderId: string): boolean {
    return expandedFolders[folderId] ?? true;
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !(prev[folderId] ?? true),
    }));
  }

  function toggleAllFolders() {
    const nextState = !areAllExpanded;
    const updated: Record<string, boolean> = {};
    for (const id of allFolderIds) {
      updated[id] = nextState;
    }
    setExpandedFolders(updated);
  }

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
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Search document contents</DialogTitle>
          <DialogDescription>
            Searches the text read from scanned documents, across every client.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
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

          {results.length > 0 && !error && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {results.length} {results.length === 1 ? 'match' : 'matches'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  across {clientGroups.length}{' '}
                  {clientGroups.length === 1 ? 'client' : 'clients'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="quiet"
                onClick={toggleAllFolders}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {areAllExpanded ? (
                  <>
                    <Folder className="h-3.5 w-3.5" />
                    Collapse all
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-3.5 w-3.5" />
                    Expand all
                  </>
                )}
              </Button>
            </div>
          )}

          {error ? (
            <div className="min-h-48 rounded-lg border border-border bg-card">
              <p className="px-4 py-12 text-center text-sm text-destructive">{error}</p>
            </div>
          ) : !query.trim() ? (
            <div className="min-h-48 rounded-lg border border-border bg-card">
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                Type to search inside uploaded documents.
              </p>
            </div>
          ) : hasSearched && results.length === 0 && !isSearching ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-12 text-center">
              <SearchX className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No documents match</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Only indexed documents are searchable. Text is automatically
                processed upon upload or on-demand.
              </p>
            </div>
          ) : results.length > 0 ? (
            <FileTree className="max-h-96 min-h-48 overflow-x-hidden overflow-y-auto">
              {clientGroups.map((group) => (
                <FileTreeFolder
                  key={group.id}
                  depth={0}
                  label={group.clientName}
                  meta={`${group.totalHits} ${group.totalHits === 1 ? 'match' : 'matches'}`}
                  expanded={isFolderExpanded(group.id)}
                  onToggle={() => toggleFolder(group.id)}
                >
                  {group.folders.map((folder) => {
                    const categoryCounts = new Map<string, number>();
                    for (const h of folder.hits) {
                      categoryCounts.set(h.document_type, (categoryCounts.get(h.document_type) ?? 0) + 1);
                    }

                    return (
                      <FileTreeFolder
                        key={folder.id}
                        depth={1}
                        label={folder.label}
                        sublabel={folder.sublabel}
                        meta={`${folder.hits.length} ${folder.hits.length === 1 ? 'file' : 'files'}`}
                        expanded={isFolderExpanded(folder.id)}
                        onToggle={() => toggleFolder(folder.id)}
                      >
                        {folder.hits.map((hit) => {
                          const docLabel = getDocumentTypeLabel(hit.document_type);
                          const effectiveLabel = getDocumentEffectiveLabel(hit);
                          const countInCategory = categoryCounts.get(hit.document_type) ?? 0;
                          const showLabel = countInCategory >= 2 || Boolean(hit.label);
                          const timestampLabel = hit.uploaded_at
                            ? `${hit.is_autogenerated ? 'Autogenerated' : 'Uploaded'} ${formatActivityTime(hit.uploaded_at)}`
                            : null;

                          return (
                            <FileTreeItem
                              key={hit.document_id}
                              depth={2}
                              label={docLabel}
                              secondaryLabel={showLabel ? effectiveLabel : undefined}
                              loading={openingId === hit.document_id}
                              ariaLabel={`Open ${docLabel} (${effectiveLabel})`}
                              onClick={() => void handleOpenDocument(hit.document_id)}
                              description={
                                hit.excerpt ? (
                                  <p className="line-clamp-2 text-xs italic text-muted-foreground">
                                    {highlightSearchTerms(hit.excerpt, highlightWords)}
                                  </p>
                                ) : undefined
                              }
                              hoverActions={
                                <>
                                  {timestampLabel && (
                                    <span className="hidden text-xs text-muted-foreground md:inline">
                                      {timestampLabel}
                                    </span>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={openingId === hit.document_id}
                                    onClick={() => void handleOpenDocument(hit.document_id)}
                                    className="h-7 gap-1 px-2 text-xs"
                                  >
                                    {openingId === hit.document_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <ExternalLink className="h-3 w-3" />
                                    )}
                                    Open
                                  </Button>
                                </>
                              }
                            />
                          );
                        })}
                      </FileTreeFolder>
                    );
                  })}
                </FileTreeFolder>
              ))}
            </FileTree>
          ) : (
            <div className="min-h-48 rounded-lg border border-border bg-card" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
