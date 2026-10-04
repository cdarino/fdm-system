'use client';

import { useState, useEffect } from 'react';
import { ClientDetailSidebar } from './client-detail-sidebar';
import { ClientDetailTabs } from './client-detail-tabs';
import type { ClientWithDetails } from '@/lib/types/client';

interface ClientDetailViewProps {
  initialClient: ClientWithDetails;
  assignPropertyId?: string;
}

export function ClientDetailView({ initialClient, assignPropertyId }: ClientDetailViewProps) {
  const [client, setClient] = useState<ClientWithDetails>(initialClient);

  // Sync state when server re-renders with new props
  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  return (
    <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-3">
      <div className="h-full min-h-0 lg:col-span-1 lg:border-r lg:border-border-warm lg:pr-6">
        <ClientDetailSidebar client={client} onClientChange={setClient} />
      </div>

      <div className="h-full min-h-0 lg:col-span-2">
        <ClientDetailTabs
          client={client}
          onClientChange={setClient}
          assignPropertyId={assignPropertyId}
        />
      </div>
    </div>
  );
}
