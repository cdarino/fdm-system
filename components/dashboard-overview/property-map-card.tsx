import Link from 'next/link';
import { ArrowUpRight, MapPinned } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteMap } from '@/components/dashboard-properties/map-site';
import type { DashboardMapPreview } from '@/lib/types/dashboard';

export function PropertyMapCard({ preview }: { preview: DashboardMapPreview | null }) {
  const site = preview?.site;

  return (
    <Link href="/dashboard/properties/map" className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card variant="interactive" className="overflow-hidden group-hover:border-primary">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Site map</CardTitle>
            <CardDescription className="mt-2">{site ? `${site.name} · site preview` : 'Explore your recorded properties'}</CardDescription>
          </div>
          <MapPinned aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardHeader>
        <div className="relative mx-6 h-48 overflow-hidden rounded-lg border bg-sidebar-accent">
          {site ? (
            <div inert aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50">
              <SiteMap site={site} focusedSiteId={site.site_id} isSidebarOpen={false} preview />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-5 text-center text-muted-foreground"><div><MapPinned aria-hidden="true" className="mx-auto mb-3 h-8 w-8" /><p className="text-sm">{preview === null ? 'Map preview is temporarily unavailable.' : 'No sites to preview yet.'}</p></div></div>
          )}
        </div>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{site ? 'Site imagery and plotted lots. Open the map to explore.' : 'Open the site map to explore your properties.'}</p>
          <div className="mt-4 flex items-center justify-between text-sm font-semibold">Open Site Map<ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
        </CardContent>
      </Card>
    </Link>
  );
}
