import { Suspense } from 'react';
import { SiteMapUnifiedView } from '@/components/dashboard-properties/map-site-unified-view';
import { SiteMapSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getAllSitesWithLots } from '@/lib/actions/sites';
import { verifyPageAccess } from '@/lib/actions/auth-guard';

async function SiteMapContent() {
  await verifyPageAccess('properties.read');
  const sites = await getAllSitesWithLots();

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
