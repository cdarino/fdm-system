'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  FilterOption,
  FilterToolbarFilterItem,
  FilterToolbarSearchConfig,
  FilterToolbarSortConfig,
  FilterToolbarTabsConfig,
} from '@/components/ui/filter-toolbar';

export type SortOrder = 'asc' | 'desc';

export interface SortOptionConfig<T> {
  label: string;
  compare: (a: T, b: T) => number;
  defaultOrder?: SortOrder;
}

export interface SortOptionItem<TSortKey extends string = string> {
  value: TSortKey;
  label: string;
}

export interface FilterTabUiItem<V extends string = string> {
  value: V;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface FilterTabsUiConfig<V extends string = string> {
  variant: 'tabs';
  ariaLabel?: string;
  sectionLabel?: string;
  items: readonly FilterTabUiItem<V>[];
  showCounts?: boolean;
}

export interface FilterSingleSelectUiConfig {
  variant: 'single-select';
  id?: string;
  label: string;
  allLabel?: string;
  options: FilterOption[];
  icon?: ReactNode;
  hidden?: boolean;
}

export interface FilterMultiSelectUiConfig {
  variant: 'multi-select';
  id?: string;
  label: string;
  allLabel?: string;
  options: FilterOption[];
  icon?: ReactNode;
  hidden?: boolean;
}

export interface FilterSearchableUiConfig {
  variant: 'searchable';
  id?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allLabel?: string;
  options: FilterOption[];
  className?: string;
  hidden?: boolean;
}

export interface FilterToggleUiConfig<T> {
  variant: 'toggle';
  id?: string;
  label: string;
  /** Optional shorter label used in compact/stacked toolbars (e.g. map sidebar) */
  compactLabel?: string;
  icon?: ReactNode;
  /** Optional static count or predicate evaluated against items matching other active filters */
  count?: number;
  countPredicate?: (item: T) => boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export type FilterUiConfig<T, V> =
  | FilterTabsUiConfig<Extract<V, string>>
  | FilterSingleSelectUiConfig
  | FilterMultiSelectUiConfig
  | FilterSearchableUiConfig
  | FilterToggleUiConfig<T>;

export interface FilterDefinition<T, V> {
  defaultValue: V;
  predicate: (item: T, value: V) => boolean;
  /** Optional URL query parameter name to persist this filter via history.replaceState */
  urlParam?: string;
  /** Optional parser when hydrating the initial value from URL query params */
  parseUrlParam?: (raw: string) => V | undefined;
  /** Optional serializer when writing the value to URL query params */
  serializeUrlParam?: (value: V) => string;
  /** Optional callback triggered whenever this filter value is updated or cleared */
  onChange?: (value: V) => void;
  /** Optional UI descriptor so `<FilterToolbar controller={controller} />` can render this filter automatically */
  ui?: FilterUiConfig<T, V>;
}

export type FilterDefinitionsMap<T, TFilters extends Record<string, unknown>> = {
  [K in keyof TFilters]: FilterDefinition<T, TFilters[K]>;
};

export interface ListControllerSearchOption<T> {
  fields: (item: T) => (string | number | null | undefined)[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export interface ListControllerSortConfig<T, TSortKey extends string> {
  options: Record<TSortKey, SortOptionConfig<T>>;
  defaultKey: TSortKey;
  defaultOrder?: SortOrder;
  /** Optional URL query parameter names for sort key and direction (defaults to 'sort' and 'order' when syncUrl is enabled) */
  urlParamKey?: string;
  urlParamOrder?: string;
}

export interface ListControllerTruncationConfig {
  mode?: 'paged' | 'cap';
  /** Number of items per page in 'paged' mode (default: 20) */
  pageSize?: number;
  /** Number of items revealed per step in 'cap' mode (default: 20) */
  stepSize?: number;
  /** Initial cap in 'cap' mode (defaults to stepSize) */
  initialCap?: number;
  /** Optional URL query parameter name for page in 'paged' mode (default: 'page') */
  pageUrlParam?: string;
}

export interface UseListControllerOptions<
  T,
  TFilters extends Record<string, unknown>,
  TSortKey extends string,
> {
  items: T[];
  /** Search configuration (or use `searchFields` shorthand) */
  search?: ListControllerSearchOption<T>;
  /** Shorthand for `search.fields` */
  searchFields?: (item: T) => (string | number | null | undefined)[];
  filters: FilterDefinitionsMap<T, TFilters>;
  sort: ListControllerSortConfig<T, TSortKey>;
  truncation?: ListControllerTruncationConfig;
  /** Optional predicate for computing `totalPoolCount` (the denominator in footers/headers; defaults to all items) */
  poolPredicate?: (item: T, filters: TFilters) => boolean;
  /** Sync filters, sort, and page to URL query parameters (default: true) */
  syncUrl?: boolean;
}

export interface ListControllerValue<
  T,
  TFilters extends Record<string, unknown>,
  TSortKey extends string = string,
> {
  /** All items after applying active filters, search, and sort (before truncation) */
  matchedItems: T[];
  /** Items after applying page slicing or cap truncation */
  truncatedItems: T[];
  /** Total pool count (denominator for footers and headers) */
  totalPoolCount: number;
  /** Raw search string */
  search: string;
  setSearch: (query: string) => void;
  /** Current values of all named filters */
  filters: TFilters;
  /** Map indicating whether each named filter differs from its defaultValue */
  enabledFilters: Record<keyof TFilters, boolean>;
  /** Count of currently enabled non-default filters */
  enabledFilterCount: number;
  /** Set a specific filter's value */
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  /** Toggle a filter between its defaultValue and a target value (or boolean negation) */
  toggleFilter: <K extends keyof TFilters>(key: K, activeValue?: TFilters[K]) => void;
  /** Reset a single filter back to its defaultValue */
  clearFilter: <K extends keyof TFilters>(key: K) => void;
  /** Compute contextual counts for a filter's candidate values (respecting search and all other active filters) */
  getCounts: <K extends keyof TFilters, V extends TFilters[K] & string>(
    key: K,
    candidates: readonly V[]
  ) => Record<V, number>;
  /** True when search is non-empty or at least one filter is enabled */
  isFiltered: boolean;
  /** Reset search, all filters, and truncation to their defaults */
  clearAll: () => void;
  /** Active sort key */
  sortKey: TSortKey;
  /** Active sort direction */
  sortOrder: SortOrder;
  /** Update sort key (and optionally sort direction) */
  setSort: (key: TSortKey, order?: SortOrder) => void;
  /** Flip sort direction between 'asc' and 'desc' */
  toggleSortOrder: () => void;
  /** List of available sort options for toolbar rendering */
  sortOptions: SortOptionItem<TSortKey>[];
  /** Paged truncation state and controls */
  page: number;
  currentPage: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  /** Cap truncation state and controls */
  cap: number;
  stepSize: number;
  hasMore: boolean;
  remainingCount: number;
  showMore: () => void;
  resetTruncation: () => void;
  /** Ready-to-render toolbar bindings consumed by `<FilterToolbar controller={controller} />` */
  tabsConfig?: FilterToolbarTabsConfig<string>;
  searchConfig: FilterToolbarSearchConfig;
  filterControls: FilterToolbarFilterItem[];
  sortConfig: FilterToolbarSortConfig<TSortKey>;
}

function updateUrlSearchParams(mutator: (params: URLSearchParams) => void) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const before = url.searchParams.toString();
  mutator(url.searchParams);
  const after = url.searchParams.toString();
  if (before !== after) {
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export function matchesSearchFields<T>(
  item: T,
  words: string[],
  searchFields: (item: T) => (string | number | null | undefined)[]
): boolean {
  if (words.length === 0) return true;
  const normalizedFields = searchFields(item)
    .filter((f): f is string | number => f !== null && f !== undefined && f !== '')
    .map((f) => String(f).toLowerCase());

  return words.every((word) => normalizedFields.some((field) => field.includes(word)));
}

/**
 * Generic filter-sort-search-truncate controller for dashboard list, table, and map views.
 * Pass the returned `controller` object directly to `<FilterToolbar controller={controller} />`,
 * `<ListPaginationFooter controller={controller} />`, or `<ListShowMoreButton controller={controller} />`.
 */
export function useListController<
  T,
  TFilters extends Record<string, unknown>,
  TSortKey extends string,
>({
  items,
  search: searchOption,
  searchFields: searchFieldsProp,
  filters: filterDefs,
  sort: sortOptionConfig,
  truncation,
  poolPredicate,
  syncUrl = true,
}: UseListControllerOptions<T, TFilters, TSortKey>): ListControllerValue<T, TFilters, TSortKey> {
  const searchParams = useSearchParams();

  const resolvedSearchFields = searchOption?.fields ?? searchFieldsProp ?? (() => []);

  const filterDefsRef = useRef(filterDefs);
  filterDefsRef.current = filterDefs;
  const searchFieldsRef = useRef(resolvedSearchFields);
  searchFieldsRef.current = resolvedSearchFields;
  const sortConfigRef = useRef(sortOptionConfig);
  sortConfigRef.current = sortOptionConfig;
  const poolPredicateRef = useRef(poolPredicate);
  poolPredicateRef.current = poolPredicate;

  const defaultPageSize = truncation?.pageSize ?? 20;
  const stepSize = truncation?.stepSize ?? 20;
  const initialCap = truncation?.initialCap ?? stepSize;
  const pageUrlParam = truncation?.pageUrlParam ?? 'page';
  const sortKeyUrlParam = sortOptionConfig.urlParamKey ?? 'sort';
  const sortOrderUrlParam = sortOptionConfig.urlParamOrder ?? 'order';
  const defaultSortOrder: SortOrder =
    sortOptionConfig.defaultOrder ??
    sortOptionConfig.options[sortOptionConfig.defaultKey]?.defaultOrder ??
    'asc';

  // Hydrate initial filter values from URL searchParams when configured
  const [filters, setFiltersState] = useState<TFilters>(() => {
    const initial = {} as TFilters;
    const keys = Object.keys(filterDefs) as (keyof TFilters)[];
    for (const key of keys) {
      const def = filterDefs[key];
      let resolved = def.defaultValue;
      if (syncUrl && def.urlParam) {
        const raw = searchParams.get(def.urlParam);
        if (raw !== null) {
          if (def.parseUrlParam) {
            const parsed = def.parseUrlParam(raw);
            if (parsed !== undefined) resolved = parsed;
          } else if (typeof def.defaultValue === 'boolean') {
            resolved = (raw === 'true' || raw === '1') as unknown as TFilters[typeof key];
          } else {
            resolved = raw as unknown as TFilters[typeof key];
          }
        }
      }
      initial[key] = resolved;
    }
    return initial;
  });

  // Keep URL-backed filters in sync if searchParams change externally (e.g. navigation)
  useEffect(() => {
    if (!syncUrl) return;
    const defs = filterDefsRef.current;
    const keys = Object.keys(defs) as (keyof TFilters)[];
    setFiltersState((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        const def = defs[key];
        if (!def.urlParam) continue;
        const raw = searchParams.get(def.urlParam);
        let resolved = def.defaultValue;
        if (raw !== null) {
          if (def.parseUrlParam) {
            const parsed = def.parseUrlParam(raw);
            if (parsed !== undefined) resolved = parsed;
          } else if (typeof def.defaultValue === 'boolean') {
            resolved = (raw === 'true' || raw === '1') as unknown as TFilters[typeof key];
          } else {
            resolved = raw as unknown as TFilters[typeof key];
          }
        }
        if (next[key] !== resolved) {
          next[key] = resolved;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [searchParams, syncUrl]);

  const [search, setSearch] = useState('');

  // Hydrate initial sort from URL searchParams
  const [sortKey, setSortKeyState] = useState<TSortKey>(() => {
    if (syncUrl) {
      const rawSort = searchParams.get(sortKeyUrlParam) as TSortKey | null;
      if (rawSort && rawSort in sortOptionConfig.options) {
        return rawSort;
      }
    }
    return sortOptionConfig.defaultKey;
  });

  const [sortOrder, setSortOrderState] = useState<SortOrder>(() => {
    if (syncUrl) {
      const rawOrder = searchParams.get(sortOrderUrlParam);
      if (rawOrder === 'asc' || rawOrder === 'desc') {
        return rawOrder;
      }
    }
    return defaultSortOrder;
  });

  // Hydrate initial page from URL searchParams
  const [page, setPageState] = useState<number>(() => {
    if (syncUrl && (truncation?.mode ?? 'paged') === 'paged') {
      const rawPage = searchParams.get(pageUrlParam);
      if (rawPage) {
        const parsed = parseInt(rawPage, 10);
        if (!Number.isNaN(parsed) && parsed > 1) return parsed;
      }
    }
    return 1;
  });

  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [cap, setCap] = useState<number>(initialCap);

  const syncFilterToUrl = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      if (!syncUrl) return;
      const def = filterDefsRef.current[key];
      if (!def?.urlParam) return;
      const paramName = def.urlParam;
      updateUrlSearchParams((params) => {
        if (value === def.defaultValue) {
          params.delete(paramName);
        } else {
          const serialized = def.serializeUrlParam
            ? def.serializeUrlParam(value)
            : String(value);
          params.set(paramName, serialized);
        }
      });
    },
    [syncUrl]
  );

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      setFiltersState((prev) => {
        if (prev[key] === value) return prev;
        return { ...prev, [key]: value };
      });
      syncFilterToUrl(key, value);
      filterDefsRef.current[key]?.onChange?.(value);
    },
    [syncFilterToUrl]
  );

  const toggleFilter = useCallback(
    <K extends keyof TFilters>(key: K, activeValue?: TFilters[K]) => {
      const def = filterDefsRef.current[key];
      setFiltersState((prev) => {
        const current = prev[key];
        let nextVal: TFilters[K];
        if (activeValue !== undefined) {
          nextVal = current === activeValue ? def.defaultValue : activeValue;
        } else if (typeof current === 'boolean') {
          nextVal = (!current) as unknown as TFilters[K];
        } else {
          nextVal = def.defaultValue;
        }
        syncFilterToUrl(key, nextVal);
        def?.onChange?.(nextVal);
        return { ...prev, [key]: nextVal };
      });
    },
    [syncFilterToUrl]
  );

  const clearFilter = useCallback(
    <K extends keyof TFilters>(key: K) => {
      const def = filterDefsRef.current[key];
      setFilter(key, def.defaultValue);
    },
    [setFilter]
  );

  const setSort = useCallback(
    (nextKey: TSortKey, nextOrder?: SortOrder) => {
      const cfg = sortConfigRef.current;
      const resolvedOrder =
        nextOrder ??
        cfg.options[nextKey]?.defaultOrder ??
        sortOrder;
      setSortKeyState(nextKey);
      setSortOrderState(resolvedOrder);

      if (syncUrl) {
        const defKey = cfg.defaultKey;
        const defOrder =
          cfg.defaultOrder ?? cfg.options[defKey]?.defaultOrder ?? 'asc';
        updateUrlSearchParams((params) => {
          if (nextKey === defKey && resolvedOrder === defOrder) {
            params.delete(sortKeyUrlParam);
            params.delete(sortOrderUrlParam);
          } else {
            params.set(sortKeyUrlParam, nextKey);
            params.set(sortOrderUrlParam, resolvedOrder);
          }
        });
      }
    },
    [sortOrder, syncUrl, sortKeyUrlParam, sortOrderUrlParam]
  );

  const toggleSortOrder = useCallback(() => {
    const nextOrder: SortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSort(sortKey, nextOrder);
  }, [sortKey, sortOrder, setSort]);

  const setPage = useCallback((newPageOrFn: number | ((prev: number) => number)) => {
    setPageState((prev) => {
      const next = typeof newPageOrFn === 'function' ? newPageOrFn(prev) : newPageOrFn;
      return Math.max(1, next);
    });
  }, []);

  // Sync page state to URL in paged mode
  useEffect(() => {
    if (!syncUrl || (truncation?.mode ?? 'paged') !== 'paged') return;
    updateUrlSearchParams((params) => {
      if (page <= 1) {
        params.delete(pageUrlParam);
      } else {
        params.set(pageUrlParam, String(page));
      }
    });
  }, [page, syncUrl, truncation?.mode, pageUrlParam]);

  // Compute enabled filters and isFiltered
  const { enabledFilters, enabledFilterCount } = useMemo(() => {
    const defs = filterDefsRef.current;
    const keys = Object.keys(defs) as (keyof TFilters)[];
    const enabled = {} as Record<keyof TFilters, boolean>;
    let count = 0;
    for (const key of keys) {
      const isEnabled = filters[key] !== defs[key].defaultValue;
      enabled[key] = isEnabled;
      if (isEnabled) count++;
    }
    return { enabledFilters: enabled, enabledFilterCount: count };
  }, [filters]);

  const isFiltered = search.trim() !== '' || enabledFilterCount > 0;

  const searchWords = useMemo(
    () => search.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [search]
  );

  // Contextual facet counts: applies search + all other filters, then evaluates each candidate value
  const getCounts = useCallback(
    <K extends keyof TFilters, V extends TFilters[K] & string>(
      targetKey: K,
      candidates: readonly V[]
    ): Record<V, number> => {
      const defs = filterDefsRef.current;
      const otherKeys = (Object.keys(defs) as (keyof TFilters)[]).filter(
        (k) => k !== targetKey
      );

      const scopedItems = items.filter((item) => {
        if (!matchesSearchFields(item, searchWords, searchFieldsRef.current)) {
          return false;
        }
        for (const otherKey of otherKeys) {
          if (!defs[otherKey].predicate(item, filters[otherKey])) {
            return false;
          }
        }
        return true;
      });

      const targetDef = defs[targetKey];
      const result = {} as Record<V, number>;
      for (const candidate of candidates) {
        result[candidate] = scopedItems.filter((item) =>
          targetDef.predicate(item, candidate)
        ).length;
      }
      return result;
    },
    [items, searchWords, filters]
  );

  // Full filter + search + sort pipeline
  const matchedItems = useMemo(() => {
    const defs = filterDefsRef.current;
    const keys = Object.keys(defs) as (keyof TFilters)[];

    const filtered = items.filter((item) => {
      for (const key of keys) {
        if (!defs[key].predicate(item, filters[key])) {
          return false;
        }
      }
      return matchesSearchFields(item, searchWords, searchFieldsRef.current);
    });

    const sortOption =
      sortConfigRef.current.options[sortKey] ??
      sortConfigRef.current.options[sortConfigRef.current.defaultKey];

    if (!sortOption) return filtered;

    const multiplier = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => sortOption.compare(a, b) * multiplier);
  }, [items, filters, searchWords, sortKey, sortOrder]);

  const totalPoolCount = useMemo(() => {
    const pred = poolPredicateRef.current;
    if (!pred) return items.length;
    return items.filter((item) => pred(item, filters)).length;
  }, [items, filters]);

  // Reset truncation when search, filters, or sort change (after initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setPageState(1);
    setCap(initialCap);
  }, [search, filters, sortKey, sortOrder, initialCap]);

  const totalPages = Math.max(1, Math.ceil(matchedItems.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const truncatedItems = useMemo(() => {
    const mode = truncation?.mode ?? 'paged';
    if (mode === 'cap') {
      return matchedItems.slice(0, cap);
    }
    const from = (currentPage - 1) * pageSize;
    return matchedItems.slice(from, from + pageSize);
  }, [matchedItems, truncation?.mode, cap, currentPage, pageSize]);

  const hasMore = cap < matchedItems.length;
  const remainingCount = Math.max(0, matchedItems.length - truncatedItems.length);

  const showMore = useCallback(() => {
    setCap((prev) => prev + stepSize);
  }, [stepSize]);

  const resetTruncation = useCallback(() => {
    setPageState(1);
    setCap(initialCap);
  }, [initialCap]);

  const clearAll = useCallback(() => {
    const defs = filterDefsRef.current;
    const keys = Object.keys(defs) as (keyof TFilters)[];
    const defaults = {} as TFilters;
    for (const key of keys) {
      defaults[key] = defs[key].defaultValue;
      if (filters[key] !== defs[key].defaultValue) {
        defs[key].onChange?.(defs[key].defaultValue);
      }
    }
    setFiltersState(defaults);
    setSearch('');
    setPageState(1);
    setCap(initialCap);

    if (syncUrl) {
      updateUrlSearchParams((params) => {
        for (const key of keys) {
          const param = defs[key].urlParam;
          if (param) params.delete(param);
        }
        params.delete(pageUrlParam);
      });
    }
  }, [filters, initialCap, syncUrl, pageUrlParam]);

  const sortOptions = useMemo<SortOptionItem<TSortKey>[]>(() => {
    const opts = sortOptionConfig.options;
    return (Object.keys(opts) as TSortKey[]).map((key) => ({
      value: key,
      label: opts[key].label,
    }));
  }, [sortOptionConfig.options]);

  // Build ready-to-render FilterToolbar bindings from filter UI metadata
  const { tabsConfig, filterControls } = useMemo(() => {
    let resolvedTabs: FilterToolbarTabsConfig<string> | undefined;
    const controls: FilterToolbarFilterItem[] = [];
    const keys = Object.keys(filterDefs) as (keyof TFilters)[];

    for (const key of keys) {
      const def = filterDefs[key];
      const ui = def.ui;
      if (!ui) continue;

      if (ui.variant === 'tabs') {
        const shouldCount = ui.showCounts !== false;
        const candidates = ui.items.map((item) => item.value);
        const counts = shouldCount
          ? getCounts(key, candidates as readonly (TFilters[typeof key] & string)[])
          : undefined;

        resolvedTabs = {
          value: String(filters[key]),
          onChange: (val: string) => setFilter(key, val as TFilters[typeof key]),
          ariaLabel: ui.ariaLabel,
          sectionLabel: ui.sectionLabel,
          items: ui.items.map((item) => ({
            value: item.value,
            label: item.label,
            icon: item.icon,
            disabled: item.disabled,
            count: counts ? counts[item.value as keyof typeof counts] : undefined,
          })),
        };
        continue;
      }

      if (ui.hidden) continue;
      const controlId = ui.id ?? String(key);

      if (ui.variant === 'single-select') {
        controls.push({
          type: 'single-select',
          id: controlId,
          label: ui.label,
          allLabel: ui.allLabel,
          icon: ui.icon,
          options: ui.options,
          value: (filters[key] as string | null) ?? null,
          onChange: (val) => setFilter(key, val as TFilters[typeof key]),
        });
      } else if (ui.variant === 'multi-select') {
        controls.push({
          type: 'multi-select',
          id: controlId,
          label: ui.label,
          allLabel: ui.allLabel,
          icon: ui.icon,
          options: ui.options,
          values: (filters[key] as string[]) ?? [],
          onChange: (vals) => setFilter(key, vals as TFilters[typeof key]),
        });
      } else if (ui.variant === 'searchable') {
        controls.push({
          type: 'searchable',
          id: controlId,
          placeholder: ui.placeholder,
          searchPlaceholder: ui.searchPlaceholder,
          emptyMessage: ui.emptyMessage,
          allLabel: ui.allLabel,
          options: ui.options,
          className: ui.className,
          value: (filters[key] as string | null) ?? null,
          onChange: (val) => setFilter(key, val as TFilters[typeof key]),
        });
      } else if (ui.variant === 'toggle') {
        let computedCount = ui.count;
        if (computedCount === undefined && ui.countPredicate) {
          const otherKeys = keys.filter((k) => k !== key);
          computedCount = items.filter((item) => {
            for (const otherKey of otherKeys) {
              if (!filterDefs[otherKey].predicate(item, filters[otherKey])) {
                return false;
              }
            }
            return ui.countPredicate!(item);
          }).length;
        }

        controls.push({
          type: 'toggle',
          id: controlId,
          label: ui.label,
          compactLabel: ui.compactLabel,
          checked: Boolean(filters[key]),
          onChange: (checked) => setFilter(key, checked as TFilters[typeof key]),
          count: computedCount,
          icon: ui.icon,
          disabled: ui.disabled,
        });
      }
    }

    return { tabsConfig: resolvedTabs, filterControls: controls };
  }, [filterDefs, filters, getCounts, items, setFilter]);

  const searchConfig = useMemo<FilterToolbarSearchConfig>(
    () => ({
      value: search,
      onChange: setSearch,
      placeholder: searchOption?.placeholder,
      ariaLabel: searchOption?.ariaLabel,
      className: searchOption?.className,
    }),
    [search, searchOption?.placeholder, searchOption?.ariaLabel, searchOption?.className]
  );

  const sortConfig = useMemo<FilterToolbarSortConfig<TSortKey>>(
    () => ({
      value: sortKey,
      order: sortOrder,
      onChange: setSort,
      onToggleOrder: toggleSortOrder,
      options: sortOptions,
    }),
    [sortKey, sortOrder, setSort, toggleSortOrder, sortOptions]
  );

  return {
    matchedItems,
    truncatedItems,
    totalPoolCount,
    search,
    setSearch,
    filters,
    enabledFilters,
    enabledFilterCount,
    setFilter,
    toggleFilter,
    clearFilter,
    getCounts,
    isFiltered,
    clearAll,
    sortKey,
    sortOrder,
    setSort,
    toggleSortOrder,
    sortOptions,
    page,
    currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    cap,
    stepSize,
    hasMore,
    remainingCount,
    showMore,
    resetTruncation,
    tabsConfig,
    searchConfig,
    filterControls,
    sortConfig,
  };
}
