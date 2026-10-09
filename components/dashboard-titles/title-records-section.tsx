'use client';

import { useState } from 'react';
import { FileCheck, FilePlus, FolderOpen, PenLine, SearchX, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTableFooter } from '@/components/ui/card';
import { FilterToolbar } from '@/components/ui/filter-toolbar';
import { IconBox } from '@/components/ui/icon-box';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TitleRecordDialog } from './title-record-dialog';
import { TitleDocumentsDialog } from './title-documents-dialog';
import { useLandTitles, lotRefLabel } from '@/lib/hooks/use-land-titles';
import { useSession } from '@/lib/hooks/use-session';
import { TITLE_STATUS_VARIANT } from '@/lib/status-colors';
import {
  documentsForLot,
  getMissingReleaseDocuments,
  getRequiredReleaseDocuments,
} from '@/lib/utils/release-requirements';
import {
  TITLE_HOLDER_LABEL,
  type AccountAwaitingTitle,
  type LandTitle,
} from '@/lib/types/title';
import type { TitleRecordFormData } from '@/lib/validations/title';

const GUTTER = 'px-4 sm:px-6';
const GUTTER_L = 'pl-4 sm:pl-6';
const GUTTER_R = 'pr-4 sm:pr-6';
const HEAD = 'h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground';

const DATE = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

type DialogState =
  | { mode: 'create'; account: AccountAwaitingTitle; subject: string; defaults?: undefined }
  | { mode: 'edit'; title: LandTitle; subject: string; defaults: Partial<TitleRecordFormData> };

function EmptyState({ isFiltered, message, onClear }: { isFiltered: boolean; message: string; onClear: () => void }) {
  const Icon = isFiltered ? SearchX : FileCheck;
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{isFiltered ? 'No matches' : 'Nothing here yet'}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isFiltered ? 'Try a different search term.' : message}
        </p>
      </div>
      {isFiltered && (
        <Button variant="quiet" onClick={onClear} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear search
        </Button>
      )}
    </div>
  );
}

function LotCell({ lot }: { lot: { location: string; block_number: number; lot_number: number } | null | undefined }) {
  return (
    <>
      <p className="text-sm text-foreground">{lotRefLabel(lot)}</p>
      <p className="text-xs text-muted-foreground">{lot?.location ?? ''}</p>
    </>
  );
}

function ClientCell({ name, detail }: { name: string | undefined; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconBox size="md" shape="square">
        <FileCheck className="h-4 w-4 text-muted-foreground" />
      </IconBox>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name ?? 'Unknown client'}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ReleasePacketProgress({ title }: { title: LandTitle }) {
  const uploaded = documentsForLot(title.client?.documents ?? [], title.property_id).map(
    (d) => d.document_type
  );
  const required = getRequiredReleaseDocuments(title.title_holder).length;
  const missing = getMissingReleaseDocuments(title.title_holder, uploaded).length;
  const done = required - missing;

  return missing === 0 ? (
    <span className="text-success">Complete</span>
  ) : (
    <span className="text-muted-foreground">
      {done} of {required} uploaded
    </span>
  );
}

export function TitleRecordsSection({
  initialTitles,
  initialAwaiting,
}: {
  initialTitles: LandTitle[];
  initialAwaiting: AccountAwaitingTitle[];
}) {
  const { hasPermission } = useSession();
  const canCreate = hasPermission('legal.create');
  const canEdit = hasPermission('legal.update');

  const {
    titles,
    awaiting,
    visibleTitles,
    visibleAwaiting,
    search,
    setSearch,
    tab,
    setTab,
    createTitle,
    editTitle,
    loadDocuments,
    uploadDocument,
    removeDocument,
    getDocumentUrl,
  } = useLandTitles(initialTitles, initialAwaiting);

  // Kept as an id so the dialog always reads the latest copy of the title.
  const [documentsTitleId, setDocumentsTitleId] = useState<string | null>(null);
  const documentsTitle = titles.find((t) => t.title_id === documentsTitleId) ?? null;

  // The dialog state is kept as one object so its `defaults` stay stable while
  // the dialog is open, and typing is not reset on re-render.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  function openDialog(next: DialogState) {
    setDialog(next);
    setIsDialogOpen(true);
  }

  async function submitDialog(input: TitleRecordFormData) {
    if (!dialog) throw new Error('No title selected');
    return dialog.mode === 'create'
      ? createTitle(dialog.account.property.property_id, input)
      : editTitle(dialog.title.title_id, input);
  }

  const isSearching = search.trim() !== '';
  const shownCount = tab === 'awaiting' ? visibleAwaiting.length : visibleTitles.length;
  const totalCount = tab === 'awaiting' ? awaiting.length : titles.length;

  return (
    <>
      <Card variant="section">
        <div className={`space-y-1 pb-5 pt-6 ${GUTTER}`}>
          <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">Land Titles</h2>
          <p className="text-sm text-muted-foreground">
            Create a title record for each account Billing has cleared as fully paid.
          </p>
        </div>

        <FilterToolbar
          tabs={{
            value: tab,
            onChange: setTab,
            ariaLabel: 'Choose list',
            items: [
              { value: 'awaiting', label: 'Cleared by Billing', count: awaiting.length },
              { value: 'titles', label: 'Title records', count: titles.length },
            ],
          }}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search client, lot or title number',
            ariaLabel: 'Search land titles',
          }}
          isFiltered={isSearching}
          onClear={() => setSearch('')}
        />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {tab === 'awaiting' ? (
            visibleAwaiting.length === 0 ? (
              <EmptyState
                isFiltered={isSearching && awaiting.length > 0}
                message="An account appears here once Billing clears it as fully paid."
                onClear={() => setSearch('')}
              />
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-card hover:bg-card">
                    <TableHead className={`${HEAD} pr-3 ${GUTTER_L}`}>Client</TableHead>
                    <TableHead className={`${HEAD} hidden px-3 md:table-cell`}>Lot</TableHead>
                    <TableHead className={`${HEAD} pl-3 text-right ${GUTTER_R}`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAwaiting.map((account) => {
                    const subject = `${account.client?.full_name ?? 'Unknown client'}, ${lotRefLabel(account.property)}, ${account.property.location}`;
                    return (
                      <TableRow key={account.account_id} className="transition-colors duration-150 hover:bg-row-hover">
                        <TableCell className={`py-4 pr-3 ${GUTTER_L}`}>
                          <ClientCell
                            name={account.client?.full_name}
                            detail={
                              account.co_buyers.length > 0
                                ? `With ${account.co_buyers.join(', ')}. Cleared ${DATE.format(new Date(account.cleared_at))}`
                                : `Cleared by Billing ${DATE.format(new Date(account.cleared_at))}`
                            }
                          />
                        </TableCell>
                        <TableCell className="hidden px-3 py-4 md:table-cell">
                          <LotCell lot={account.property} />
                        </TableCell>
                        <TableCell className={`py-4 pl-3 text-right ${GUTTER_R}`}>
                          {canCreate && (
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openDialog({ mode: 'create', account, subject })}
                            >
                              <FilePlus className="h-3.5 w-3.5" />
                              Create title record
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : visibleTitles.length === 0 ? (
            <EmptyState
              isFiltered={isSearching && titles.length > 0}
              message="Title records created by Legal appear here."
              onClear={() => setSearch('')}
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-card hover:bg-card">
                  <TableHead className={`${HEAD} pr-3 ${GUTTER_L}`}>Client</TableHead>
                  <TableHead className={`${HEAD} hidden px-3 md:table-cell`}>Lot</TableHead>
                  <TableHead className={`${HEAD} hidden px-3 lg:table-cell`}>Title number</TableHead>
                  <TableHead className={`${HEAD} hidden px-3 lg:table-cell`}>Name on title</TableHead>
                  <TableHead className={`${HEAD} px-3`}>Status</TableHead>
                  <TableHead className={`${HEAD} hidden px-3 md:table-cell`}>Release packet</TableHead>
                  <TableHead className={`${HEAD} pl-3 text-right ${GUTTER_R}`}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTitles.map((title) => {
                  const subject = `${title.client?.full_name ?? 'Unknown client'}, ${lotRefLabel(title.property)}${
                    title.property?.location ? `, ${title.property.location}` : ''
                  }`;
                  return (
                    <TableRow key={title.title_id} className="transition-colors duration-150 hover:bg-row-hover">
                      <TableCell className={`py-4 pr-3 ${GUTTER_L}`}>
                        <ClientCell
                          name={title.client?.full_name}
                          detail={`Created ${DATE.format(new Date(title.created_at))}`}
                        />
                      </TableCell>
                      <TableCell className="hidden px-3 py-4 md:table-cell">
                        <LotCell lot={title.property} />
                      </TableCell>
                      <TableCell className="hidden px-3 py-4 font-mono text-sm lg:table-cell">
                        {title.title_number ?? <span className="font-sans text-muted-foreground">Not recorded</span>}
                      </TableCell>
                      <TableCell className="hidden px-3 py-4 text-sm lg:table-cell">
                        {title.title_holder
                          ? <span className="text-foreground">{TITLE_HOLDER_LABEL[title.title_holder]}</span>
                          : <span className="text-muted-foreground">Not recorded</span>}
                      </TableCell>
                      <TableCell className="px-3 py-4">
                        <Badge variant={TITLE_STATUS_VARIANT[title.status] ?? 'muted'} shape="pill" dot>
                          {title.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden px-3 py-4 text-sm md:table-cell">
                        <ReleasePacketProgress title={title} />
                      </TableCell>
                      <TableCell className={`py-4 pl-3 text-right ${GUTTER_R}`}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="quiet"
                            className="gap-1.5"
                            onClick={() => setDocumentsTitleId(title.title_id)}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Documents
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="quiet"
                              className="gap-1.5"
                              onClick={() =>
                                openDialog({
                                  mode: 'edit',
                                  title,
                                  subject,
                                  defaults: {
                                    title_holder: title.title_holder ?? undefined,
                                    title_number: title.title_number ?? '',
                                  },
                                })
                              }
                            >
                              <PenLine className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <CardTableFooter>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {isSearching ? `Showing ${shownCount} of ${totalCount}` : `${totalCount} total`}
          </p>
        </CardTableFooter>
      </Card>

      <TitleDocumentsDialog
        title={documentsTitle}
        open={documentsTitleId !== null}
        onOpenChange={(open: boolean) => !open && setDocumentsTitleId(null)}
        canUpload={canEdit}
        loadDocuments={loadDocuments}
        uploadDocument={uploadDocument}
        removeDocument={removeDocument}
        getDocumentUrl={getDocumentUrl}
      />

      <TitleRecordDialog
        mode={dialog?.mode ?? 'create'}
        subject={dialog?.subject ?? ''}
        defaults={dialog?.defaults}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={submitDialog}
      />
    </>
  );
}
