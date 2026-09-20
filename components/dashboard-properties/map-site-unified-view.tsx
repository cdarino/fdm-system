'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen } from 'lucide-react';
import { SiteMap } from './map-site';
import { PropertyLotsSidebar } from './property-lots-sidebar';
import type { Site, SiteWithLots } from '@/lib/types/property';
import { cn } from '@/lib/utils';

export interface SiteMapUnifiedViewProps {
  sites: Site[];
  site: SiteWithLots;
}

/**
 * Unified Map and Property Lots view with a floating collapsible card.
 *
 * The interactive subdivision site map fills the entire viewport, with an expandable
 * floating card positioned on the left side to browse, filter, search, and manage property lots.
 */
export function SiteMapUnifiedView({ sites, site }: SiteMapUnifiedViewProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="relative flex flex-1 h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Background: Edge-to-edge interactive canvas */}
      <div className="absolute inset-0 h-full w-full flex flex-col">
        <SiteMap key={site.site_id} site={site} />
      </div>

      {/* Floating Collapsible Card on Left */}
      <div
        className={cn(
          'absolute left-4 top-4 bottom-4 z-20 w-[420px] sm:w-[460px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out',
          isSidebarOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none'
        )}
      >
        <PropertyLotsSidebar
          sites={sites}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Floating expand toggle button when card is collapsed */}
      {!isSidebarOpen && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-20 gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg hover:bg-row-hover text-foreground font-medium"
          aria-label="Open property lots panel"
        >
          <PanelLeftOpen className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Property Lots</span>
          <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-accent-blue-foreground font-medium">
            {site.lots.length}
          </span>
        </Button>
      )}
    </div>
  );
}
