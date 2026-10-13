'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function WorkflowSteps<T extends string>({ items, value, onChange, ariaLabel, fallbackLabel = 'Choose a stage' }: {
  items: readonly { value: T; label: string; description: string; count?: number }[];
  value: string;
  onChange: (value: T) => void;
  ariaLabel: string;
  fallbackLabel?: string;
}) {
  const selectedIndex = items.findIndex(item => item.value === value);
  const selected = items[selectedIndex];
  return <nav aria-label={ariaLabel}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" className="w-full justify-between gap-3 sm:w-auto" aria-label={ariaLabel}>
          <span className="flex min-w-0 items-center gap-2">
            {selected && <span className="text-xs tabular-nums text-muted-foreground">{String(selectedIndex + 1).padStart(2, '0')}</span>}
            <span className="truncate">{selected?.label ?? fallbackLabel}</span>
            {selected?.count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{selected.count}</span>}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        {items.map((item, index) => <DropdownMenuItem key={item.value} onSelect={() => onChange(item.value)} className="gap-2 py-2.5">
          <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
          <span className="flex-1">{item.label}</span>
          {item.count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>}
          {value === item.value && <Check className="h-3.5 w-3.5 shrink-0" />}
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  </nav>;
}
