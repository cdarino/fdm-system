'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  X,
  Users,
  SearchX,
  MoreHorizontal,
  Activity,
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
} from 'lucide-react';
import { getClientReportData } from '@/lib/actions/reports';
import { generateClientPdfReport } from '@/lib/reports/pdf-client-report';
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
import { cn } from '@/lib/utils';
import {
  ClientsProvider,
  useClients,
  ARCHIVED_STATUS,
  type ClientStatusFilter,
} from '@/lib/hooks/use-clients-page';
import { useMutation } from '@/lib/hooks/use-mutation';
import { formatActivityTime } from '@/lib/format-activity-time';
import { CreateClientModal } from './client-create-modal';
import { EditClientModal } from './client-edit-modal';
import { DeleteClientDialog } from './client-delete-dialog';
import { ArchiveClientDialog } from './client-archive-dialog';
import { DocumentSearchDialog } from './document-search-dialog';
import { MissingDocumentsDialog } from './missing-documents-dialog';
import { ClientDetailsModal } from './client-details-modal';
import { ClientCompactRow, ClientStatusPill } from './client-compact-row';
import { ClientRowsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import type { ClientListItem, ContactInfo } from '@/lib/types/client';

const GUTTER = 'px-4 sm:px-6';
const GUTTER_L = 'pl-4 sm:pl-6';
const GUTTER_R = 'pr-4 sm:pr-6';

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: ClientStatusFilter;
  onChange: (val: ClientStatusFilter) => void;
  counts: Record<ClientStatusFilter, number>;
}) {
  const tabs: { value: ClientStatusFilter; label: string }[] = [
    { value: 'all', label: 'Current' },
    { value: 'all-records', label: 'All records' },
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
    { value: 'Archived', label: 'Archived' },
  ];

  return (
    <div
      role="group"
      aria-label="Filter clients by status"
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-row-hover p-1"
    >
      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className="text-xs tabular-nums text-muted-foreground">{counts[tab.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

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
  isFiltered,
  onClear,
  onCreate,
}: {
  isFiltered: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  const Icon = isFiltered ? SearchX : Users;
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {isFiltered ? 'No matching clients' : 'No clients yet'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isFiltered
            ? 'Try a different search term, or clear the filters to view all clients.'
            : 'Add the first client to start maintaining client records and contact information.'}
        </p>
      </div>
      {isFiltered ? (
        <Button
          variant="outline"
          onClick={onClear}
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
  const { openDialog, restoreClient, missingDocumentAlerts } = useClients();
  const missingDocs = missingDocumentAlerts.find(
    (alert) => alert.client_id === client.client_id
  );
  const { state: restoreState, execute: runRestore } = useMutation(restoreClient);
  const isArchived = client.status === ARCHIVED_STATUS;
  const isRestoring = restoreState.status === 'pending';

  useEffect(() => {
    if (restoreState.status === 'error') {
      toast.error(restoreState.error);
    }
  }, [restoreState]);

  async function handleRestore() {
    const ok = await runRestore(client.client_id);
    if (ok) toast.success(`${client.full_name} restored`);
  }

  return (
    <TableRow
      className="group transition-colors duration-150 hover:bg-row-hover cursor-pointer"
      onClick={() => openDialog({ type: 'details', client })}
    >
      {/* Client identification */}
      <TableCell className={`py-4 pr-3 ${GUTTER_L}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-row-hover ring-1 ring-inset ring-border text-muted-foreground">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-foreground">{client.full_name}</p>
              {missingDocs && (
                <span
                  title={`Missing: ${missingDocs.missing_documents.join(', ')}`}
                  className="shrink-0"
                >
                  <ShieldAlert
                    className="h-3.5 w-3.5 text-destructive"
                    aria-label={`Incomplete file, missing ${missingDocs.missing_documents.join(', ')}`}
                  />
                </span>
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
          onViewMore={() => openDialog({ type: 'details', client })}
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
            <DropdownMenuItem onSelect={() => openDialog({ type: 'details', client })}>
              <Activity className="h-4 w-4 mr-2" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  const data = await getClientReportData(client.client_id);
                  generateClientPdfReport(data);
                  toast.success('Client PDF report generated');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to generate PDF report');
                }
              }}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog({ type: 'edit', client })}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isArchived ? (
              <DropdownMenuItem
                disabled={isRestoring}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleRestore();
                }}
              >
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Restore client
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => openDialog({ type: 'archive', client })}>
                <Archive className="h-4 w-4 mr-2" />
                Archive client
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => openDialog({ type: 'delete', client })}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function ClientsContent() {
  const {
    clients,
    visibleClients,
    isLoading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    activeDialog,
    openDialog,
    missingDocumentAlerts,
  } = useClients();

  const [isDocumentSearchOpen, setIsDocumentSearchOpen] = useState(false);
  const [isMissingDocsOpen, setIsMissingDocsOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  const isFiltered = search.trim() !== '' || statusFilter !== 'all';

  /**
   * Denominator for the footer: the set the current tab draws from, not every
   * loaded row. All records includes archives; Current excludes them.
   */
  const tabTotal = statusFilter === 'all-records' ? clients.length :
    statusFilter === 'Archived'
      ? clients.filter((c) => c.status === ARCHIVED_STATUS).length
      : clients.filter((c) => c.status !== ARCHIVED_STATUS).length;

  // Current clients exclude archives; All records matches the dashboard total.
  const active = clients.filter((c) => c.status !== ARCHIVED_STATUS);
  const counts: Record<ClientStatusFilter, number> = {
    all: active.length,
    'all-records': clients.length,
    Active: active.filter((c) => c.status.toLowerCase() === 'active').length,
    Inactive: active.filter((c) => c.status.toLowerCase() === 'inactive').length,
    Archived: clients.length - active.length,
  };

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
  }

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
                variant="outline"
                onClick={() => setIsMissingDocsOpen(true)}
                className="min-h-10 w-full gap-2 border-destructive bg-card text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_8%,white)] hover:text-destructive sm:w-auto"
              >
                <ShieldAlert className="h-4 w-4" />
                {missingDocumentAlerts.length} incomplete
                {missingDocumentAlerts.length === 1 ? ' file' : ' files'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsDocumentSearchOpen(true)}
              className="min-h-10 w-full gap-2 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground sm:w-auto"
            >
              <FileSearch className="h-4 w-4" />
              Search documents
            </Button>
            <Button
              onClick={() => openDialog({ type: 'create' })}
              className="min-h-10 w-full gap-2 bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          </div>
        </div>

        {/* Filters and search */}
        <div className={`flex flex-col gap-3 pb-5 xl:flex-row xl:items-center xl:justify-between ${GUTTER}`}>
          <StatusTabs value={statusFilter} onChange={setStatusFilter} counts={counts} />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, address, or contact"
                aria-label="Search clients"
                className="w-full pl-9 sm:w-72"
              />
            </div>
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="gap-1.5 text-muted-foreground hover:bg-row-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('standard')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  viewMode === 'standard'
                    ? 'bg-row-hover text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Standard view"
                aria-label="Standard view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  viewMode === 'compact'
                    ? 'bg-row-hover text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Compact view"
                aria-label="Compact view"
              >
                <Rows className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table / rows */}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {error ? (
            <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
              <p className="text-sm font-medium text-destructive">Could not load clients</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          ) : isLoading ? (
            <ClientRowsSkeleton />
          ) : visibleClients.length === 0 ? (
            <EmptyState
              isFiltered={isFiltered}
              onClear={clearFilters}
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
                  ? visibleClients.map((client) => (
                      <ClientRow key={client.client_id} client={client} />
                    ))
                  : visibleClients.map((client) => (
                      <ClientCompactRow
                        key={client.client_id}
                        client={client}
                        gutterL={GUTTER_L}
                        gutterR={GUTTER_R}
                        onOpenDetails={() => openDialog({ type: 'details', client })}
                        onOpenEdit={() => openDialog({ type: 'edit', client })}
                        onOpenDelete={() => openDialog({ type: 'delete', client })}
                      />
                    ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Summary footer */}
        {!error && (
          <div className={`flex shrink-0 items-center justify-between gap-3 border-t border-border py-3 ${GUTTER}`}>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isLoading
                ? 'Loading clients…'
                : isFiltered
                  ? `Showing ${visibleClients.length} of ${tabTotal} client${tabTotal === 1 ? '' : 's'}`
                  : `${tabTotal} client${tabTotal === 1 ? '' : 's'}`}
            </p>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      {activeDialog?.type === 'create' && <CreateClientModal open={true} />}
      {activeDialog?.type === 'edit' && <EditClientModal client={activeDialog.client} open={true} />}
      {activeDialog?.type === 'delete' && <DeleteClientDialog client={activeDialog.client} open={true} />}
      {activeDialog?.type === 'archive' && <ArchiveClientDialog client={activeDialog.client} open={true} />}
      <DocumentSearchDialog open={isDocumentSearchOpen} onOpenChange={setIsDocumentSearchOpen} />
      <MissingDocumentsDialog open={isMissingDocsOpen} onOpenChange={setIsMissingDocsOpen} />
      {activeDialog?.type === 'details' && <ClientDetailsModal client={activeDialog.client} open={true} />}
    </>
  );
}

export function ClientsSection({ clients = [] }: { clients?: ClientListItem[] }) {
  return (
    <ClientsProvider initialClients={clients}>
      <ClientsContent />
    </ClientsProvider>
  );
}
