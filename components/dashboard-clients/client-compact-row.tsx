'use client';

import {
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { UserRound, MoreHorizontal, Activity, Edit3, Trash2, Check, FileDown } from 'lucide-react';
import { getClientReportData } from '@/lib/actions/reports';
import { generateClientPdfReport } from '@/lib/reports/pdf-client-report';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ClientListItem } from '@/lib/types/client';

export function ClientStatusPill({ status }: { status: string }) {
  const isActive = status.toLowerCase() === 'active';
  const pillClass = isActive
    ? 'bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success'
    : 'bg-muted text-muted-foreground';
  const dotClass = isActive ? 'bg-success' : 'bg-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${pillClass}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
}

export interface ClientCompactRowProps {
  client: ClientListItem;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onOpenDetails?: () => void;
  onOpenEdit?: () => void;
  onOpenDelete?: () => void;
  gutterL?: string;
  gutterR?: string;
}

export function ClientCompactRow({
  client,
  selectable = false,
  selected = false,
  onSelect,
  onOpenDetails,
  onOpenEdit,
  onOpenDelete,
  gutterL = 'pl-4 sm:pl-6',
  gutterR = 'pr-4 sm:pr-6',
}: ClientCompactRowProps) {
  // Selectable row variant for picker dialogs
  if (selectable) {
    return (
      <TableRow
        onClick={onSelect}
        className={cn(
          'group cursor-pointer transition-colors duration-150',
          selected ? 'bg-sidebar-accent hover:bg-sidebar-accent' : 'hover:bg-row-hover'
        )}
      >
        <TableCell className={`w-10 py-2.5 pr-2 ${gutterL}`}>
          <div
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground group-hover:border-foreground'
            )}
          >
            {selected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
          </div>
        </TableCell>

        <TableCell className="py-2.5 pr-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-row-hover ring-1 ring-inset ring-border text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
            </div>
            <p className="truncate text-xs font-medium text-foreground">{client.full_name}</p>
          </div>
        </TableCell>

        <TableCell className="py-2.5 px-3">
          <p className="truncate text-xs text-muted-foreground max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
            {client.address || 'No address recorded'}
          </p>
        </TableCell>

        <TableCell className={`py-2.5 pl-3 text-right ${gutterR}`}>
          <ClientStatusPill status={client.status} />
        </TableCell>
      </TableRow>
    );
  }

  // Directory row variant with action menu
  async function handleExportPdf() {
    try {
      const data = await getClientReportData(client.client_id);
      generateClientPdfReport(data);
      toast.success('Client PDF report generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF report');
    }
  }

  return (
    <TableRow
      onClick={onOpenDetails}
      className="group cursor-pointer transition-colors duration-150 hover:bg-row-hover"
    >
      <TableCell className={`py-2.5 pr-3 ${gutterL}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-row-hover ring-1 ring-inset ring-border text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
          </div>
          <p className="truncate text-sm font-medium text-foreground">{client.full_name}</p>
        </div>
      </TableCell>

      <TableCell className="py-2.5 px-3">
        <p className="truncate text-xs text-muted-foreground max-w-xs sm:max-w-md">
          {client.address || 'No address recorded'}
        </p>
      </TableCell>

      <TableCell className="py-2.5 px-3">
        <ClientStatusPill status={client.status} />
      </TableCell>

      <TableCell
        className={`py-2.5 pl-3 ${gutterR} w-12 text-right`}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${client.full_name}`}
              className="h-8 w-8 opacity-70 group-hover:opacity-100"
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
            <DropdownMenuItem onSelect={onOpenDetails}>
              <Activity className="h-4 w-4 mr-2" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExportPdf}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenEdit}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onOpenDelete}
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

