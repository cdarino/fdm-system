import { Suspense } from 'react';
import { redirect, unstable_rethrow } from 'next/navigation';
import { ClientsSection } from '@/components/dashboard-clients/client-section';
import { PageError } from '@/components/dashboard-layout/page-status';
import { ClientsSkeleton } from '@/components/dashboard-layout/page-skeletons';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getClients } from '@/lib/actions/clients';
import { hasPermission } from '@/lib/permissions';
import { getUserInfo } from '@/lib/user';

export const dynamic = 'force-dynamic';

type ClientsAccess =
  | { status: 'ok'; clients: Awaited<ReturnType<typeof getClients>>['data'] }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'error' };

async function resolveClients(): Promise<ClientsAccess> {
  try {
    const user = await getUserInfo();

    if (!user) return { status: 'unauthenticated' };

    const allowed = await hasPermission('clients.read', user.id);
    if (!allowed) return { status: 'forbidden' };

    // Archived clients ship with the first render so the Archived tab is
    // populated without a second round trip. The client filters them out of
    // every other tab.
    const result = await getClients({
      limit: 100,
      sortBy: 'full_name',
      sortOrder: 'asc',
      includeArchived: true,
    });
    return { status: 'ok', clients: result.data };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error loading clients page:', error);
    return { status: 'error' };
  }
}

async function ClientsContent() {
  const access = await resolveClients();

  if (access.status === 'unauthenticated') redirect('/login');
  if (access.status === 'forbidden') redirect('/dashboard');
  if (access.status === 'error') {
    return <PageError message="Failed to load clients. Please try again." />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage client records, contact information, and activity history.
        </p>
      </div>
      <ClientsSection clients={access.clients} />
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
