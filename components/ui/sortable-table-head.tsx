import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

interface SortableTableHeadProps extends Omit<ComponentProps<typeof TableHead>, 'onClick'> {
  /** The column's current direction, or null when the table is sorted by something else. */
  direction: 'asc' | 'desc' | null;
  onSort: () => void;
  children: ReactNode;
}

/**
 * A table header whose label is a button that sorts by that column. The arrow
 * shows the current direction, and the faded double chevron marks a column that
 * can be sorted but isn't.
 */
export function SortableTableHead({
  direction,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps) {
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown;

  return (
    <TableHead
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
      className={className}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm',
          direction && 'text-foreground'
        )}
      >
        {children}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !direction && 'opacity-40')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
