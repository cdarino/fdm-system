import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Suspense fallbacks for the dashboard pages.
 *
 * Each one mirrors the real page's layout — same card count, same grid, same
 * rough block sizes — so the content lands in place instead of the page
 * jumping when a centred spinner is swapped out for a full layout.
 *
 * `aria-hidden` plus a labelled `role="status"` wrapper keeps screen readers
 * hearing "Loading …" once rather than reading out a wall of empty boxes.
 */
function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** Heading block: page title with a subtitle beneath it. */
function TitleSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56 max-w-full" />
      {withSubtitle && <Skeleton className="h-4 w-80 max-w-full" />}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading dashboard…">
      <div className="space-y-8">
        {/* Welcome banner */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>

        {/* Administration callout — present for system admins only, but the
            fallback cannot know the role yet, so it reserves the space. */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>

        <div className="space-y-6">
          <Skeleton className="h-7 w-56" />

          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function AdminSkeleton() {
  return (
    <LoadingRegion label="Loading administration…">
      <div className="flex flex-1 flex-col gap-6">
        <Skeleton className="h-7 w-48" />

        <Card className="flex flex-1 flex-col overflow-hidden border-border bg-card">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 px-4 pb-5 pt-6 sm:px-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>

          {/* Toolbar: status tabs on the left, search and filter on the right */}
          <div className="flex flex-col gap-3 px-4 pb-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            <Skeleton className="h-10 w-64 rounded-lg" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-9 w-full rounded-md sm:w-72" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>

          <div className="border-t border-border">
            <UserRowsSkeleton />
          </div>
        </Card>
      </div>
    </LoadingRegion>
  );
}

/**
 * Placeholder user rows, shaped like the real ones — same 36px avatar and the
 * same `py-4`, so the list does not reflow when the data arrives.
 *
 * Exported because the admin page's Suspense fallback and the user table's own
 * in-component loading state both need it.
 */
export function UserRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4 sm:px-6">
          <Skeleton className="h-4 w-4 shrink-0" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-36 max-w-full" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="hidden h-6 w-28 shrink-0 rounded-md md:block" />
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <LoadingRegion label="Loading settings…">
      <div className="flex flex-1 flex-col gap-6">
        <TitleSkeleton />

        {/* Profile card: name, email, then roles across both columns */}
        <Card className="border-border bg-card">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-44 max-w-full" />
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Skeleton className="h-3 w-16" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-28 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change password card: three fields, then the action row */}
        <Card className="border-border bg-card">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 w-36 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    </LoadingRegion>
  );
}
