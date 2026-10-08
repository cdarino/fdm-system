'use client';

import type { ReactNode } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardTableFooter, CardToolbar } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';

const ALL_SENTINEL = '__all__';

export interface FilterToolbarTabItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface FilterToolbarTabsConfig<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  items: FilterToolbarTabItem<T>[];
  ariaLabel?: string;
  sectionLabel?: string;
}

export interface FilterToolbarSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export interface FilterOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
}

export interface FilterToolbarSingleSelectFilter {
  type?: 'single-select';
  id: string;
  label: string;
  allLabel?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  icon?: ReactNode;
}

export interface FilterToolbarMultiSelectFilter {
  type: 'multi-select';
  id: string;
  label: string;
  allLabel?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: FilterOption[];
  icon?: ReactNode;
}

export interface FilterToolbarSearchableFilter {
  type: 'searchable';
  id: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allLabel?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  className?: string;
}

export interface FilterToolbarToggleFilter {
  type: 'toggle';
  id: string;
  label: string;
  /** Optional shorter label rendered when toolbar size is 'sm' (e.g. stacked sidebar) */
  compactLabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface FilterToolbarCustomFilter {
  type: 'custom';
  id: string;
  render: ReactNode;
}

export type FilterToolbarFilterItem =
  | FilterToolbarSingleSelectFilter
  | FilterToolbarMultiSelectFilter
  | FilterToolbarSearchableFilter
  | FilterToolbarToggleFilter
  | FilterToolbarCustomFilter;

export interface FilterToolbarSortOption<S extends string = string> {
  value: S;
  label: string;
}

export interface FilterToolbarSortConfig<S extends string = string> {
  value: S;
  order: 'asc' | 'desc';
  onChange: (key: S, order?: 'asc' | 'desc') => void;
  onToggleOrder?: () => void;
  options: readonly FilterToolbarSortOption<S>[];
}

export interface FilterToolbarViewModeOption<V extends string = string> {
  value: V;
  label: string;
  icon: ReactNode;
}

export interface FilterToolbarViewModeConfig<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: FilterToolbarViewModeOption<V>[];
}

/**
 * Structural subset of `ListControllerValue` consumed by `<FilterToolbar controller={controller} />`.
 */
export interface FilterToolbarControllerBinding<S extends string = string> {
  tabsConfig?: FilterToolbarTabsConfig<string>;
  searchConfig: FilterToolbarSearchConfig;
  filterControls: FilterToolbarFilterItem[];
  sortConfig: FilterToolbarSortConfig<S>;
  isFiltered: boolean;
  clearAll: () => void;
}

export interface FilterToolbarProps<
  T extends string = string,
  V extends string = string,
  S extends string = string,
> {
  variant?: 'default' | 'stacked';
  /** Pass the `useListController` instance directly to auto-bind tabs, search, filters, sort, and clear */
  controller?: FilterToolbarControllerBinding<S>;
  tabs?: FilterToolbarTabsConfig<T>;
  search?: FilterToolbarSearchConfig;
  filters?: FilterToolbarFilterItem[];
  sort?: FilterToolbarSortConfig<S> | false;
  viewMode?: FilterToolbarViewModeConfig<V>;
  actions?: ReactNode;
  isFiltered?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
}

export function FilterToolbarTabs<T extends string = string>({
  value,
  onChange,
  items,
  ariaLabel = 'Filter by status',
  size = 'default',
  className,
}: FilterToolbarTabsConfig<T> & { size?: 'default' | 'sm'; className?: string }) {
  const isSmall = size === 'sm';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-row-hover p-1',
        !isSmall && 'inline-flex',
        className
      )}
    >
      {items.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            disabled={tab.disabled}
            aria-pressed={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex items-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
              isSmall ? 'gap-1 px-2 py-1 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm',
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'tabular-nums text-muted-foreground',
                  isSmall ? 'text-[10px]' : 'text-xs'
                )}
              >
                {isSmall ? `(${tab.count})` : tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FilterToolbarSearch({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel = 'Search',
  size = 'default',
  className,
}: FilterToolbarSearchConfig & { size?: 'default' | 'sm' }) {
  const isSmall = size === 'sm';

  return (
    <div className={cn('relative min-w-0 flex-1', !isSmall && 'sm:flex-none', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          isSmall ? 'left-2.5 h-3.5 w-3.5' : 'left-3 h-4 w-4'
        )}
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'w-full [&::-webkit-search-cancel-button]:hidden',
          isSmall ? 'h-8 pl-8 pr-8 text-xs' : 'pl-9 pr-8 sm:w-72'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterToolbarFilterControl({
  filter,
  size = 'default',
}: {
  filter: FilterToolbarFilterItem;
  size?: 'default' | 'sm';
}) {
  if (filter.type === 'custom') {
    return <>{filter.render}</>;
  }

  if (filter.type === 'toggle') {
    const isSmall = size === 'sm';
    const displayLabel = isSmall && filter.compactLabel ? filter.compactLabel : filter.label;
    return (
      <button
        type="button"
        disabled={filter.disabled}
        aria-pressed={filter.checked}
        onClick={() => filter.onChange(!filter.checked)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          isSmall ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm',
          filter.checked
            ? 'border-primary bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-primary'
            : 'border-border bg-card text-muted-foreground hover:bg-row-hover hover:text-foreground'
        )}
      >
        {filter.icon && (
          <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{filter.icon}</span>
        )}
        <span>{displayLabel}</span>
        {filter.count !== undefined && (
          <span
            className={cn(
              'tabular-nums',
              isSmall ? 'text-[10px]' : 'text-xs',
              filter.checked ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            ({filter.count})
          </span>
        )}
      </button>
    );
  }

  if (filter.type === 'searchable') {
    const allLabel = filter.allLabel ?? 'All';
    const options = [
      { value: ALL_SENTINEL, label: allLabel },
      ...filter.options,
    ];
    return (
      <SearchableSelect
        options={options}
        value={filter.value ?? ALL_SENTINEL}
        onValueChange={(val) => filter.onChange(val === ALL_SENTINEL ? null : val)}
        placeholder={filter.placeholder ?? allLabel}
        searchPlaceholder={filter.searchPlaceholder}
        emptyMessage={filter.emptyMessage}
        className={cn(
          size === 'sm' ? 'h-8 text-xs' : 'w-full sm:w-44',
          filter.value !== null &&
            'border-primary bg-[color-mix(in_srgb,var(--primary)_8%,white)] text-primary',
          filter.className
        )}
      />
    );
  }

  if (filter.type === 'multi-select') {
    const allLabel = filter.allLabel ?? `All ${filter.label.toLowerCase()}`;
    const selectedCount = filter.values.length;
    const summaryLabel =
      selectedCount === 0
        ? allLabel
        : selectedCount === 1
          ? (filter.options.find((o) => o.value === filter.values[0])?.label ?? allLabel)
          : `${filter.label} (${selectedCount})`;

    function toggleOption(optValue: string) {
      if (filter.type !== 'multi-select') return;
      const next = filter.values.includes(optValue)
        ? filter.values.filter((v) => v !== optValue)
        : [...filter.values, optValue];
      filter.onChange(next);
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="quiet"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn(
              'gap-2',
              selectedCount > 0 &&
                'border-primary bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-primary'
            )}
          >
            {filter.icon ?? <ListFilter className="h-4 w-4 text-muted-foreground" />}
            {summaryLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {filter.label}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              filter.onChange([]);
            }}
            className="justify-between"
          >
            {allLabel}
            {selectedCount === 0 && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          {filter.options.map((opt) => {
            const isSelected = filter.values.includes(opt.value);
            return (
              <DropdownMenuItem
                key={opt.value}
                disabled={opt.disabled}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleOption(opt.value);
                }}
                className="justify-between"
              >
                {opt.label}
                {isSelected && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const allLabel = filter.allLabel ?? `All ${filter.label.toLowerCase()}`;
  const activeOption = filter.options.find((opt) => opt.value === filter.value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="quiet"
          size={size === 'sm' ? 'sm' : 'default'}
          className={cn(
            'gap-2',
            activeOption &&
              'border-primary bg-[color-mix(in_srgb,var(--primary)_10%,white)] text-primary'
          )}
        >
          {filter.icon ?? (
            <ListFilter
              className={cn(
                'h-4 w-4',
                activeOption ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          )}
          {activeOption ? activeOption.label : allLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {filter.label}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            filter.onChange(null);
          }}
          className="justify-between"
        >
          {allLabel}
          {filter.value === null && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        {filter.options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            disabled={opt.disabled}
            onSelect={(e) => {
              e.preventDefault();
              filter.onChange(opt.value);
            }}
            className="justify-between"
          >
            {opt.label}
            {filter.value === opt.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterToolbarSort<S extends string = string>({
  value,
  order,
  onChange,
  onToggleOrder,
  options,
  size = 'default',
  className,
}: FilterToolbarSortConfig<S> & { size?: 'default' | 'sm'; className?: string }) {
  const isSmall = size === 'sm';
  const activeOption = options.find((opt) => opt.value === value) ?? options[0];
  const DirectionIcon = order === 'asc' ? ArrowUpAZ : ArrowDownAZ;

  const handleToggleOrder = () => {
    if (onToggleOrder) {
      onToggleOrder();
    } else {
      onChange(value, order === 'asc' ? 'desc' : 'asc');
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-card shadow-xs',
        className
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Sort by ${activeOption?.label ?? value}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-l-md font-medium text-foreground transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isSmall ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'
            )}
          >
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{activeOption?.label ?? 'Sort'}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sort by
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => {
                  if (isSelected) {
                    handleToggleOrder();
                  } else {
                    onChange(opt.value);
                  }
                }}
                className="justify-between"
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onChange(value, 'asc')}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <ArrowUpAZ className="h-3.5 w-3.5 text-muted-foreground" />
              Ascending
            </span>
            {order === 'asc' && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onChange(value, 'desc')}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <ArrowDownAZ className="h-3.5 w-3.5 text-muted-foreground" />
              Descending
            </span>
            {order === 'desc' && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={handleToggleOrder}
        title={
          order === 'asc'
            ? 'Ascending (click for descending)'
            : 'Descending (click for ascending)'
        }
        aria-label={order === 'asc' ? 'Sort descending' : 'Sort ascending'}
        className={cn(
          'inline-flex items-center justify-center rounded-r-md border-l border-border text-muted-foreground transition-colors hover:bg-row-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isSmall ? 'h-8 w-7' : 'h-9 w-8'
        )}
      >
        <DirectionIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function FilterToolbarViewToggle<V extends string = string>({
  value,
  onChange,
  options,
}: FilterToolbarViewModeConfig<V>) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              isActive
                ? 'bg-row-hover text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={isActive}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

export function FilterToolbar<
  T extends string = string,
  V extends string = string,
  S extends string = string,
>({
  variant = 'default',
  controller,
  tabs: tabsProp,
  search: searchProp,
  filters: filtersProp,
  sort: sortProp,
  viewMode,
  actions,
  isFiltered: isFilteredProp,
  onClear: onClearProp,
  clearLabel,
  className,
}: FilterToolbarProps<T, V, S>) {
  const resolvedTabs = (tabsProp ?? controller?.tabsConfig) as FilterToolbarTabsConfig<T> | undefined;
  const resolvedSearch = searchProp ?? controller?.searchConfig;
  const resolvedFilters = filtersProp ?? controller?.filterControls;
  const resolvedSort = sortProp === false ? undefined : (sortProp ?? controller?.sortConfig);
  const resolvedIsFiltered = isFilteredProp ?? controller?.isFiltered ?? false;
  const resolvedOnClear = onClearProp ?? controller?.clearAll;

  if (variant === 'stacked') {
    const hasSecondRow = Boolean(
      resolvedSearch ||
        (resolvedFilters && resolvedFilters.length > 0) ||
        resolvedSort ||
        viewMode ||
        actions
    );

    return (
      <div className={className}>
        {resolvedTabs && (
          <div className="border-b border-border px-4 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {resolvedTabs.sectionLabel ?? 'Status'}
              </span>
              {resolvedIsFiltered && resolvedOnClear && (
                <button
                  type="button"
                  onClick={resolvedOnClear}
                  className="text-xs text-primary transition-colors hover:underline"
                >
                  {clearLabel ?? 'Reset filters'}
                </button>
              )}
            </div>
            <FilterToolbarTabs {...resolvedTabs} size="sm" />
          </div>
        )}

        {hasSecondRow && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            {resolvedSearch && <FilterToolbarSearch {...resolvedSearch} size="sm" />}
            {resolvedFilters?.map((filter) => (
              <FilterToolbarFilterControl key={filter.id} filter={filter} size="sm" />
            ))}
            {resolvedSort && <FilterToolbarSort {...resolvedSort} size="sm" />}
            {!resolvedTabs && resolvedIsFiltered && resolvedOnClear && (
              <button
                type="button"
                onClick={resolvedOnClear}
                className="text-xs text-primary transition-colors hover:underline"
              >
                {clearLabel ?? 'Reset filters'}
              </button>
            )}
            {viewMode && <FilterToolbarViewToggle {...viewMode} />}
            {actions}
          </div>
        )}
      </div>
    );
  }

  return (
    <CardToolbar className={className}>
      {resolvedTabs && <FilterToolbarTabs {...resolvedTabs} />}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {resolvedSearch && <FilterToolbarSearch {...resolvedSearch} />}
        {resolvedFilters?.map((filter) => (
          <FilterToolbarFilterControl key={filter.id} filter={filter} />
        ))}
        {resolvedSort && <FilterToolbarSort {...resolvedSort} />}
        {resolvedIsFiltered && resolvedOnClear && (
          <Button
            variant="ghost"
            onClick={resolvedOnClear}
            className="gap-1.5 text-muted-foreground hover:bg-row-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            {clearLabel ?? 'Clear'}
          </Button>
        )}
        {viewMode && <FilterToolbarViewToggle {...viewMode} />}
        {actions}
      </div>
    </CardToolbar>
  );
}

/**
 * Structural subset of `ListControllerValue` consumed by `<ListPaginationFooter controller={controller} />`.
 */
export interface ListPaginationControllerBinding<T = unknown> {
  matchedItems: T[];
  totalPoolCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  isFiltered: boolean;
}

export interface ListPaginationFooterProps<T = unknown> {
  controller: ListPaginationControllerBinding<T>;
  isLoading?: boolean;
  singularLabel: string;
  pluralLabel?: string;
  loadingText?: string;
  className?: string;
}

export function ListPaginationFooter<T = unknown>({
  controller,
  isLoading = false,
  singularLabel,
  pluralLabel,
  loadingText,
  className,
}: ListPaginationFooterProps<T>) {
  const {
    matchedItems,
    totalPoolCount,
    currentPage,
    pageSize,
    totalPages,
    setPage,
    isFiltered,
  } = controller;
  const resolvedPlural = pluralLabel ?? `${singularLabel}s`;
  const count = matchedItems.length;
  const rangeStart = count === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, count);

  return (
    <CardTableFooter className={className}>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {isLoading
          ? (loadingText ?? `Loading ${resolvedPlural}…`)
          : isFiltered
            ? `Showing ${rangeStart}–${rangeEnd} of ${count} filtered ${count === 1 ? singularLabel : resolvedPlural} (${totalPoolCount} total)`
            : count <= pageSize
              ? `${totalPoolCount} ${totalPoolCount === 1 ? singularLabel : resolvedPlural}`
              : `Showing ${rangeStart}–${rangeEnd} of ${totalPoolCount} ${resolvedPlural}`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || isLoading}
            aria-label="Previous page"
            className="h-8 gap-1 px-2.5 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="text-xs text-muted-foreground">
            Page <strong className="font-medium text-foreground">{currentPage}</strong> of{' '}
            <strong className="font-medium text-foreground">{totalPages}</strong>
          </span>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || isLoading}
            aria-label="Next page"
            className="h-8 gap-1 px-2.5 text-xs"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </CardTableFooter>
  );
}

/**
 * Structural subset of `ListControllerValue` consumed by `<ListShowMoreButton controller={controller} />`.
 */
export interface ListShowMoreControllerBinding {
  hasMore: boolean;
  stepSize: number;
  remainingCount: number;
  showMore: () => void;
}

export function ListShowMoreButton({
  controller,
  className,
}: {
  controller: ListShowMoreControllerBinding;
  className?: string;
}) {
  if (!controller.hasMore) return null;

  return (
    <div className={cn('border-t border-border p-3 text-center', className)}>
      <Button
        type="button"
        variant="quiet"
        size="sm"
        onClick={controller.showMore}
        className="w-full gap-1.5 text-xs"
      >
        <ChevronDown className="h-3.5 w-3.5" />
        Show {Math.min(controller.stepSize, controller.remainingCount)} more ({controller.remainingCount} remaining)
      </Button>
    </div>
  );
}
