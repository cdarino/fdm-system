import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStats } from '@/lib/types/dashboard';

const COLORS = ['var(--success)', 'var(--primary)', 'var(--secondary)', 'var(--destructive)'];

export function PortfolioChart({ statuses }: { statuses: DashboardStats['lotStatuses'] }) {
  const unavailable = statuses.some(item => item.count === null);
  const total = statuses.reduce((sum, item) => sum + (item.count ?? 0), 0);
  let offset = 0;
  return (
    <Card className="h-full">
      <CardHeader><CardTitle><Link href="/dashboard/properties" className="inline-flex items-center gap-2 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Property portfolio<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></CardTitle><CardDescription>How your recorded lots are distributed today</CardDescription></CardHeader>
      <CardContent>
        {unavailable ? <p className="py-12 text-sm text-muted-foreground">Property breakdown is temporarily unavailable.</p> : <>
          <div className="flex flex-wrap items-center justify-center gap-8 py-2">
            <div className="relative h-48 w-48 shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r="46" fill="none" stroke="var(--muted)" strokeWidth="14" />
                {statuses.map((item, i) => {
                  const fraction = total ? (item.count ?? 0) / total * 100 : 0;
                  const start = offset;
                  offset += fraction;
                  return <circle key={item.label} cx="60" cy="60" r="46" pathLength="100" fill="none" stroke={COLORS[i]} strokeWidth="14" strokeDasharray={`${fraction} ${100 - fraction}`} strokeDashoffset={-start} />;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold tabular-nums">{total.toLocaleString()}</span><span className="text-sm text-muted-foreground">total lots</span></div>
            </div>
            <ul className="min-w-40 flex-1 space-y-4">
              {statuses.map((item, i) => <li key={item.label}><Link href={`/dashboard/properties?status=${encodeURIComponent(item.label)}`} className="flex items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} /><span className="flex-1">{item.label}</span><span className="font-semibold tabular-nums">{item.count?.toLocaleString()}</span><span className="w-12 text-right text-muted-foreground">{total ? Math.round((item.count ?? 0) / total * 100) : 0}%</span><ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" /></Link></li>)}
            </ul>
          </div>
          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">{total ? 'Current inventory by status. Percentages are rounded.' : 'No property lots yet. Your portfolio will appear here as lots are added.'}</p>
        </>}
      </CardContent>
    </Card>
  );
}
