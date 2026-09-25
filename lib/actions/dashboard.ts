"use server";

import { getSiteWithLots } from "@/lib/actions/sites";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { getUserInfo } from "@/lib/user";
import { reviewClientRecord, type ReviewableClient, type ClientFollowUp } from '@/lib/client-record-review';
import { getPaginationOffsets } from '@/lib/pagination';
import type { DashboardStats, DashboardMapPreview } from "@/lib/types/dashboard";

// Exact counts avoid Supabase's row limit and keep record details on the server.
// null means unavailable; a failed query must never be presented as zero.
export async function getDashboardStats(): Promise<DashboardStats> {
  const user = await getUserInfo();
  const [canReadProperties, canReadClients] = user ? await Promise.all([
    hasPermission("properties.read", user.id),
    hasPermission("clients.read", user.id),
  ]) : [false, false];
  const supabase = await createClient();
  async function mapPreview(): Promise<DashboardMapPreview | null> {
    if (!canReadProperties) return null;
    const { data: site, error } = await supabase.from('site')
      .select('site_id').order('name').order('site_id').limit(1).maybeSingle();
    if (error) {
      console.error('Dashboard map preview failed:', error.message);
      return null;
    }
    if (!site) return { site: null };
    try {
      return { site: await getSiteWithLots(site.site_id) };
    } catch (error) {
      console.error('Dashboard map plots failed:', error);
      return null;
    }
  }

  async function followUps(): Promise<ClientFollowUp[] | null> {
    if (!canReadClients) return null;
    const items: ClientFollowUp[] = [];
    // Page through legacy records instead of silently stopping at the row limit.
    for (let page = 1; ; page++) {
      const { from, to, limit } = getPaginationOffsets({ page, limit: 500 });
      const { data, error } = await supabase.from('client')
        .select('client_id, full_name, contact_info(value), client_document(document_type)')
        .neq('status', 'Archived').order('client_id').range(from, to)
        .returns<ReviewableClient[]>();
      if (error || !data) {
        console.error('Dashboard record review failed:', error?.message);
        return null;
      }
      items.push(...data.map(reviewClientRecord).filter(item => item.missingContact || item.missingDocuments.length));
      if (data.length < limit) break;
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }
  async function count(table: 'client' | 'property_lot', allowed: boolean, status?: string): Promise<number | null> {
    if (!allowed) return null;
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    if (status) query = query.eq('status', status);
    const result = await query;
    if (result.error) {
      console.error(`Dashboard ${table} count failed:`, result.error.message);
      return null;
    }
    return result.count;
  }
  const [propertyLots, clients, lotStatuses, activeClients, archivedClients, clientFollowUps, recent, preview] = await Promise.all([
    count('property_lot', canReadProperties),
    count('client', canReadClients),
    Promise.all(['Open', 'Reserved', 'Sold', 'Forfeited'].map(async label => ({ label, count: await count('property_lot', canReadProperties, label) }))),
    count('client', canReadClients, 'Active'),
    count('client', canReadClients, 'Archived'),
    followUps(),
    canReadClients ? supabase.from('client').select('client_id, full_name, status, updated_at').order('updated_at', { ascending: false }).limit(5) : null,
    mapPreview(),
  ]);
  if (recent?.error) console.error('Dashboard recent clients failed:', recent.error.message);
  return {
    mapPreview: preview,
    canReadProperties, canReadClients, propertyLots, clients, lotStatuses,
    activeClients, archivedClients, clientFollowUps,
    recentClients: recent && !recent.error ? recent.data : null,
  };
}
