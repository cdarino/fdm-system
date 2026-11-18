'use client';

import * as React from 'react';
import { ChevronRight, FileText, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FileTree({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="file-tree"
      className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}
      {...props}
    >
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export interface FileTreeFolderProps {
  label: string;
  sublabel?: string;
  meta?: string;
  expanded: boolean;
  onToggle: () => void;
  depth?: 0 | 1;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FileTreeFolder({
  label,
  sublabel,
  meta,
  expanded,
  onToggle,
  depth = 0,
  actions,
  children,
  className,
}: FileTreeFolderProps) {
  const Icon = expanded ? FolderOpen : Folder;

  return (
    <div data-slot="file-tree-folder" className={cn(depth === 0 && 'py-0.5', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          'group flex cursor-pointer select-none items-center justify-between gap-2 transition-colors hover:bg-row-hover',
          depth === 0 ? 'px-3 py-2' : 'py-1.5 pl-10 pr-3'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200 ease-in-out',
                expanded ? 'rotate-90' : 'rotate-0'
              )}
            />
          </div>

          <Icon className="h-4 w-4 shrink-0 text-primary" />

          <span className="truncate text-sm font-semibold text-foreground">
            {label}
          </span>

          {sublabel && (
            <span className="hidden truncate text-xs text-muted-foreground md:inline">
              ({sublabel})
            </span>
          )}

          {meta && (
            <span className="ml-1 shrink-0 text-xs text-muted-foreground">
              • {meta}
            </span>
          )}
        </div>

        {actions && (
          <div
            className="flex shrink-0 items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Animate folder height without unmounting children. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
          expanded
            ? 'grid-rows-[1fr] opacity-100'
            : 'pointer-events-none grid-rows-[0fr] opacity-0'
        )}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="overflow-hidden">
          <div className={cn('space-y-0.5', depth === 0 ? 'pb-1' : 'pb-0.5')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface FileTreeItemProps {
  label: React.ReactNode;
  secondaryLabel?: React.ReactNode;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  depth?: 1 | 2;
  loading?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  hoverActions?: React.ReactNode;
  pinnedActions?: React.ReactNode;
  className?: string;
}

export function FileTreeItem({
  label,
  secondaryLabel,
  badge,
  description,
  icon,
  depth = 1,
  loading = false,
  onClick,
  ariaLabel,
  hoverActions,
  pinnedActions,
  className,
}: FileTreeItemProps) {
  const isInteractive = Boolean(onClick);

  return (
    <div
      data-slot="file-tree-item"
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'group select-none py-1.5 text-sm transition-colors hover:bg-row-hover',
        isInteractive && 'cursor-pointer focus-visible:bg-row-hover focus-visible:outline-none',
        depth === 1 ? 'pl-10 pr-3' : 'pl-[68px] pr-3',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            icon ?? (
              <FileText
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-colors',
                  isInteractive && 'group-hover:text-primary'
                )}
              />
            )
          )}
          <span
            className={cn(
              'truncate text-sm font-normal text-foreground transition-colors',
              isInteractive && 'group-hover:text-primary'
            )}
          >
            {label}
          </span>
          {secondaryLabel && (
            <span className="truncate text-xs text-muted-foreground">
              · {secondaryLabel}
            </span>
          )}
          {badge}
        </div>

        {(hoverActions || pinnedActions) && (
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {hoverActions && (
              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {hoverActions}
              </div>
            )}
            {pinnedActions && (
              <div className="flex items-center gap-1">{pinnedActions}</div>
            )}
          </div>
        )}
      </div>

      {description && <div className="mt-1 pl-6">{description}</div>}
    </div>
  );
}
