'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Clock, FileCheck2, FileText, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { cn } from '@/lib/utils';

export interface TitleActionRecord {
  id: string;
  name: string;
  lot: string;
  state: string;
  statusTab: string;
  isAlert?: boolean;
}

export interface TitleActionQueue {
  key: string;
  label: string;
  count: number;
  records: TitleActionRecord[];
}

const QUEUE_ICONS: Record<string, LucideIcon> = {
  ready: Clock,
  unclaimed: Clock,
  intake: FileCheck2,
  preparation: FileText,
  prep: FileText,
  review: CheckCircle2,
};

interface TitleActionCardProps {
  isFullWidth?: boolean;
  queues: TitleActionQueue[];
  totalReleasedCount: number;
}

export function TitleActionCard({
  isFullWidth,
  queues,
  totalReleasedCount,
}: TitleActionCardProps) {
  const [activeQueueKey, setActiveQueueKey] = useState<string>(() => queues[0]?.key ?? 'ready');
  const currentQueue = queues.find((q) => q.key === activeQueueKey) ?? queues[0];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Title records needing action</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Legal & Titling module">
            <FileCheck2 className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div>
          {/* Queue selector: 4 columns when full-width, 2 columns when paired */}
          <div
            className={cn(
              'grid gap-2 w-full',
              isFullWidth ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
            )}
            role="group"
            aria-label="Active title queues"
          >
            {queues.map((q) => {
              const Icon = QUEUE_ICONS[q.key] ?? FileText;
              const isSelected = activeQueueKey === q.key;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => setActiveQueueKey(q.key)}
                  className={cn(
                    'flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'border-primary bg-sidebar-accent font-semibold text-foreground shadow-2xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="truncate">{q.label}</span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold shrink-0',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {q.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Showing {currentQueue?.records.length ?? 0} records in <strong className="text-foreground">{currentQueue?.label}</strong>
            </p>

            {(!currentQueue || currentQueue.records.length === 0) ? (
              <p className="py-6 text-sm text-muted-foreground">
                No title records currently in this stage.
              </p>
            ) : (
              <ul
                className={cn(
                  isFullWidth
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
                    : 'divide-y divide-border'
                )}
              >
                {currentQueue.records.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      isFullWidth
                        ? 'rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors'
                        : 'py-3 hover:bg-muted rounded-md'
                    )}
                  >
                    <Link
                      href={`/dashboard/legal?status=${item.statusTab}`}
                      className="flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium text-foreground">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.lot}
                        </span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            item.isAlert ? 'text-destructive font-semibold' : 'text-muted-foreground'
                          )}
                        >
                          {item.state}
                        </span>
                        <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalReleasedCount.toLocaleString()} titles successfully released to date.</span>
          <Link
            href={`/dashboard/legal?status=${currentQueue?.records[0]?.statusTab ?? 'ready'}`}
            className="font-medium text-primary hover:underline"
          >
            Open in Legal Workspace &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
