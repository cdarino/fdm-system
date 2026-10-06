'use client';

import type { ReactNode } from 'react';
import { Check, ListFilter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardToolbar } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

export interface FilterToolbarCustomFilter {
  type: 'custom';
  id: string;
  render: ReactNode;
}

export type FilterToolbarFilterItem =
  | FilterToolbarSingleSelectFilter
  | FilterToolbarMultiSelectFilter
  | FilterToolbarSearchableFilter
  | FilterToolbarCustomFilter;

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

export interface FilterToolbarProps<
  T extends string = string,
  V extends string = string,
> {
  variant?: 'default' | 'stacked';
  tabs?: FilterToolbarTabsConfig<T>;
  search?: FilterToolbarSearchConfig;
  filters?: FilterToolbarFilterItem[];
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
        className={cn(size === 'sm' ? 'h-8 text-xs' : 'w-full sm:w-44', filter.className)}
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
            className="gap-2"
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
          className="gap-2"
        >
          {filter.icon ?? <ListFilter className="h-4 w-4 text-muted-foreground" />}
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
>({
  variant = 'default',
  tabs,
  search,
  filters,
  viewMode,
  actions,
  isFiltered = false,
  onClear,
  clearLabel,
  className,
}: FilterToolbarProps<T, V>) {
  if (variant === 'stacked') {
    const hasSecondRow = Boolean(
      search || (filters && filters.length > 0) || viewMode || actions
    );

    return (
      <div className={className}>
        {tabs && (
          <div className="border-b border-border px-4 py-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tabs.sectionLabel ?? 'Status'}
              </span>
              {isFiltered && onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs text-primary transition-colors hover:underline"
                >
                  {clearLabel ?? 'Reset filters'}
                </button>
              )}
            </div>
            <FilterToolbarTabs {...tabs} size="sm" />
          </div>
        )}

        {hasSecondRow && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            {search && <FilterToolbarSearch {...search} size="sm" />}
            {filters?.map((filter) => (
              <FilterToolbarFilterControl key={filter.id} filter={filter} size="sm" />
            ))}
            {!tabs && isFiltered && onClear && (
              <button
                type="button"
                onClick={onClear}
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
      {tabs && <FilterToolbarTabs {...tabs} />}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {search && <FilterToolbarSearch {...search} />}
        {filters?.map((filter) => (
          <FilterToolbarFilterControl key={filter.id} filter={filter} />
        ))}
        {isFiltered && onClear && (
          <Button
            variant="ghost"
            onClick={onClear}
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
