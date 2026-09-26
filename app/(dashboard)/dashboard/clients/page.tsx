import { Suspense } from 'react';
import { ClientsSection } from '@/components/dashboard-clients/client-section';
import { ClientsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getClients } from '@/lib/actions/clients';
import { verifyPageAccess } from '@/lib/actions/auth-guard';

export const dynamic = 'force-dynamic';

async function ClientsContent() {
  await verifyPageAccess('clients.read');

  // Archived clients ship with the first render so the Archived tab is
  // populated without a second round trip. The client filters them out of
  // every other tab.
  const result = await getClients({
    limit: 100,
    sortBy: 'full_name',
    sortOrder: 'asc',
    includeArchived: true,
  });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage client records, contact information, and activity history.
        </p>
      </div>
      <ClientsSection clients={result.data} />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <PageContainer>
      <Suspense fallback={<ClientsSkeleton />}>
        <ClientsContent />
      </Suspense>
    </PageContainer>
  );
}
