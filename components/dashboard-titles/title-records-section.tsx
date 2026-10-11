'use client';

import { useMemo } from 'react';
import { ArrowRight, FileCheck, FolderOpen, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTableFooter, CardStickyHeader } from '@/components/ui/card';
import { FilterToolbar } from '@/components/ui/filter-toolbar';
import { TitleDialog } from './title-dialog';
import { TitleRecordCard } from './title-record-card';
import { TitleStatsStrip } from './title-stats-strip';
import {
  LandTitlesProvider,
  useLandTitles,
  type LegalTab,
  type TitleDialogItem,
} from '@/lib/hooks/use-land-titles';
import { useDialogPresence } from '@/lib/hooks/use-dialog-presence';
import type {
  AccountAwaitingTitle,
  LandTitle,
} from '@/lib/types/title';

function EmptyState({
  isFiltered,
  message,
  onClear,
}: {
  isFiltered: boolean;
  message: string;
  onClear: () => void;
}) {
  const Icon = isFiltered ? SearchX : FileCheck;
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {isFiltered ? 'No matches' : 'Nothing here yet'}
        </p>
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

function InitialStagePrompt({ onSelectStage }: { onSelectStage: (tab: LegalTab) => void }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover text-muted-foreground">
        <FolderOpen className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Select a workflow stage</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Choose a stage from the toolbar above or the metric strip to view and manage title records.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => onSelectStage('intake')} className="text-xs">
          Intake Queue
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSelectStage('preparation')} className="text-xs">
          In Preparation
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSelectStage('all')} className="text-xs">
          View All Titles <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function TitleRecordsContent() {
  const {
    counts,
    filteredTitles,
    filteredAwaiting,
    search,
    setSearch,
    tab,
    setTab,
    activeDialog,
    openDialog,
  } = useLandTitles();

  const { rendered: renderedDialog, isOpen: isDialogOpen } = useDialogPresence(activeDialog);

  const cardItems = useMemo(() => {
    const items: TitleDialogItem[] = [];
    for (const a of filteredAwaiting) {
      items.push({ type: 'awaiting', data: a });
    }
    for (const t of filteredTitles) {
      items.push({ type: 'title', data: t });
    }
    return items;
  }, [filteredAwaiting, filteredTitles]);

  const isSearching = search.trim() !== '';
  const isUnselected = tab === 'unselected';

  return (
    <div className="space-y-6">
      <div>
        <TitleStatsStrip counts={counts} activeTab={tab} onSelectTab={setTab} />
      </div>

      <Card variant="section">
        <CardStickyHeader>
          <FilterToolbar
            className="pt-5 sm:pt-6"
            tabs={{
              value: isUnselected ? '' : tab,
              onChange: (val) => setTab(val as LegalTab),
              ariaLabel: 'Filter by stage',
              items: [
                { value: 'intake', label: 'Intake Queue', count: counts.intake },
                { value: 'preparation', label: 'Preparation', count: counts.preparation },
                { value: 'review', label: 'Review & Signing', count: counts.review },
                { value: 'clearance', label: 'Clearance', count: counts.clearance },
                { value: 'ready', label: 'Ready for Claim', count: counts.ready },
                { value: 'released', label: 'Released', count: counts.released },
                { value: 'all', label: 'All Titles', count: counts.all },
              ],
            }}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search client, location, block & lot, or TCT…',
              ariaLabel: 'Search legal title records',
            }}
          />
        </CardStickyHeader>

        <div className="p-4 sm:p-6 min-h-[400px]">
          {isUnselected && !isSearching ? (
            <InitialStagePrompt onSelectStage={setTab} />
          ) : cardItems.length === 0 ? (
            <EmptyState
              isFiltered={isSearching || tab !== 'all'}
              message={
                tab === 'intake'
                  ? 'No accounts currently cleared by Billing awaiting legal processing.'
                  : tab === 'preparation'
                  ? 'No titles currently undergoing document preparation.'
                  : tab === 'review'
                  ? 'No titles currently awaiting supervisor review or executive signature.'
                  : tab === 'clearance'
                  ? 'No titles currently within the 30-day clearance window.'
                  : tab === 'ready'
                  ? 'No titles currently stored in the vault awaiting claim.'
                  : tab === 'released'
                  ? 'No titles have been formally released yet.'
                  : 'No land titles found.'
              }
              onClear={() => {
                setSearch('');
                setTab('all');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cardItems.map((item) => (
                <TitleRecordCard
                  key={
                    item.type === 'awaiting'
                      ? `awaiting-${item.data.account_id}`
                      : `title-${item.data.title_id}`
                  }
                  item={item}
                  onClick={() => openDialog({ type: 'detail', item })}
                />
              ))}
            </div>
          )}
        </div>

        <CardTableFooter>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {isUnselected && !isSearching
              ? 'Select a stage above to view records'
              : isSearching
              ? `Showing ${cardItems.length} of ${counts.all} records`
              : `${cardItems.length} records`}
          </p>
        </CardTableFooter>
      </Card>

      {renderedDialog?.type === 'detail' && (
        <TitleDialog
          open={isDialogOpen}
          dialogItem={renderedDialog.item}
        />
      )}
    </div>
  );
}

export function TitleRecordsSection({
  initialTitles,
  initialAwaiting,
}: {
  initialTitles: LandTitle[];
  initialAwaiting: AccountAwaitingTitle[];
}) {
  return (
    <LandTitlesProvider initialTitles={initialTitles} initialAwaiting={initialAwaiting}>
      <TitleRecordsContent />
    </LandTitlesProvider>
  );
}
