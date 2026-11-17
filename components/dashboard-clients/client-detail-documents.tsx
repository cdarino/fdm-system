'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Trash2,
  Check,
  Circle,
  FileText,
  Upload,
  ExternalLink,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  FolderOpen,
  Folder,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatActivityTime } from '@/lib/format-activity-time';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  PERSONAL_DOC_TYPES,
  PROPERTY_DOC_TYPES,
  REQUIRED_CLIENT_DOCUMENTS,
  getDocumentTypeLabel,
  type StandardDocType,
  type ClientDocument,
} from '@/lib/types/client';
import {
  ClientDocumentUploadModal,
  type TargetFolderInfo,
} from './client-document-upload-modal';

interface DocumentFolder {
  id: string;
  label: string;
  sublabel?: string;
  isClient: boolean;
  targetInfo: TargetFolderInfo;
  docs: ClientDocument[];
}

export function ClientDetailDocuments() {
  const { client, uploadDocument, deleteDocument, getDocumentUrl } = useClientDetail();
  const { enqueueFile } = useOcrQueue();
  const searchParams = useSearchParams();

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<ClientDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadModal, setUploadModal] = useState<{
    open: boolean;
    folder: TargetFolderInfo | null;
    initialType: string;
  }>({
    open: false,
    folder: null,
    initialType: '',
  });

  const allDocuments = client.client_document || [];
  const lots = client.properties ?? [];

  const folders: DocumentFolder[] = useMemo(() => {
    const lotMap = new Map(lots.map((lot) => [lot.property_id, lot]));
    const clientDocs: ClientDocument[] = [];
    const propertyDocsMap = new Map<string, ClientDocument[]>();
    const unlinkedDocs: ClientDocument[] = [];

    for (const doc of allDocuments) {
      if (!doc.property_id) {
        clientDocs.push(doc);
      } else if (lotMap.has(doc.property_id)) {
        const existing = propertyDocsMap.get(doc.property_id) ?? [];
        existing.push(doc);
        propertyDocsMap.set(doc.property_id, existing);
      } else {
        unlinkedDocs.push(doc);
      }
    }

    const result: DocumentFolder[] = [
      {
        id: 'client',
        label: 'Personal Documents',
        sublabel: client.full_name,
        isClient: true,
        targetInfo: {
          propertyId: null,
          label: 'Personal Documents',
          sublabel: client.full_name,
        },
        docs: clientDocs,
      },
    ];

    for (const lot of lots) {
      result.push({
        id: lot.property_id,
        label: `Block ${lot.block_number} Lot ${lot.lot_number}`,
        sublabel: lot.location || 'Property Lot',
        isClient: false,
        targetInfo: {
          propertyId: lot.property_id,
          label: `Block ${lot.block_number} Lot ${lot.lot_number}`,
          sublabel: lot.location || 'Property Lot',
        },
        docs: propertyDocsMap.get(lot.property_id) ?? [],
      });
    }

    if (unlinkedDocs.length > 0) {
      result.push({
        id: 'unlinked',
        label: 'Other / Unlinked Documents',
        sublabel: 'Documents not associated with current lots',
        isClient: false,
        targetInfo: {
          propertyId: null,
          label: 'Other / Unlinked Documents',
        },
        docs: unlinkedDocs,
      });
    }

    return result;
  }, [allDocuments, lots, client.full_name]);

  function isFolderExpanded(folderId: string): boolean {
    return expandedFolders[folderId] ?? true;
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !(prev[folderId] ?? true),
    }));
  }

  const areAllExpanded = useMemo(() => {
    return folders.every((f) => expandedFolders[f.id] ?? true);
  }, [folders, expandedFolders]);

  function toggleAllFolders() {
    const nextState = !areAllExpanded;
    const updated: Record<string, boolean> = {};
    for (const f of folders) {
      updated[f.id] = nextState;
    }
    setExpandedFolders(updated);
  }

  function openUpload(targetInfo: TargetFolderInfo, type: string = '') {
    const folderId = targetInfo.propertyId ?? 'client';
    setExpandedFolders((prev) => ({ ...prev, [folderId]: true }));
    setUploadModal({
      open: true,
      folder: targetInfo,
      initialType: type,
    });
  }

  useEffect(() => {
    const uploadParam = searchParams.get('uploadType');
    if (uploadParam) {
      openUpload(
        {
          propertyId: null,
          label: 'Personal Documents',
          sublabel: client.full_name,
        },
        uploadParam
      );
    }
  }, [searchParams, client.full_name]);

  const counts = DOC_TYPES.reduce(
    (acc, type) => {
      acc[type] = allDocuments.filter((doc) => doc.document_type === type).length;
      return acc;
    },
    {} as Record<StandardDocType, number>
  );

  const missing = REQUIRED_CLIENT_DOCUMENTS.filter(
    (type) => (counts[type as StandardDocType] ?? 0) === 0
  );

  async function handleUpload(file: File, documentType: string, propertyId: string | null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    if (propertyId) formData.append('property_id', propertyId);

    const created = await uploadDocument(formData);
    toast.success(`${getDocumentTypeLabel(documentType)} uploaded`);

    enqueueFile({
      attachmentId: created.document_id,
      file,
      fileName: file.name,
      entityType: 'client_document',
      keywords: [documentType, client.full_name].filter(Boolean).join(' '),
    });
  }

  async function handleConfirmDelete() {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDocument(docToDelete.document_id);
      toast.success('Document removed');
      setDocToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document');
    } finally {
      setIsDeleting(false);
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
      {/* Required Documents Checklist - only shown if documents are missing */}
      {missing.length > 0 && (
        <div className="space-y-3 rounded-lg border border-border bg-row-hover p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm font-semibold text-foreground">
              {missing.length} required document{missing.length === 1 ? '' : 's'} missing
            </p>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {REQUIRED_CLIENT_DOCUMENTS.map((type) => {
              const isPresent = (counts[type as StandardDocType] ?? 0) > 0;
              return (
                <li key={type} className="flex items-center gap-1.5 text-xs">
                  {isPresent ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <span className={isPresent ? 'text-foreground' : 'text-destructive'}>
                    {DOC_TYPE_LABEL[type]}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openUpload(
                        {
                          propertyId: null,
                          label: 'Personal Documents',
                          sublabel: client.full_name,
                        },
                        type
                      )
                    }
                    className="font-medium text-primary underline underline-offset-2 hover:text-[color-mix(in_srgb,var(--primary)_85%,black)]"
                    aria-label={`Upload ${DOC_TYPE_LABEL[type]}`}
                  >
                    Upload
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Toolbar / Tree Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Document Explorer</h3>
          <Badge variant="secondary">{allDocuments.length} total</Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant="quiet"
          onClick={toggleAllFolders}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
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

      {/* Windows Explorer / Google Drive Style Explorer Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border/60">
          {folders.map((folder) => {
            const isExpanded = isFolderExpanded(folder.id);
            return (
              <div key={folder.id} className="py-0.5">
                {/* Folder Row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleFolder(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleFolder(folder.id);
                    }
                  }}
                  className="group flex cursor-pointer items-center justify-between px-3 py-2 select-none hover:bg-row-hover transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-5 w-5 items-center justify-center text-muted-foreground">
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`}
                      />
                    </div>

                    {isExpanded ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-primary" />
                    )}

                    <span className="text-sm font-semibold text-foreground truncate">
                      {folder.label}
                    </span>

                    {folder.sublabel && (
                      <span className="text-xs text-muted-foreground truncate hidden md:inline">
                        ({folder.sublabel})
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground ml-1">
                      • {folder.docs.length} {folder.docs.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>

                  {/* Folder Upload Dropdown */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload
                          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          Select document type
                        </DropdownMenuLabel>
                        {(folder.isClient ? PERSONAL_DOC_TYPES : PROPERTY_DOC_TYPES).map((type) => (
                          <DropdownMenuItem
                            key={type}
                            onClick={() => openUpload(folder.targetInfo, type)}
                            className="text-xs cursor-pointer"
                          >
                            {DOC_TYPE_LABEL[type]}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openUpload(folder.targetInfo, 'custom')}
                          className="text-xs font-medium text-primary cursor-pointer"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Upload a custom file...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Indented Files List under Folder with collapse/expand animation */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                    isExpanded
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                  aria-hidden={!isExpanded}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-0.5 pb-1">
                    {folder.docs.length === 0 ? (
                      <div className="flex items-center justify-between pl-10 pr-3 py-1.5 text-xs text-muted-foreground italic">
                        <span>No documents in this folder</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-primary hover:text-primary not-italic font-normal"
                          onClick={() => openUpload(folder.targetInfo, '')}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Upload file
                        </Button>
                      </div>
                    ) : (
                      folder.docs.map((doc) => (
                        <div
                          key={doc.document_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleOpen(doc.document_id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void handleOpen(doc.document_id);
                            }
                          }}
                          className="group flex cursor-pointer select-none items-center justify-between pl-10 pr-3 py-1.5 text-sm hover:bg-row-hover transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {openingId === doc.document_id ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                            <span className="truncate text-foreground text-sm font-normal group-hover:text-primary transition-colors">
                              {getDocumentTypeLabel(doc.document_type)}
                            </span>
                          </div>

                          {/* Right side: Uploaded time and actions, visible on hover / focus */}
                          <div
                            className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-xs text-muted-foreground select-none">
                              Uploaded {formatActivityTime(doc.uploaded_at)}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleOpen(doc.document_id);
                                }}
                                disabled={openingId === doc.document_id}
                                className="h-7 px-2 text-xs gap-1"
                              >
                                {openingId === doc.document_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-3 w-3" />
                                )}
                                Open
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocToDelete(doc);
                                }}
                                className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Modal */}
      <ClientDocumentUploadModal
        open={uploadModal.open}
        onOpenChange={(open) => setUploadModal((prev) => ({ ...prev, open }))}
        targetFolder={uploadModal.folder}
        initialType={uploadModal.initialType}
        onUpload={handleUpload}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={docToDelete !== null}
        onOpenChange={(open) => !open && !isDeleting && setDocToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove &quot;
              {docToDelete ? getDocumentTypeLabel(docToDelete.document_type) : 'this document'}
              &quot;? This action cannot be undone and will permanently delete the file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete document'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
