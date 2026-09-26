import { Suspense } from 'react';
import { redirect, unstable_rethrow } from 'next/navigation';
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
