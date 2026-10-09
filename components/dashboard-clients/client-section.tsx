'use client';

import { DOC_TYPE_LABEL } from '@/lib/types/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
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
import { ClientRowsSkeleton } from '@/components/dashboard-layout/page-skeletons';
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
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
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
    <TableRow
      className="group transition-colors duration-150 hover:bg-row-hover cursor-pointer"
      onClick={handleRowClick}
    >
      {/* Client identification */}
      <TableCell className={`py-4 pr-3 ${GUTTER_L}`}>
        <div className="flex items-center gap-3">
          <IconBox size="md" shape="circle">
            <UserRound className="h-4 w-4" />
          </IconBox>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground">{client.full_name}</p>
              {isIncomplete && (
                <Badge
                  variant="destructive"
                  className="shrink-0 text-[10px]"
                  title={
                    isProfileIncomplete && hasDocIssues
                      ? `Missing profile fields and documents: ${missingDocs.missing_documents.map((t) => DOC_TYPE_LABEL[t]).join(', ')}`
                      : isProfileIncomplete
                        ? 'Incomplete profile (missing address or TIN)'
                        : `Missing documents: ${missingDocs?.missing_documents.map((t) => DOC_TYPE_LABEL[t]).join(', ')}`
                  }
                >
                  <ShieldAlert className="mr-1 h-2.5 w-2.5" />
                  Incomplete
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {client.address || 'No address recorded'}
            </p>
          </div>
        </div>
      </TableCell>

      {/* Contact details */}
      <TableCell className="px-3 py-4">
        <ContactDetailsCell
          contacts={client.contact_info}
          onViewMore={handleRowClick}
        />
      </TableCell>

      {/* Status */}
      <TableCell className="px-3 py-4">
        <ClientStatusPill status={client.status} />
      </TableCell>

      {/* Latest activity */}
      <TableCell className="hidden px-3 py-4 sm:table-cell">
        {client.latest_activity ? (
          <div className="space-y-0.5 max-w-xs">
            <p className="truncate text-xs font-medium text-foreground">
              {client.latest_activity.description || 'Activity recorded'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              by {client.latest_activity.performer_name} · {formatActivityTime(client.latest_activity.time)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No recent activity</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell className={`py-4 pl-3 ${GUTTER_R}`} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${client.full_name}`}
              className="opacity-70 group-hover:opacity-100"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
              Export PDF
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
      </TableCell>
    </TableRow>
  );
}

function ClientsContent() {
  const router = useRouter();
  const {
    controller,
    isLoading,
    error,
    activeDialog,
    openDialog,
    missingDocumentAlerts,
    restoreClient,
  } = useClients();

  const [isDocumentSearchOpen, setIsDocumentSearchOpen] = useState(false);
  const [isMissingDocsOpen, setIsMissingDocsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  return (
    <>
      <Card variant="section">
        {/* Header */}
        <div className={`flex flex-wrap items-start justify-between gap-4 pb-5 pt-6 ${GUTTER}`}>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
              Client Directory
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage client records, contact information, and activity history.
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

        {/* Table / rows */}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {error ? (
            <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
              <p className="text-sm font-medium text-destructive">Could not load clients</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          ) : isLoading ? (
            <ClientRowsSkeleton />
          ) : controller.matchedItems.length === 0 ? (
            <EmptyState
              controller={controller}
              onCreate={() => openDialog({ type: 'create' })}
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                {viewMode === 'standard' ? (
                  <TableRow className="bg-card hover:bg-card">
                    <TableHead className={`h-11 pr-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_L}`}>
                      Client
                    </TableHead>
                    <TableHead className="h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contact Details
                    </TableHead>
                    <TableHead className="h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="hidden h-11 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Latest Activity
                    </TableHead>
                    <TableHead className={`h-11 pl-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${GUTTER_R} w-12`}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                ) : (
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
                )}
              </TableHeader>
              <TableBody>
                {viewMode === 'standard'
                  ? controller.truncatedItems.map((client) => (
                      <ClientRow key={client.client_id} client={client} />
                    ))
                  : controller.truncatedItems.map((client) => (
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
        </div>

        {/* Summary footer */}
        {!error && (
          <ListPaginationFooter
            controller={controller}
            isLoading={isLoading}
            singularLabel="client"
            pluralLabel="clients"
            loadingText="Loading clients…"
          />
        )}
      </Card>

      {/* Dialogs */}
      {activeDialog?.type === 'create' && <CreateClientModal open={true} />}
      {activeDialog?.type === 'edit' && <EditClientModal client={activeDialog.client} open={true} />}
      {activeDialog?.type === 'delete' && <DeleteClientDialog client={activeDialog.client} open={true} />}
      {activeDialog?.type === 'archive' && <ArchiveClientDialog client={activeDialog.client} open={true} />}
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
