import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table2, LandPlot } from 'lucide-react';
import { SiteMap } from '@/components/dashboard/site-map';
import { PageError } from '@/components/dashboard/page-status';
import { SiteMapSkeleton } from '@/components/dashboard/page-skeletons';
import { getSites, getSiteWithLots } from '@/lib/actions/sites';
import { hasPermission } from '@/lib/permissions';
import { getUserInfo } from '@/lib/user';

/**
 * Gated on `properties.read`, matching the Property Lots table this sits
 * beside. Returns a status rather than redirecting from inside the try block —
 * `redirect()` throws, so the catch would swallow it. See the admin page.
 */
async function resolveAccess() {
  try {
    const user = await getUserInfo();
    if (!user) return { status: 'unauthenticated' as const };
    const allowed = await hasPermission('properties.read', user.id);
    return allowed ? { status: 'ok' as const } : { status: 'forbidden' as const };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error loading site map page:', error);
    return { status: 'error' as const };
  }
}

async function SiteMapContent({ siteId }: { siteId?: string }) {
  const access = await resolveAccess();
  if (access.status === 'unauthenticated') redirect('/login');
  if (access.status === 'forbidden') redirect('/dashboard');
  if (access.status === 'error') {
    return <PageError message="Failed to load the site map. Please try again." />;
  }

  let sites;
  try {
    sites = await getSites();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error fetching sites:', error);
    return <PageError message="Failed to load sites. Please try again." />;
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site Map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visual land division showing how each site is cut into lots.
        </p>
      </div>
      <Button asChild variant="outline" className="gap-2 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground">
        <Link href="/dashboard/properties">
          <Table2 className="h-4 w-4" />
          Lot list
        </Link>
      </Button>
    </div>
  );

  if (sites.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        {header}
        <Card className="flex flex-1 flex-col items-center justify-center gap-4 border-border bg-card px-6 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
            <LandPlot className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">No sites to draw yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              A site needs an outline before its plan can be rendered. Seed the sample site with{' '}
              <code className="text-xs">npm run seed:sample-site</code>, or add one once the
              company&apos;s subdivision plan has been traced.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Default to the first site until the picker is wired to the URL.
  const active = sites.find((s) => s.site_id === siteId) ?? sites[0];
  const site = await getSiteWithLots(active.site_id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      {header}

      {sites.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-row-hover p-1">
          {sites.map((s) => {
            const isActive = s.site_id === active.site_id;
            return (
              <Link
                key={s.site_id}
                href={`/dashboard/properties/map?site=${s.site_id}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.name}
              </Link>
            );
          })}
        </div>
      )}

      <Card className="flex min-h-[28rem] flex-1 flex-col overflow-hidden border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{site.name}</h2>
            {site.description && (
              <p className="text-xs text-muted-foreground">{site.description}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {site.lots.length} lot{site.lots.length === 1 ? '' : 's'} on this site
          </p>
        </div>
        <SiteMap site={site} />
      </Card>
    </div>
  );
}

export default async function SiteMapPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  return (
    <Suspense fallback={<SiteMapSkeleton />}>
      <SiteMapContent siteId={site} />
    </Suspense>
  );
}
