import type { SiteWithLots } from '@/lib/types/property';
import type { ClientFollowUp } from '@/lib/client-record-review';

export interface DashboardStats {
  mapPreview: DashboardMapPreview | null;
  canReadProperties: boolean;
  canReadClients: boolean;
  propertyLots: number | null;
  clients: number | null;
  lotStatuses: { label: string; count: number | null }[];
  activeClients: number | null;
  archivedClients: number | null;
  clientFollowUps: ClientFollowUp[] | null;
  recentClients: { client_id: string; full_name: string; status: string; updated_at: string }[] | null;
}

export interface DashboardMapPreview {
  site: SiteWithLots | null;
}
