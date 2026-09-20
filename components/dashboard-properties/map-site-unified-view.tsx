'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen } from 'lucide-react';
import { SiteMap } from './map-site';
import { PropertyLotsSidebar } from './property-lots-sidebar';
import type { PropertyLotWithClient, SiteWithLots } from '@/lib/types/property';
import { cn } from '@/lib/utils';

export interface SiteMapUnifiedViewProps {
  sites: SiteWithLots[];
}

/** Interactive site map and floating property lots sidebar. */
export function SiteMapUnifiedView({ sites }: SiteMapUnifiedViewProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hoveredLotKey, setHoveredLotKey] = useState<string | null>(null);
  const [selectedPropertyLot, setSelectedPropertyLot] = useState<PropertyLotWithClient | null>(null);
  const [createInitialValues, setCreateInitialValues] = useState<{
    site_id?: string;
    block_number?: number;
    lot_number?: number;
  } | null>(null);

  const totalLots = sites.reduce((sum, s) => sum + s.lots.length, 0);

  const handleSelectLotProperty = useCallback((lot: PropertyLotWithClient) => {
    setIsSidebarOpen(true);
    setCreateInitialValues(null);
    setSelectedPropertyLot(lot);
  }, []);

  const handleSelectLot = useCallback((lot: PropertyLotWithClient | null) => {
    setCreateInitialValues(null);
    setSelectedPropertyLot(lot);
  }, []);

  const handleSelectUnregistered = useCallback(
    (data: { siteId: string; block: number; lot: number }) => {
      setIsSidebarOpen(true);
      setSelectedPropertyLot(null);
      setCreateInitialValues({
        site_id: data.siteId,
        block_number: data.block,
        lot_number: data.lot,
      });
    },
    [],
  );

  return (
    <div className="relative flex flex-1 h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Background: Edge-to-edge interactive canvas */}
      <div className="absolute inset-0 h-full w-full flex flex-col">
        <SiteMap
          sites={sites}
          isSidebarOpen={isSidebarOpen}
          hoveredLotKey={hoveredLotKey}
          selectedLotId={selectedPropertyLot?.property_id}
          onSelectLotProperty={handleSelectLotProperty}
          onSelectUnregistered={handleSelectUnregistered}
        />
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
          selectedLot={selectedPropertyLot}
          onSelectLot={handleSelectLot}
          onHoverLot={setHoveredLotKey}
          createInitialValues={createInitialValues}
          onClearCreateInitialValues={() => setCreateInitialValues(null)}
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
            {totalLots}
          </span>
        </Button>
      )}
    </div>
  );
}
