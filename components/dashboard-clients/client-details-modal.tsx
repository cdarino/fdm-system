'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Phone,
  Mail,
  HelpCircle,
  Clock,
  LandPlot,
  Loader2,
  UserPlus,
  UserMinus,
  FileText,
  Upload,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Circle,
  MoreHorizontal,
  Star,
} from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients-page';
import { formatActivityTime } from '@/lib/format-activity-time';
import { formatDocumentName, humanizeDocumentName } from '@/lib/format-document-name';
import { toast } from 'sonner';
import {
  REQUIRED_CLIENT_DOCUMENTS,
  type ClientListItem,
  type ClientWithDetails,
  type DocType,
} from '@/lib/types/client';
import type { PropertyLot, PropertyLotWithClient } from '@/lib/types/property';
import type { OcrStatus } from '@/lib/types/search';

/** Upload categories, and the display order of the document filter chips. */
const DOCUMENT_TYPES: DocType[] = ['Valid ID', 'Contract', 'Deed of Sale', 'eCAR', 'Other'];

export function ClientDetailsModal({
  client,
  open,
}: {
  client: ClientListItem;
  open: boolean;
}) {
  // TODO: find a way to have multiple useMutation(), 
  // so that we could have some error & state handling for these operations here.
  // Right now, there are functions dedicated for each operation that does the same thing!
  const {
    getClientDetails,
    addContact,
    deleteContact,
    setPrimaryContact,
    addLog,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
    indexDocumentText,
    refreshMissingDocumentAlerts,
    listUnassignedLots,
    assignLot,
    unassignLot,
    closeDialog,
  } = useClients();
  const [details, setDetails] = useState<ClientWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contactType, setContactType] = useState('Phone');
  const [contactValue, setContactValue] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const [logType, setLogType] = useState('Call');
  const [logDescription, setLogDescription] = useState('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [documentType, setDocumentType] = useState<DocType>('Valid ID');
  const [categoryFilter, setCategoryFilter] = useState<DocType | 'all'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // OCR state is per-document and lives only for this open modal. The stored
  // result is in search_index; this just drives the row indicator.
  const [ocrStatus, setOcrStatus] = useState<Record<string, OcrStatus>>({});
  const [ocrProgress, setOcrProgress] = useState<Record<string, number>>({});

  const [availableLots, setAvailableLots] = useState<PropertyLotWithClient[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [isAssigningLot, setIsAssigningLot] = useState(false);
  const [unassigningLotId, setUnassigningLotId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    getClientDetails(client.client_id)
      .then((data) => setDetails(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load client profile'))
      .finally(() => setIsLoading(false));
  }, [open, client.client_id, getClientDetails]);

  const allDocuments = details?.client_document ?? [];

  const documentCounts = DOCUMENT_TYPES.reduce(
    (acc, type) => {
      acc[type] = allDocuments.filter((doc) => doc.document_type === type).length;
      return acc;
    },
    {} as Record<DocType, number>
  );

  /**
   * Filtering happens here rather than through `getClientDocuments`'s category
   * parameter: a client holds a handful of documents and they are already
   * loaded, so a round trip per chip would be slower and could flicker.
   */
  const presentCategories = DOCUMENT_TYPES.filter((type) => documentCounts[type] > 0);

  /**
   * Completeness is derived from the documents already loaded rather than from
   * `checkClientDocumentStatus`, so the checklist reacts the moment a file is
   * uploaded or removed. `REQUIRED_CLIENT_DOCUMENTS` stays the single source of
   * truth for what a complete file means, shared with the server action that
   * powers the missing-document alerts.
   */
  const missingDocuments = REQUIRED_CLIENT_DOCUMENTS.filter(
    (type) => documentCounts[type] === 0
  );
  const isFileComplete = missingDocuments.length === 0;

  const visibleDocuments =
    categoryFilter === 'all'
      ? allDocuments
      : allDocuments.filter((doc) => doc.document_type === categoryFilter);

  /**
   * Loaded once the profile is open rather than with it: most visits never
   * assign a lot, and the list is only needed when the picker is used.
   */
  useEffect(() => {
    if (!open) return;
    setIsLoadingLots(true);
    listUnassignedLots()
      .then(setAvailableLots)
      .catch(() => setAvailableLots([]))
      .finally(() => setIsLoadingLots(false));
  }, [open, listUnassignedLots]);

  async function handleAssignLot() {
    if (!selectedLotId) return;
    setIsAssigningLot(true);
    try {
      const assigned = await assignLot(selectedLotId, client.client_id);
      setDetails((prev) =>
        prev ? { ...prev, properties: [...(prev.properties ?? []), assigned] } : prev
      );
      setAvailableLots((prev) => prev.filter((lot) => lot.property_id !== selectedLotId));
      setSelectedLotId('');
      toast.success(`Block ${assigned.block_number} Lot ${assigned.lot_number} assigned`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign lot');
    } finally {
      setIsAssigningLot(false);
    }
  }

  async function handleUnassignLot(lot: PropertyLot) {
    setUnassigningLotId(lot.property_id);
    try {
      await unassignLot(lot.property_id);
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              properties: (prev.properties ?? []).filter(
                (p) => p.property_id !== lot.property_id
              ),
            }
          : prev
      );
      // Back on the market, so it belongs in the picker again.
      setAvailableLots((prev) => [{ ...lot, status: 'Open', client: null }, ...prev]);
      toast.success(`Block ${lot.block_number} Lot ${lot.lot_number} unassigned`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unassign lot');
    } finally {
      setUnassigningLotId(null);
    }
  }

  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('document_type', documentType);

      const created = await uploadDocument(client.client_id, formData);
      setDetails((prev) =>
        prev ? { ...prev, client_document: [created, ...prev.client_document] } : prev
      );

      const fileForOcr = selectedFile;
      const categoryForOcr = documentType;
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Document uploaded');
      // The client may have just become complete, so the list markers and the
      // alert count are now stale.
      void refreshMissingDocumentAlerts();

      // Deliberately not awaited: the file is already stored and listed, so
      // reading it is follow-up work the staff member should not wait through.
      void runOcr(created.document_id, fileForOcr, categoryForOcr);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  }

  /**
   * Reads the scanned file in the browser and stores the text against the
   * document. A failure here is not surfaced as an error toast: the document is
   * safely uploaded either way, and an unreadable scan is a normal outcome, so
   * the row simply shows that it could not be read.
   */
  async function runOcr(documentId: string, file: File, category: DocType) {
    setOcrStatus((prev) => ({ ...prev, [documentId]: 'running' }));
    setOcrProgress((prev) => ({ ...prev, [documentId]: 0 }));

    try {
      const { extractDocumentText, tidyExtractedText } = await import(
        '@/lib/ocr/extract-document-text'
      );

      const result = await extractDocumentText(file, (fraction) =>
        setOcrProgress((prev) => ({ ...prev, [documentId]: fraction }))
      );

      const content = tidyExtractedText(result.text);
      // The category and filename are searched alongside the page text, so a
      // document with an unreadable scan is still findable by what it is. The
      // name is split into words first, or it indexes as one unsearchable token.
      const keywords = [category, humanizeDocumentName(file.name)].join(' ');

      await indexDocumentText(documentId, content, keywords);
      setOcrStatus((prev) => ({ ...prev, [documentId]: content ? 'done' : 'failed' }));
    } catch (err) {
      console.error('OCR failed for document', documentId, err);
      setOcrStatus((prev) => ({ ...prev, [documentId]: 'failed' }));
    }
  }

  async function handleDeleteDocument(documentId: string) {
    try {
      await deleteDocument(documentId);
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              client_document: prev.client_document.filter((d) => d.document_id !== documentId),
            }
          : prev
      );
      toast.success('Document removed');
      void refreshMissingDocumentAlerts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document');
    }
  }

  /**
   * The bucket is private, so there is no stored URL to link to. A signed one
   * is minted per click and expires shortly after.
   */
  async function handleOpenDocument(documentId: string) {
    setOpeningDocumentId(documentId);
    try {
      const url = await getDocumentUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    } finally {
      setOpeningDocumentId(null);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactValue.trim()) return;
    setIsSubmittingContact(true);
    try {
      const created = await addContact(client.client_id, {
        type: contactType,
        value: contactValue.trim(),
        is_primary: (details?.contact_info.length ?? 0) === 0,
      });
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              contact_info: [created, ...prev.contact_info],
            }
          : null
      );
      setContactValue('');
      toast.success('Contact added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setIsSubmittingContact(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await deleteContact(client.client_id, contactId);
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              contact_info: prev.contact_info.filter((c) => c.contact_id !== contactId),
            }
          : null
      );
      toast.success('Contact removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  }

  async function handleSetPrimary(contactId: string) {
    try {
      await setPrimaryContact(client.client_id, contactId);
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              contact_info: prev.contact_info.map((c) => ({
                ...c,
                is_primary: c.contact_id === contactId,
              })),
            }
          : null
      );
      toast.success('Primary contact updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set primary contact');
    }
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logDescription.trim()) return;
    setIsSubmittingLog(true);
    try {
      const created = await addLog(client.client_id, {
        event_type: logType,
        description: logDescription.trim(),
      });
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              client_log: [created, ...prev.client_log],
            }
          : null
      );
      setLogDescription('');
      toast.success('Activity logged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record activity');
    } finally {
      setIsSubmittingLog(false);
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied "${text}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-h-[90vh] sm:max-w-4xl lg:max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{client.full_name}</DialogTitle>
          <DialogDescription>
            {client.address || 'No address recorded'}
            {client.tin_number ? ` · TIN ${client.tin_number}` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        ) : details ? (
          <div className="space-y-6 pt-2">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Contact details</h3>
                  <Badge variant="secondary">{details.contact_info.length}</Badge>
                </div>

                <div className="space-y-2">
                  {details.contact_info.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No contact numbers or emails recorded.</p>
                  ) : (
                    details.contact_info.map((contact) => {
                      const isPhone = contact.type.toLowerCase().includes('phone') || contact.type.toLowerCase().includes('mobile');
                      const Icon = isPhone ? Phone : contact.type.toLowerCase().includes('email') ? Mail : HelpCircle;
                      const isCopied = copiedId === contact.contact_id;

                      return (
                        <div
                          key={contact.contact_id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{contact.value}</p>
                              <p className="text-xs text-muted-foreground">{contact.type}</p>
                            </div>
                            {contact.is_primary && (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                Primary
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopy(contact.value, contact.contact_id)}
                              aria-label={`Copy ${contact.value}`}
                            >
                              {isCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  aria-label={`Actions for ${contact.value}`}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  disabled={contact.is_primary}
                                  onSelect={() => handleSetPrimary(contact.contact_id)}
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  {contact.is_primary ? 'Primary contact' : 'Set as primary'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => handleDeleteContact(contact.contact_id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete contact
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleAddContact} className="space-y-2.5 rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs font-medium text-foreground">Add new contact</p>
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <Select value={contactType} onValueChange={setContactType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Phone">Phone</SelectItem>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="e.g. 0917-123-4567"
                      value={contactValue}
                      onChange={(e) => setContactValue(e.target.value)}
                      className="h-9 flex-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingContact || !contactValue.trim()}
                    className="w-full gap-1.5"
                  >
                    {isSubmittingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add contact
                  </Button>
                </form>
              </div>

              {/* Activity History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Activity history</h3>
                  <Badge variant="secondary">{details.client_log.length}</Badge>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {details.client_log.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activity history recorded.</p>
                  ) : (
                    details.client_log.map((log) => (
                      <div
                        key={log.log_id}
                        className="rounded-lg border border-border bg-card p-2.5 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{log.event_type}</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatActivityTime(log.time)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {log.description || 'No description provided'}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddLog} className="space-y-2.5 rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs font-medium text-foreground">Record activity</p>
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <Select value={logType} onValueChange={setLogType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Call">Call</SelectItem>
                          <SelectItem value="Meeting">Meeting</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Note">Note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="What was discussed or done?"
                      value={logDescription}
                      onChange={(e) => setLogDescription(e.target.value)}
                      className="h-9 flex-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingLog || !logDescription.trim()}
                    className="w-full gap-1.5"
                  >
                    {isSubmittingLog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Record activity
                  </Button>
                </form>
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Documents</h3>
                <Badge variant="outline">{details.client_document.length}</Badge>
              </div>

              {/* Required-document checklist. Shown whether or not the file is
                  complete: staff need to see what counts as complete, not only
                  what is missing. */}
              <div
                className={`space-y-2 rounded-lg border p-3 ${
                  isFileComplete
                    ? 'border-success bg-[color-mix(in_srgb,var(--success)_8%,white)]'
                    : 'border-border bg-row-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isFileComplete ? (
                    <>
                      <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                      <p className="text-xs font-semibold text-success">
                        File complete
                      </p>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
                      <p className="text-xs font-semibold text-foreground">
                        {missingDocuments.length} required document
                        {missingDocuments.length === 1 ? '' : 's'} missing
                      </p>
                    </>
                  )}
                </div>

                <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {REQUIRED_CLIENT_DOCUMENTS.map((type) => {
                    const isPresent = documentCounts[type] > 0;
                    return (
                      <li key={type} className="flex items-center gap-1.5 text-xs">
                        {isPresent ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                        )}
                        <span
                          className={
                            isPresent ? 'text-foreground' : 'text-destructive'
                          }
                        >
                          {type}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Category filter: only categories this client actually has, so
                  the row stays short and every chip leads somewhere. */}
              {details.client_document.length > 0 && presentCategories.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Filter documents by category"
                  className="flex flex-wrap items-center gap-1 rounded-lg bg-row-hover p-1"
                >
                  {(['all', ...presentCategories] as const).map((category) => {
                    const isActive = categoryFilter === category;
                    const count =
                      category === 'all'
                        ? details.client_document.length
                        : documentCounts[category as DocType];

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

              {details.client_document.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No documents uploaded yet.
                </p>
              ) : visibleDocuments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No {categoryFilter} documents.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {visibleDocuments.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-row-hover">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {formatDocumentName(doc.file_path)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.document_type} · {formatActivityTime(doc.uploaded_at)}
                          {ocrStatus[doc.document_id] === 'running' && (
                            <span className="ml-1 text-primary">
                              · reading text{' '}
                              {Math.round((ocrProgress[doc.document_id] ?? 0) * 100)}%
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={openingDocumentId === doc.document_id}
                        onClick={() => void handleOpenDocument(doc.document_id)}
                        className="h-8 gap-1.5 border-border bg-card text-xs text-foreground hover:bg-row-hover hover:text-foreground"
                      >
                        {openingDocumentId === doc.document_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        View
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${doc.document_type}`}
                        onClick={() => void handleDeleteDocument(doc.document_id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleUploadDocument}
                className="space-y-2.5 rounded-lg border border-dashed border-border p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={documentType}
                    onValueChange={(v) => setDocumentType(v as DocType)}
                  >
                    <SelectTrigger className="sm:w-44">
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
                    className="flex-1"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploading || !selectedFile}
                  className="gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Upload document
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  PDF, JPEG or PNG, up to 10MB.
                </p>
              </form>
            </div>

            {/* Associated Property Lots */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Assigned Property Lots</h3>
                <Badge variant="outline">{details.properties?.length ?? 0}</Badge>
              </div>

              {!details.properties || details.properties.length === 0 ? (
                <p className="text-xs text-muted-foreground">No lots assigned yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {details.properties.map((lot) => (
                    <div
                      key={lot.property_id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-row-hover">
                        <LandPlot className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          Block {lot.block_number} Lot {lot.lot_number}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{lot.location}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {lot.status}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Unassign Block ${lot.block_number} Lot ${lot.lot_number}`}
                        disabled={unassigningLotId === lot.property_id}
                        onClick={() => void handleUnassignLot(lot)}
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        {unassigningLotId === lot.property_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row">
                <Select
                  value={selectedLotId}
                  onValueChange={setSelectedLotId}
                  disabled={isLoadingLots || availableLots.length === 0}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        isLoadingLots
                          ? 'Loading lots…'
                          : availableLots.length === 0
                            ? 'No unassigned lots available'
                            : 'Select an unassigned lot'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLots.map((lot) => (
                      <SelectItem key={lot.property_id} value={lot.property_id}>
                        Block {lot.block_number} Lot {lot.lot_number} · {lot.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={isAssigningLot || !selectedLotId}
                  onClick={() => void handleAssignLot()}
                  className="gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
                >
                  {isAssigningLot ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Assign lot
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={closeDialog}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

