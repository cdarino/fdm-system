import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/dashboard-layout/page-container';
import { getClientById } from '@/lib/actions/clients';
import { verifyPageAccess } from '@/lib/actions/auth-guard';
import { ClientDetailView } from '@/components/dashboard-clients/client-detail-view';
import { parseAssignPlotParams, type PreSelectedPlot } from '@/lib/utils/lot-destination';

export const dynamic = 'force-dynamic';

interface ClientDetailContentProps {
  clientId: string;
  assignPropertyId?: string;
  assignPlot?: PreSelectedPlot;
}

async function ClientDetailContent({ clientId, assignPropertyId, assignPlot }: ClientDetailContentProps) {
  await verifyPageAccess('clients.read');

  let clientDetails;
  try {
    clientDetails = await getClientById(clientId);
  } catch (error) {
    console.error('Failed to fetch client:', error);
    notFound();
  }

  return (
    <ClientDetailView
      initialClient={clientDetails}
      assignPropertyId={assignPropertyId}
      assignPlot={assignPlot}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-3">
      <div className="h-full min-h-0 lg:col-span-1 lg:border-r lg:border-border-warm lg:pr-6">
        <div className="h-full animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-full min-h-0 lg:col-span-2">
        <div className="h-full animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    assignProperty?: string;
    assignProjectArea?: string;
    assignBlock?: string;
    assignLot?: string;
    assignArea?: string;
    assignPrice?: string;
  }>;
}

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const { id: clientId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const assignPropertyId = resolvedSearchParams?.assignProperty;
  const assignPlot = assignPropertyId ? undefined : parseAssignPlotParams(resolvedSearchParams);

  return (
    <PageContainer className="lg:overflow-hidden">
      <Suspense fallback={<LoadingSkeleton />}>
        <ClientDetailContent
          clientId={clientId}
          assignPropertyId={assignPropertyId}
          assignPlot={assignPlot}
        />
      </Suspense>
    </PageContainer>
  );
}
