'use client';

import { useMemo, useState } from 'react';
import { FileCheck, Search, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTableFooter, CardStickyHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TitleDialog } from './title-dialog';
import { TitleRecordCard } from './title-record-card';
import { WorkflowSteps } from '@/components/ui/workflow-steps';
import { TITLE_WORKFLOW } from '@/lib/dashboard-workflow';
import {
  LandTitlesProvider,
  useLandTitles,
  lotRefLabel,
  type TitleDialogItem,
} from '@/lib/hooks/use-land-titles';
import { useDialogPresence } from '@/lib/hooks/use-dialog-presence';
import type {
  AccountAwaitingTitle,
  LandTitle,
} from '@/lib/types/title';

function EmptyState({
  isSearching,
  searchQuery,
  title,
  message,
  canViewAll,
  totalCount,
  onClearSearch,
  onViewAll,
}: {
  isSearching: boolean;
  searchQuery?: string;
  title: string;
  message: string;
  canViewAll?: boolean;
  totalCount?: number;
  onClearSearch: () => void;
  onViewAll: () => void;
}) {
  if (isSearching) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
          <SearchX className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">
            No matching records
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {searchQuery
              ? `No records match "${searchQuery}". Try a different keyword or check spelling.`
              : 'Try a different search term.'}
          </p>
        </div>
        <Button variant="quiet" onClick={onClearSearch} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
        <FileCheck className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          {title}
        </p>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>
      </div>
      {canViewAll && (
        <Button variant="quiet" onClick={onViewAll} className="gap-1.5 text-xs">
          View all records{typeof totalCount === 'number' && totalCount > 0 ? ` (${totalCount})` : ''}
        </Button>
      )}
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
  const [isSuggestionListOpen, setIsSuggestionListOpen] = useState(false);

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
  const suggestions = useMemo(() => {
    if (!isSearching) return [];
    const query = search.trim().toLocaleLowerCase();
    const seen = new Set<string>();
    return cardItems.flatMap((item) => {
      const clientName = item.type === 'title'
        ? item.data.client?.full_name
        : item.data.client?.full_name;
      const property = item.type === 'title' ? item.data.property : item.data.property;
      if (!clientName) return [];

      const lot = lotRefLabel(property);
      const titleNumber = property?.title_number?.trim();
      const searchText = [clientName, lot, property?.location ?? '', titleNumber ?? '']
        .join(' ')
        .toLocaleLowerCase();
      const key = `${clientName}:${lot}`;
      if (!searchText.includes(query) || seen.has(key)) return [];
      seen.add(key);

      return [{
        key,
        clientName,
        detail: [lot, property?.location, titleNumber ? `TCT ${titleNumber}` : null]
          .filter(Boolean)
          .join(' · '),
      }];
    }).slice(0, 6);
  }, [cardItems, isSearching, search]);
  const stages = TITLE_WORKFLOW.map(stage => ({ ...stage, count: counts[stage.value] }));
  const currentStage = TITLE_WORKFLOW.find(stage => stage.value === tab);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workflow Stage
          </span>
          <WorkflowSteps
            items={stages}
            value={tab}
            onChange={setTab}
            ariaLabel="Title release workflow"
            fallbackLabel="All stages"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {tab === 'all'
            ? `All records (${counts.all} total across 7 stages)`
            : `Step ${stages.findIndex((s) => s.value === tab) + 1} of ${stages.length}`}
        </span>
      </Card>

      <Card variant="section">
        <CardStickyHeader>
          <div className="px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
                  {currentStage?.label ?? 'All title records'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {currentStage?.description ?? 'Search and review records across the release workflow.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="quiet" size="sm" onClick={() => setTab(tab === 'all' ? 'intake' : 'all')}>
                  {tab === 'all' ? 'Start at billing clearance' : 'All records'}
                </Button>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onFocus={() => setIsSuggestionListOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setIsSuggestionListOpen(false);
                    }}
                    placeholder="Search title records"
                    aria-label="Search legal title records"
                    aria-expanded={isSuggestionListOpen && suggestions.length > 0}
                    aria-controls="title-search-suggestions"
                    className="h-9 pl-9 pr-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setIsSuggestionListOpen(false);
                      }}
                      aria-label="Clear title search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isSuggestionListOpen && suggestions.length > 0 && (
                    <ul
                      id="title-search-suggestions"
                      role="listbox"
                      aria-label="Matching title records"
                      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                    >
                      {suggestions.map((suggestion) => (
                        <li key={suggestion.key} role="option" aria-selected="false">
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSearch(suggestion.clientName);
                              setIsSuggestionListOpen(false);
                            }}
                            className="w-full rounded-sm px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                          >
                            <span className="block truncate text-sm font-medium">{suggestion.clientName}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{suggestion.detail}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardStickyHeader>

        <div className="p-4 sm:p-6 min-h-[400px]">
          {cardItems.length === 0 ? (
            <EmptyState
              isSearching={isSearching}
              searchQuery={search}
              title={
                tab === 'intake'
                  ? 'No accounts awaiting legal intake'
                  : tab === 'all'
                  ? 'No title records found'
                  : `No records in ${currentStage?.label ?? 'this stage'}`
              }
              message={
                tab === 'intake'
                  ? 'No accounts currently cleared by Billing awaiting legal processing.'
                  : tab === 'preparation'
                  ? 'No titles currently undergoing document preparation.'
                  : tab === 'review'
                  ? 'No titles currently awaiting Legal Head verification.'
                  : tab === 'signature'
                  ? 'No titles currently awaiting Management signature.'
                  : tab === 'clearance'
                  ? 'No titles currently within the 30-day clearance window.'
                  : tab === 'ready'
                  ? 'No titles currently stored in the vault awaiting claim.'
                  : tab === 'released'
                  ? 'No titles have been formally released yet.'
                  : 'No land titles found.'
              }
              canViewAll={tab !== 'all' && counts.all > 0}
              totalCount={counts.all}
              onClearSearch={() => setSearch('')}
              onViewAll={() => {
                setSearch('');
                setTab('all');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            {isSearching
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
