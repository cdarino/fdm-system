'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { ActivityTime } from '@/components/shared/activity-time';
import { ACTIVITY_UPDATED_EVENT } from '@/lib/activity-events';
import { getRecentActivity, type RecentActivityItem } from '@/lib/actions/recent-activity';

export function UniversalActivityCard({ initialItems }: { initialItems: RecentActivityItem[] }) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => setItems(initialItems), [initialItems]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const updated = await getRecentActivity();
        if (active) setItems(updated);
      } catch {
        // Keep the last recorded activity during background failures
      }
    };

    const listener = () => void refresh();
    window.addEventListener(ACTIVITY_UPDATED_EVENT, listener);
    const interval = window.setInterval(listener, 30_000);
    return () => {
      active = false;
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, listener);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Recent changes</CardTitle>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live feed
            </span>
            <IconBox variant="canvas" size="default" aria-label="Workspace activity feed">
              <History className="h-4 w-4" />
            </IconBox>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        {items.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No recorded activity is available for your access level.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {items.slice(0, 5).map((item) => (
              <li key={`${item.kind}-${item.id}`} className="py-2.5 first:pt-0">
                <Link
                  href={item.href}
                  className="group block rounded-md p-1 transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-medium">
                    {item.label}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    <ActivityTime timestamp={item.timestamp} /> &bull; {item.actor}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live workspace feed
          </span>
          <Link href="/dashboard/settings/audit-logs" className="font-medium text-primary hover:underline">
            View Audit Log &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
