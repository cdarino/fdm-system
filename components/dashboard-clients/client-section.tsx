'use client';

import { DOC_TYPE_LABEL } from '@/lib/types/client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardStickyHeader } from '@/components/ui/card';
import {
  FilterToolbar,
  ListPaginationFooter,
} from '@/components/ui/filter-toolbar';
import { IconBox } from '@/components/ui/icon-box';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  X,
  Users,
  SearchX,
  MoreHorizontal,
  Edit3,
  Archive,
  ArchiveRestore,
  FileSearch,
  ShieldAlert,
  Trash2,
  Copy,
  Check,
  Phone,
  Mail,
  UserRound,
  HelpCircle,
  LayoutList,
  Rows,
  FileDown,
  ExternalLink,
} from 'lucide-react';
import { getClientReportData } from '@/lib/actions/reports';
import { downloadClientDocumentsPdf } from '@/lib/download-client-documents';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  ClientsProvider,
  useClients,
  ARCHIVED_STATUS,
} from '@/lib/hooks/use-clients-page';
import { useMutation } from '@/lib/hooks/use-mutation';
import { useDialogPresence } from '@/lib/hooks/use-dialog-presence';
import { formatActivityTime } from '@/lib/format-activity-time';
import { getArchiveEligibility } from '@/lib/utils/archive-rules';
import { getClientRequirements } from '@/lib/utils/client-requirements';
import { CreateClientModal } from './client-create-modal';
import { EditClientModal } from './client-edit-modal';
import { DeleteClientDialog } from './client-delete-dialog';
import { ArchiveClientDialog } from './client-archive-dialog';
import { DocumentSearchDialog } from './document-search-dialog';
import { MissingDocumentsDialog } from './missing-documents-dialog';
import { ClientCompactRow, ClientStatusPill } from './client-compact-row';
import type { ClientListItem, ContactInfo } from '@/lib/types/client';

const GUTTER = 'px-4 sm:px-6';
const GUTTER_L = 'pl-4 sm:pl-6';
const GUTTER_R = 'pr-4 sm:pr-6';

function ContactDetailsCell({
  contacts,
  onViewMore,
}: {
  contacts: ContactInfo[];
  onViewMore: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (contacts.length === 0) {
    return <span className="text-xs text-muted-foreground">No contact details</span>;
  }

  // Sort contacts: phones first, then emails, then others
  const sorted = [...contacts].sort((a, b) => {
    const aType = a.type.toLowerCase();
    const bType = b.type.toLowerCase();
    const aIsPhone = aType.includes('phone') || aType.includes('mobile');
    const bIsPhone = bType.includes('phone') || bType.includes('mobile');
    if (aIsPhone && !bIsPhone) return -1;
    if (!aIsPhone && bIsPhone) return 1;

    const aIsEmail = aType.includes('email');
    const bIsEmail = bType.includes('email');
    if (aIsEmail && !bIsEmail) return -1;
    if (!aIsEmail && bIsEmail) return 1;

    return 0;
  });

  const visible = sorted.slice(0, 2);
  const remaining = sorted.length - visible.length;

  function copyValue(value: string, id: string) {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    toast.success(`Copied "${value}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-1">
      {visible.map((contact) => {
        const isPhone = contact.type.toLowerCase().includes('phone') || contact.type.toLowerCase().includes('mobile');
        const Icon = isPhone ? Phone : contact.type.toLowerCase().includes('email') ? Mail : HelpCircle;
        const isCopied = copiedId === contact.contact_id;

        return (
          <div key={contact.contact_id} className="group/item flex items-center gap-1.5 text-xs">
            <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground font-medium max-w-[140px] sm:max-w-[180px]">
              {contact.value}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyValue(contact.value, contact.contact_id);
              }}
              className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-foreground focus-visible:opacity-100"
              aria-label={`Copy ${contact.value}`}
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        );
      })}

      {remaining > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewMore();
          }}
          className="inline-block text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          +{remaining} more
        </button>
      )}
    </div>
  );
}

function EmptyState({
  controller,
  onCreate,
}: {
  controller: { isFiltered: boolean; clearAll: () => void };
  onCreate: () => void;
}) {
  const Icon = controller.isFiltered ? SearchX : Users;
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {controller.isFiltered ? 'No matching clients' : 'No clients yet'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {controller.isFiltered
            ? 'Try a different search term, or clear the filters to view all clients.'
            : 'Add the first client to start maintaining client records and contact information.'}
        </p>
      </div>
      {controller.isFiltered ? (
        <Button
          variant="outline"
          onClick={controller.clearAll}
          className="gap-1.5 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : (
        <Button
          onClick={onCreate}
          className="gap-2 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
        >
          <Plus className="h-4 w-4" />
          New Client
        </Button>
      )}
    </div>
  );
}

function ClientRow({ client }: { client: ClientListItem }) {
  const router = useRouter();
  const { openDialog, restoreClient, missingDocumentAlerts, isSystemAdmin } = useClients();
  const missingDocs = missingDocumentAlerts.find(
    (alert) => alert.client_id === client.client_id
  );
  
  // Calculate requirements status for badge
  const requirements = getClientRequirements(
    client,
    [] // We don't have full document list here, rely on missingDocumentAlerts
  );
  const isProfileIncomplete = !requirements.profileComplete;
  const hasDocIssues = missingDocs && missingDocs.missing_documents.length > 0;
  const isIncomplete = isProfileIncomplete || hasDocIssues;
  
  const { state: restoreState, execute: runRestore } = useMutation(restoreClient, {
    onSuccess: () => {
      toast.success(`${client.full_name} restored`);
    },
  });
  const isArchived = client.status === ARCHIVED_STATUS || Boolean(client.is_archived);
  const eligibility = getArchiveEligibility(isArchived, client.archived_at);
  const isRestoring = restoreState.status === 'pending';

  async function handleRestore() {
    await runRestore(client.client_id);
  }

  function handleRowClick() {
    router.push(`/dashboard/clients/${client.client_id}`);
  }

    return (
      <Card
        variant="interactive"
        onClick={handleRowClick}
        className="group flex flex-col justify-between p-4 sm:p-5 hover:border-primary"
      >
      <div className="flex items-start gap-3">
        <IconBox size="md" shape="circle">
          <UserRound className="h-4 w-4" />
        </IconBox>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/clients/${client.client_id}`}
              onClick={(event) => event.stopPropagation()}
              className="min-w-0 flex-1 truncate rounded text-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {client.full_name}
            </Link>
            <ClientStatusPill status={client.status} />
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {client.address || 'No address recorded'}
          </p>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Actions for ${client.full_name}`}
                className="-mr-2 -mt-2 text-muted-foreground"
                size="icon"
                variant="ghost"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<FileDown className="h-4 w-4" />}
              onSelect={(event) => {
                event.preventDefault();
                  void downloadClientDocumentsPdf(client.client_id, client.full_name);
              }}
            >
              Download uploaded files as PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<ExternalLink className="h-4 w-4" />}
              onSelect={() => router.push(`/dashboard/clients/${client.client_id}`)}
            >
              Open profile
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<FileDown className="h-4 w-4" />}
              onSelect={async () => {
                try {
                  const data = await getClientReportData(client.client_id);
                  // Loaded on demand so jsPDF stays out of the page bundle.
                  const { generateClientPdfReport } = await import('@/lib/reports/pdf-client-report');
                  generateClientPdfReport(data);
                  toast.success('Client PDF report generated');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to generate PDF report');
                }
              }}
            >
              Client summary PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Edit3 className="h-4 w-4" />}
              onSelect={() => openDialog({ type: 'edit', client })}
            >
              Edit client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              hidden={!isArchived}
              icon={<ArchiveRestore className="h-4 w-4" />}
              disabled={isRestoring}
              onSelect={(e) => {
                e.preventDefault();
                void handleRestore();
              }}
            >
              Restore client
            </DropdownMenuItem>
            <DropdownMenuItem
              hidden={isArchived}
              icon={<Archive className="h-4 w-4" />}
              onSelect={() => openDialog({ type: 'archive', client })}
            >
              Archive client
            </DropdownMenuItem>
            <DropdownMenuItem
              hidden={!isArchived || !isSystemAdmin}
              disabled={!eligibility.isEligibleForDelete}
              disabledReason={eligibility.tooltipReason}
              variant="destructive"
              icon={<Trash2 className="h-4 w-4" />}
              onSelect={() => openDialog({ type: 'delete', client })}
            >
              Delete client
            </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
            <ContactDetailsCell contacts={client.contact_info} onViewMore={handleRowClick} />
          </div>
          {isIncomplete && (
            <Badge
              variant="warning"
              shape="pill"
              title={
                isProfileIncomplete && hasDocIssues
                  ? `Missing profile fields and documents: ${[...requirements.missingProfile, ...missingDocs.missing_documents.map((type) => DOC_TYPE_LABEL[type])].join(', ')}`
                  : isProfileIncomplete
                    ? `Incomplete profile: ${requirements.missingProfile.join(', ')}`
                    : `Missing documents: ${missingDocs?.missing_documents.map((type) => DOC_TYPE_LABEL[type]).join(', ')}`
              }
            >
              <ShieldAlert className="mr-1 h-3 w-3" />
              Needs attention
            </Badge>
          )}
        </div>

        <div className="rounded-md bg-row-hover px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latest activity</p>
          {client.latest_activity ? (
            <>
              <p className="mt-1 truncate text-xs font-medium text-foreground">
                {client.latest_activity.description || 'Activity recorded'}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {client.latest_activity.performer_name} · {formatActivityTime(client.latest_activity.time)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No activity logged</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ClientsContent() {
  const router = useRouter();
  const {
    controller,
    activeDialog,
    openDialog,
    missingDocumentAlerts,
    restoreClient,
  } = useClients();

  const { rendered: dialog, isOpen: isDialogOpen } = useDialogPresence(activeDialog);

  const [isDocumentSearchOpen, setIsDocumentSearchOpen] = useState(false);
  const [isMissingDocsOpen, setIsMissingDocsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  return (
    <>
      <Card variant="section">
        <CardStickyHeader>
          {/* Header */}
          <div className={`flex flex-wrap items-start justify-between gap-4 pb-5 pt-6 ${GUTTER}`}>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
                Find a client
              </h2>
              <p className="text-sm text-muted-foreground">
                Open a profile to review contacts, documents, lots, and follow-ups.
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
              {missingDocumentAlerts.length > 0 && (
                <Button
                  variant="danger"
                  responsive
                  onClick={() => setIsMissingDocsOpen(true)}
                  className="min-h-10 gap-2"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {missingDocumentAlerts.length} incomplete
                  {missingDocumentAlerts.length === 1 ? ' file' : ' files'}
                </Button>
              )}
              <Button
                variant="quiet"
                responsive
                onClick={() => setIsDocumentSearchOpen(true)}
                className="min-h-10 gap-2"
              >
                <FileSearch className="h-4 w-4" />
                Search documents
              </Button>
              <Button
                responsive
                onClick={() => openDialog({ type: 'create' })}
                className="min-h-10 gap-2"
              >
                <Plus className="h-4 w-4" />
                New Client
              </Button>
            </div>
          </div>

          {/* Filters, search, and sort */}
          <FilterToolbar
            controller={controller}
            viewMode={{
              value: viewMode,
              onChange: setViewMode,
              options: [
                { value: 'standard', label: 'Standard view', icon: <LayoutList className="h-4 w-4" /> },
                { value: 'compact', label: 'Compact view', icon: <Rows className="h-4 w-4" /> },
              ],
            }}
          />
        </CardStickyHeader>

        {/* Table / rows */}
          {controller.matchedItems.length === 0 ? (
            <EmptyState
              controller={controller}
              onCreate={() => openDialog({ type: 'create' })}
            />
          ) : viewMode === 'standard' ? (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
              {controller.truncatedItems.map((client) => (
                <ClientRow key={client.client_id} client={client} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-card">
                <TableRow className="bg-card hover:bg-card">
                  <TableHead className={`h-9 pr-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_L}`}>
                    Client
                  </TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Address
                  </TableHead>
                  <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className={`h-9 pl-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_R} w-12`}>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {controller.truncatedItems.map((client) => (
                  <ClientCompactRow
                    key={client.client_id}
                    client={client}
                    gutterL={GUTTER_L}
                    gutterR={GUTTER_R}
                    onOpenDetails={() => router.push(`/dashboard/clients/${client.client_id}`)}
                    onOpenEdit={() => openDialog({ type: 'edit', client })}
                    onOpenArchive={() => openDialog({ type: 'archive', client })}
                    onOpenRestore={() => void restoreClient(client.client_id)}
                    onOpenDelete={() => openDialog({ type: 'delete', client })}
                  />
                ))}
              </TableBody>
            </Table>
          )}

        {/* Summary footer */}
        <ListPaginationFooter
          controller={controller}
          singularLabel="client"
          pluralLabel="clients"
        />
      </Card>

      {/* Dialogs */}
      {dialog?.type === 'create' && <CreateClientModal open={isDialogOpen} />}
      {dialog?.type === 'edit' && <EditClientModal client={dialog.client} open={isDialogOpen} />}
      {dialog?.type === 'delete' && <DeleteClientDialog client={dialog.client} open={isDialogOpen} />}
      {dialog?.type === 'archive' && <ArchiveClientDialog client={dialog.client} open={isDialogOpen} />}
      <DocumentSearchDialog open={isDocumentSearchOpen} onOpenChange={setIsDocumentSearchOpen} />
      <MissingDocumentsDialog open={isMissingDocsOpen} onOpenChange={setIsMissingDocsOpen} />
    </>
  );
}

export function ClientsSection({
  clients = [],
}: {
  clients?: ClientListItem[];
}) {
  return (
    <ClientsProvider initialClients={clients}>
      <ClientsContent />
    </ClientsProvider>
  );
}
