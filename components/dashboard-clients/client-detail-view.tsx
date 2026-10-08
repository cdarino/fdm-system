'use client';

import { ClientDetailProvider } from '@/lib/hooks/use-client-detail';
import { ClientDetailSidebar } from './client-detail-sidebar';
import { ClientDetailTabs } from './client-detail-tabs';
import type { ClientWithDetails } from '@/lib/types/client';

interface ClientDetailViewProps {
  initialClient: ClientWithDetails;
  assignPropertyId?: string;
}

export function ClientDetailView({ initialClient, assignPropertyId }: ClientDetailViewProps) {
  return (
    <ClientDetailProvider initialClient={initialClient}>
      <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-3">
        <div className="h-full min-h-0 lg:col-span-1 lg:border-r lg:border-border-warm lg:pr-6">
          <ClientDetailSidebar />
        </div>

        <div className="h-full min-h-0 lg:col-span-2">
          <ClientDetailTabs assignPropertyId={assignPropertyId} />
        </div>
      </div>
    </ClientDetailProvider>
  );
}
