'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileTree, FileTreeFolder, FileTreeItem } from '@/components/ui/file-tree';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trash2,
  Check,
  Circle,
  Upload,
  ExternalLink,
  Pencil,
  ShieldAlert,
  Loader2,
  ChevronDown,
  Plus,
  FolderOpen,
  Folder,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatActivityTime } from '@/lib/format-activity-time';
import { getDocumentEffectiveLabel } from '@/lib/format-document-name';
import { useClientDetail } from '@/lib/hooks/use-client-detail';
import { useOcrQueue } from '@/lib/hooks/use-ocr-queue';
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  PERSONAL_DOC_TYPES,
  PROPERTY_DOC_TYPES,
  REQUIRED_CLIENT_DOCUMENTS,
  compareDocumentsByCategory,
  getDocumentTypeLabel,
  type StandardDocType,
  type ClientDocument,
} from '@/lib/types/client';
import {
  ClientDocumentUploadModal,
  type TargetFolderInfo,
} from './client-document-upload-modal';
import { ClientDocumentLabelModal } from './client-document-label-modal';

interface DocumentFolder {
  id: string;
  label: string;
  sublabel?: string;
  isClient: boolean;
  targetInfo: TargetFolderInfo;
  docs: ClientDocument[];
}

export function ClientDetailDocuments() {
  const { client, uploadDocument, updateDocumentLabel, deleteDocument, getDocumentUrl } = useClientDetail();
  const { enqueueFile } = useOcrQueue();
  const searchParams = useSearchParams();

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [docToLabel, setDocToLabel] = useState<ClientDocument | null>(null);
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
        docs: [...clientDocs].sort(compareDocumentsByCategory),
      },
    ];

    for (const lot of lotMap.values()) {
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
        docs: [...(propertyDocsMap.get(lot.property_id) ?? [])].sort(compareDocumentsByCategory),
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
        docs: [...unlinkedDocs].sort(compareDocumentsByCategory),
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

      <TooltipProvider delayDuration={300}>
        <FileTree>
          {folders.map((folder) => {
            const categoryCounts = new Map<string, number>();
            for (const d of folder.docs) {
              categoryCounts.set(d.document_type, (categoryCounts.get(d.document_type) ?? 0) + 1);
            }

            return (
              <FileTreeFolder
                key={folder.id}
                depth={0}
                label={folder.label}
                sublabel={folder.sublabel}
                meta={`${folder.docs.length} ${folder.docs.length === 1 ? 'file' : 'files'}`}
                expanded={isFolderExpanded(folder.id)}
                onToggle={() => toggleFolder(folder.id)}
                actions={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          className="cursor-pointer text-xs"
                        >
                          {DOC_TYPE_LABEL[type]}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openUpload(folder.targetInfo, 'custom')}
                        className="cursor-pointer text-xs font-medium text-primary"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Upload a custom file...
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              >
                {folder.docs.length === 0 ? (
                  <div className="flex items-center justify-between py-1.5 pl-10 pr-3 text-xs italic text-muted-foreground">
                    <span>No documents in this folder</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs font-normal not-italic text-primary hover:text-primary"
                      onClick={() => openUpload(folder.targetInfo, '')}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Upload file
                    </Button>
                  </div>
                ) : (
                  folder.docs.map((doc) => {
                    const countInCategory = categoryCounts.get(doc.document_type) ?? 0;
                    const showLabel = countInCategory >= 2 || Boolean(doc.label);
                    const secondaryLabel = showLabel ? getDocumentEffectiveLabel(doc) : undefined;

                    return (
                      <FileTreeItem
                        key={doc.document_id}
                        depth={1}
                        label={getDocumentTypeLabel(doc.document_type)}
                        secondaryLabel={secondaryLabel}
                        loading={openingId === doc.document_id}
                        onClick={() => void handleOpen(doc.document_id)}
                        hoverActions={
                          <>
                            <span className="select-none text-xs text-muted-foreground">
                              {doc.is_autogenerated ? 'Autogenerated' : 'Uploaded'}{' '}
                              {formatActivityTime(doc.uploaded_at)}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => void handleOpen(doc.document_id)}
                                    disabled={openingId === doc.document_id}
                                    aria-label="Open document"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  >
                                    {openingId === doc.document_id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Open document</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDocToLabel(doc)}
                                    aria-label="Edit label"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit label</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDocToDelete(doc)}
                                    aria-label="Delete document"
                                    className="h-7 w-7 text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete document</TooltipContent>
                              </Tooltip>
                            </div>
                          </>
                        }
                      />
                    );
                  })
                )}
              </FileTreeFolder>
            );
          })}
        </FileTree>
      </TooltipProvider>

      {/* Upload Modal */}
      <ClientDocumentUploadModal
        open={uploadModal.open}
        onOpenChange={(open) => setUploadModal((prev) => ({ ...prev, open }))}
        targetFolder={uploadModal.folder}
        initialType={uploadModal.initialType}
        onUpload={handleUpload}
      />

      {/* Label Modal */}
      <ClientDocumentLabelModal
        document={docToLabel}
        onOpenChange={(open) => !open && setDocToLabel(null)}
        onSave={async (documentId, label) => {
          await updateDocumentLabel(documentId, label);
        }}
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
              className="bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_85%,black)]"
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
