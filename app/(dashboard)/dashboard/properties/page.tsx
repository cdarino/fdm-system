import { Suspense } from 'react';
import { PropertyLotsSection } from '@/components/dashboard-properties/property-lots-section';
import { PropertiesSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getSites } from '@/lib/actions/sites';
import { verifyPageAccess } from '@/lib/actions/auth-guard';

async function PropertiesContent() {
  await verifyPageAccess('properties.read');
  const sites = await getSites();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Property Lots</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raw land inventory across the company&apos;s sites.
        </p>
      </div>
      <PropertyLotsSection sites={sites} />
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <PageContainer>
      <Suspense fallback={<PropertiesSkeleton />}>
        <PropertiesContent />
      </Suspense>
    </PageContainer>
  );
}
