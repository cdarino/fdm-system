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
    limit: 200,
    sortBy: 'full_name',
    sortOrder: 'asc',
    includeArchived: true,
  });

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-8 pb-6 sm:pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Client records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find a client, verify their details, complete their documents, then review assigned lots.
        </p>
      </div>
      <ClientsSection clients={result.data} />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <PageContainer padding="horizontal">
      <Suspense fallback={<ClientsSkeleton />}>
        <ClientsContent />
      </Suspense>
    </PageContainer>
  );
}
