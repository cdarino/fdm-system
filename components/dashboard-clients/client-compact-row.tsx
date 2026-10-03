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
import {
  UserRound,
  MoreHorizontal,
  Activity,
  Edit3,
  Trash2,
  Archive,
  ArchiveRestore,
  FileDown,
  Check,
} from 'lucide-react';
import { useSession } from '@/lib/hooks/use-session';
import { getClientReportData } from '@/lib/actions/reports';
import { generateClientPdfReport } from '@/lib/reports/pdf-client-report';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import { cn } from '@/lib/utils';
import { ARCHIVED_STATUS } from '@/lib/hooks/use-clients-page';
import { getArchiveEligibility } from '@/lib/utils/archive-rules';
import type { ClientListItem } from '@/lib/types/client';

export function ClientStatusPill({ status }: { status: string }) {
  const isActive = status.toLowerCase() === 'active';
  return (
    <Badge variant={isActive ? 'success' : 'muted'} shape="pill" dot>
      {status}
    </Badge>
  );
}


export interface ClientCompactRowProps {
  client: ClientListItem;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onOpenDetails?: () => void;
  onOpenEdit?: () => void;
  onOpenArchive?: () => void;
  onOpenRestore?: () => void;
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
  onOpenArchive,
  onOpenRestore,
  onOpenDelete,
  gutterL = 'pl-4 sm:pl-6',
  gutterR = 'pr-4 sm:pr-6',
}: ClientCompactRowProps) {
  const { isSystemAdmin } = useSession();
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
            <IconBox size="sm" shape="circle">
              <UserRound className="h-3.5 w-3.5" />
            </IconBox>
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

  const isArchived = client.status === ARCHIVED_STATUS || Boolean(client.is_archived);
  const eligibility = getArchiveEligibility(isArchived, client.archived_at);

  return (
    <TableRow
      onClick={onOpenDetails}
      className="group cursor-pointer transition-colors duration-150 hover:bg-row-hover"
    >
      <TableCell className={`py-2.5 pr-3 ${gutterL}`}>
        <div className="flex items-center gap-2.5">
          <IconBox size="sm" shape="circle">
            <UserRound className="h-3.5 w-3.5" />
          </IconBox>
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
            <DropdownMenuItem icon={<Activity className="h-4 w-4" />} onSelect={onOpenDetails}>
              View details
            </DropdownMenuItem>
            <DropdownMenuItem icon={<FileDown className="h-4 w-4" />} onSelect={handleExportPdf}>
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Edit3 className="h-4 w-4" />} onSelect={onOpenEdit}>
              Edit client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              hidden={!isArchived}
              icon={<ArchiveRestore className="h-4 w-4" />}
              onSelect={onOpenRestore}
            >
              Restore client
            </DropdownMenuItem>
            <DropdownMenuItem
              hidden={isArchived}
              icon={<Archive className="h-4 w-4" />}
              onSelect={onOpenArchive}
            >
              Archive client
            </DropdownMenuItem>
            <DropdownMenuItem
              hidden={!isArchived || !isSystemAdmin}
              disabled={!eligibility.isEligibleForDelete}
              disabledReason={eligibility.tooltipReason}
              variant="destructive"
              icon={<Trash2 className="h-4 w-4" />}
              onSelect={onOpenDelete}
            >
              Delete client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

