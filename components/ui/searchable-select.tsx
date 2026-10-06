'use client';

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
}

export interface SearchableSelectProps {
  id?: string;
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching options found.',
  disabled = false,
  className,
  contentClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const listboxId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;

    return options.filter((opt) => {
      const haystacks = [opt.label, opt.description ?? '', ...(opt.keywords ?? [])];
      return haystacks.some((text) => text.toLowerCase().includes(query));
    });
  }, [options, search]);

  React.useEffect(() => {
    if (open) {
      setSearch('');
      const currentIdx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    }
  }, [open, options, value]);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  function handleSelect(option: SearchableSelectOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (filteredOptions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredOptions[highlightedIndex];
      if (target && !target.disabled) {
        handleSelect(target);
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          disabled={disabled}
          className={cn(
            'flex h-9 min-w-0 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span
            className={cn(
              'min-w-0 truncate text-left',
              !selectedOption && 'text-muted-foreground'
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          'w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0 overflow-hidden',
          contentClassName
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="relative border-b border-border p-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-8 border-0 bg-transparent pl-7 pr-7 text-xs shadow-none focus-visible:ring-0"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          onWheel={(e) => e.stopPropagation()}
          className="max-h-60 overflow-y-auto p-1"
        >
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = opt.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'relative flex w-full min-w-0 cursor-pointer select-none items-center justify-between gap-2 rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none transition-colors disabled:pointer-events-none disabled:opacity-50',
                    isHighlighted
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{opt.label}</p>
                    {opt.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {opt.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
