import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Table2, LandPlot } from 'lucide-react';
import { SiteMapUnifiedView } from '@/components/dashboard-properties/map-site-unified-view';
import { PageError } from '@/components/dashboard-layout/page-status';
import { SiteMapSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getAllSitesWithLots } from '@/lib/actions/sites';
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

async function SiteMapContent() {
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
    sites = await getAllSitesWithLots();
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
      <div className="flex flex-1 items-center justify-center p-6 text-center h-full">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
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
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-border bg-card text-foreground hover:bg-row-hover hover:text-foreground">
            <Link href="/dashboard/properties">
              <Table2 className="h-3.5 w-3.5" />
              Full lot table
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <SiteMapUnifiedView sites={sites} />;
}

export default async function SiteMapPage() {
  return (
    <PageContainer padding={false} scrollable={false}>
      <Suspense fallback={<SiteMapSkeleton />}>
        <SiteMapContent />
      </Suspense>
    </PageContainer>
  );
}
