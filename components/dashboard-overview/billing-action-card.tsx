'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Clock, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/billing/ledger-engine';

export interface BillingDueSoonItem {
  id: string;
  name: string;
  lot: string;
  due: string;
  amount: number;
  daysLeft: string;
}

export interface BillingOverdueItem {
  id: string;
  name: string;
  lot: string;
  overdueMonths: string;
  amount: number;
  stage: string;
}

interface BillingActionCardProps {
  isFullWidth?: boolean;
  dueSoonAccounts: BillingDueSoonItem[];
  overdueAccounts: BillingOverdueItem[];
}

export function BillingActionCard({
  isFullWidth,
  dueSoonAccounts,
  overdueAccounts,
}: BillingActionCardProps) {
  const [view, setView] = useState<'due_soon' | 'overdue'>('due_soon');
  const items = view === 'due_soon' ? dueSoonAccounts : overdueAccounts;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Billing accounts needing attention</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Billing module">
            <Receipt className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div>
          <div
            className={cn(
              'grid gap-3',
              isFullWidth ? 'grid-cols-2 max-w-md' : 'grid-cols-2'
            )}
            role="group"
            aria-label="Filter billing issues"
          >
            <button
              type="button"
              onClick={() => setView('due_soon')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'due_soon' ? 'border-primary bg-sidebar-accent' : 'bg-background'
              )}
            >
              <Clock aria-hidden="true" className="mb-2 h-4 w-4 text-primary" />
              <span className="block text-2xl font-semibold tabular-nums">{dueSoonAccounts.length}</span>
              <span className="text-xs text-muted-foreground">Due soon (within 15 days)</span>
            </button>

            <button
              type="button"
              onClick={() => setView('overdue')}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === 'overdue' ? 'border-primary bg-sidebar-accent' : 'bg-background'
              )}
            >
              <AlertTriangle aria-hidden="true" className="mb-2 h-4 w-4 text-amber-600 dark:text-amber-500" />
              <span className="block text-2xl font-semibold tabular-nums">{overdueAccounts.length}</span>
              <span className="text-xs text-muted-foreground">In arrears / Overdue</span>
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              {view === 'due_soon'
                ? `Showing ${Math.min(5, items.length)} upcoming maturities · chronological order`
                : `Showing ${Math.min(5, items.length)} urgent overdue accounts · priority order`}
            </p>

            {items.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                {view === 'due_soon'
                  ? 'No accounts currently approaching maturity within 15 days.'
                  : 'No accounts currently in arrears or overdue.'}
              </p>
            ) : (
              <ul
                className={cn(
                  isFullWidth
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
                    : 'divide-y divide-border'
                )}
              >
                {items.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      isFullWidth
                        ? 'rounded-lg border border-border/70 p-3 hover:bg-muted/50 transition-colors'
                        : 'py-3 hover:bg-muted rounded-md'
                    )}
                  >
                    <Link
                      href="/dashboard/billing"
                      className="flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium text-foreground">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.lot} &bull;{' '}
                          {'daysLeft' in item ? (
                            <span className="text-foreground font-medium">Due {item.due} ({item.daysLeft})</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-500 font-medium">
                              {item.overdueMonths} ({item.stage})
                            </span>
                          )}
                        </span>
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0 text-right">
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {formatCurrency(item.amount)}
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
          <span>Active accounts monitored daily.</span>
          <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">
            Open Billing Ledgers &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
