'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityTime } from '@/components/shared/activity-time';
import { ACTIVITY_UPDATED_EVENT } from '@/lib/activity-events';
import { getRecentActivity, type RecentActivityItem } from '@/lib/actions/recent-activity';

export function ActivityFeed({ initialItems }: { initialItems: RecentActivityItem[] }) {
  const [items, setItems] = useState(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const updated = await getRecentActivity();
        if (active) setItems(updated);
      } catch { /* Keep the last recorded activity during background failures. */ }
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Recent changes
        </CardTitle>
        <CardDescription>
          Recorded client activity and title status changes · refreshed every 30 seconds
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No recorded activity is available for your access level.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {items.slice(0, 6).map((item) => (
              <li key={`${item.kind}-${item.id}`} className="py-3 first:pt-0">
                <Link
                  href={item.href}
                  className="group block rounded-md p-1.5 transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-medium">
                    {item.label}
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {item.actor} · <ActivityTime timestamp={item.timestamp} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
