import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Table2, LandPlot } from 'lucide-react';
import { SiteMap } from '@/components/dashboard/site-map';
import { SitePicker } from '@/components/dashboard/site-picker';
import { PageError } from '@/components/dashboard/page-status';
import { SiteMapSkeleton } from '@/components/dashboard/page-skeletons';
import { PageContainer } from '@/components/dashboard/page-container';
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
    return (
      <div className="p-8">
        <PageError message="Failed to load the site map. Please try again." />
      </div>
    );
  }

  let sites;
  try {
    sites = await getSites();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error fetching sites:', error);
    return (
      <div className="p-8">
        <PageError message="Failed to load sites. Please try again." />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-1 flex-col h-full">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <div>
            <h1 className="text-base font-semibold leading-none text-foreground leading-none">Site Map</h1>
            {/* <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
              Visual land division showing how each site is cut into lots.
            </p> */}
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground">
            <Link href="/dashboard/properties">
              <Table2 className="h-3.5 w-3.5" />
              Lot list
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-row-hover">
              <LandPlot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">No sites to draw yet</p>
              <p className="text-sm text-muted-foreground">
                A site needs an outline before its plan can be rendered. Seed the sample site with{' '}
                <code className="text-xs">npm run seed:sample-site</code>, or add one once the
                company&apos;s subdivision plan has been traced.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default to the first site until the picker is wired to the URL.
  const active = sites.find((s) => s.site_id === siteId) ?? sites[0];
  const site = await getSiteWithLots(active.site_id);

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      {/* Compact Top Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold leading-none text-foreground">Site Map</h1>
            {/* <p className="mt-1 hidden text-xs text-muted-foreground sm:block leading-none">
              Visual land division showing how each site is cut into lots.
            </p> */}
          </div>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground whitespace-nowrap md:inline">
              Current site:
            </span>
            <SitePicker sites={sites} currentSiteId={active.site_id} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground md:inline">
            {site.lots.length} lot{site.lots.length === 1 ? '' : 's'} on this site
          </span>
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground">
            <Link href="/dashboard/properties">
              <Table2 className="h-3.5 w-3.5" />
              Lot list
            </Link>
          </Button>
        </div>
      </div>

      {/* Edge-to-edge interactive canvas */}
      <SiteMap site={site} />
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
    <PageContainer padding={false} scrollable={false}>
      <Suspense fallback={<SiteMapSkeleton />}>
        <SiteMapContent siteId={site} />
      </Suspense>
    </PageContainer>
  );
}
