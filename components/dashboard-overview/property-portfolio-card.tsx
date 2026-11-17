'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, LandPlot, MapPinned } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import { ProjectAreaMap } from '@/components/dashboard-properties/map-project-area';
import { cn } from '@/lib/utils';
import type { DashboardMapPreview, DashboardStats } from '@/lib/types/dashboard';

const LOT_COLORS = [
  'var(--success)',
  'var(--primary)',
  'var(--secondary)',
  'var(--destructive)',
];

class MapPreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Map preview render error caught by boundary:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface PropertyPortfolioCardProps {
  isFullWidth?: boolean;
  preview: DashboardMapPreview | null;
  statuses: DashboardStats['lotStatuses'];
}

export function PropertyPortfolioCard({
  isFullWidth,
  preview,
  statuses,
}: PropertyPortfolioCardProps) {
  const projectArea = preview?.projectArea;
  const total = statuses.reduce((sum, s) => sum + (s.count ?? 0), 0);
  let offset = 0;

  const fallback = (
    <div className="relative w-full h-full rounded-lg border border-border bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="relative text-center p-4">
        <LandPlot className="h-6 w-6 text-primary mx-auto mb-2 opacity-80" />
        <p className="text-sm font-semibold text-foreground">
          {projectArea ? `${projectArea.lots?.length ?? 0} lots demarcated` : 'No project areas to preview'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {projectArea ? `${projectArea.name} · Approved geodetic plan` : 'Open property map to explore recorded lots'}
        </p>
      </div>
    </div>
  );

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Property portfolio</CardTitle>
          <IconBox variant="canvas" size="default" aria-label="Property portfolio module">
            <LandPlot className="h-4 w-4" />
          </IconBox>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className={cn(isFullWidth ? 'grid grid-cols-1 lg:grid-cols-2 gap-8 items-start' : 'space-y-6')}>
          {/* 1. Subdivision Plat Map Preview Block */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                Subdivision Plat Map &bull; {projectArea?.name ?? 'Project Area'}
              </span>
              <Link
                href="/dashboard/properties/map"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                Open full map <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div
              className={cn(
                'relative w-full rounded-lg border border-border bg-sidebar-accent overflow-hidden',
                isFullWidth ? 'h-64' : 'h-52'
              )}
            >
              {projectArea ? (
                <MapPreviewErrorBoundary fallback={fallback}>
                  <div
                    inert
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50"
                  >
                    <ProjectAreaMap
                      projectArea={projectArea}
                      focusedProjectAreaId={projectArea.project_area_id}
                      isSidebarOpen={false}
                      preview
                    />
                  </div>
                </MapPreviewErrorBoundary>
              ) : (
                fallback
              )}
            </div>
          </div>

          {/* 2. Lot Inventory Breakdown Block */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground">
                Lot Inventory Breakdown &bull; {total.toLocaleString()} total lots recorded
              </span>
              <span className="text-xs text-muted-foreground">Active inventory status</span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-6">
              {/* SVG Donut Chart */}
              <div className="relative h-44 w-44 shrink-0 mx-auto sm:mx-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="var(--muted)" strokeWidth="16" />
                  {statuses.map((item, i) => {
                    const fraction = total ? ((item.count ?? 0) / total) * 100 : 0;
                    const start = offset;
                    offset += fraction;
                    return (
                      <circle
                        key={item.label}
                        cx="60"
                        cy="60"
                        r="46"
                        pathLength="100"
                        fill="none"
                        stroke={LOT_COLORS[i]}
                        strokeWidth="16"
                        strokeDasharray={`${fraction} ${100 - fraction}`}
                        strokeDashoffset={-start}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-foreground">{total.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">total lots</span>
                </div>
              </div>

              {/* Status Breakdown Legend - Clean, Borderless List Rows */}
              <div className="flex-1 w-full space-y-2">
                {statuses.map((item, i) => (
                  <Link
                    key={item.label}
                    href={`/dashboard/properties?status=${encodeURIComponent(item.label)}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: LOT_COLORS[i] }} />
                      <span className="truncate font-medium text-foreground">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums text-foreground">
                        {item.count?.toLocaleString() ?? 0}
                      </span>
                      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                        {total ? Math.round(((item.count ?? 0) / total) * 100) : 0}%
                      </span>
                      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>ArcGIS &bull; Vector polygons &bull; Active inventory</span>
          <Link href="/dashboard/properties" className="font-medium text-primary hover:underline">
            Open Properties Directory &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
