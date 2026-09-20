'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Loader2, AlertCircle } from 'lucide-react';
import { getArcGISToken } from '@/lib/actions/arcgis';
import { useLeafletMap } from '@/lib/hooks/use-leaflet-map';
import type { SiteWithLots } from '@/lib/types/property';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

export interface SiteMapProps {
  site: SiteWithLots;
  selectedLotId?: string | null;
  onSelectLot?: (lotId: string | null) => void;
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export function SiteMap({
  site,
  className,
  initialCenter = [7.0531, 125.67006],
  initialZoom = 12,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { map, isReady, zoomIn, zoomOut } = useLeafletMap(containerRef, {
    center: initialCenter,
    zoom: initialZoom,
    scrollWheelZoom: true,
    zoomControl: false,
  });

  const fetchToken = () => {
    startTransition(async () => {
      try {
        setTokenError(null);
        const result = await getArcGISToken();
        setToken(result.accessToken);
      } catch (err) {
        setTokenError(
          err instanceof Error ? err.message : 'Failed to retrieve ArcGIS token'
        );
      }
    });
  };

  useEffect(() => {
    fetchToken();
  }, []);

  useEffect(() => {
    if (!map || !isReady || !token) return;

    let isMounted = true;
    let satelliteLayer: import('leaflet').TileLayer | null = null;
    let labelsLayer: import('leaflet').TileLayer | null = null;

    async function addTileLayers() {
      const L = (await import('leaflet')).default;
      // Guard against component unmount or map teardown before import resolves
      if (!isMounted || !map || !map.getContainer()) return;

      // Base layer for satellite imagery (standard 256x256 tiles)
      satelliteLayer = L.tileLayer(
        `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${token}`,
        {
          attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
          maxZoom: 19,
          tileSize: 256,
          keepBuffer: 8,
          updateWhenIdle: false,
          updateWhenZooming: true,
        }
      );

      satelliteLayer.on('tileerror', (event) => {
        console.warn('ArcGIS satellite tile error:', event);
      });

      satelliteLayer.addTo(map);

      // Transparent overlay layer for streets and location labels (512x512 ArcGIS tiles)
      labelsLayer = L.tileLayer(
        `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/open/hybrid/detail/static/tile/{z}/{y}/{x}?token=${token}`,
        {
          attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          keepBuffer: 8,
          updateWhenIdle: false,
          updateWhenZooming: true,
        }
      );

      labelsLayer.on('tileerror', (event) => {
        console.warn('ArcGIS labels tile error (verify account privileges):', event);
      });

      labelsLayer.addTo(map);
    }

    addTileLayers();

    return () => {
      isMounted = false;
      // Remove tile layers safely only if map container is still attached
      if (map && map.getContainer()) {
        if (satelliteLayer) map.removeLayer(satelliteLayer);
        if (labelsLayer) map.removeLayer(labelsLayer);
      }
    };
  }, [map, isReady, token]);

  return (
    <div
      className={cn(
        'relative flex flex-1 h-full min-h-0 w-full flex-col overflow-hidden bg-background',
        className
      )}
      data-site-id={site.site_id}
    >
      {/* Map rendering canvas with dark satellite background and instant tile snap */}
      <div
        ref={containerRef}
        className="h-full w-full z-0 bg-[#0b1120] [&_.leaflet-container]:!bg-[#0b1120] [&_.leaflet-tile]:!transition-none"
      />
b
      {/* Floating zoom controls at top-right corner */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 shadow-md">
        <Button
          variant="outline"
          size="icon"
          onClick={zoomIn}
          disabled={!isReady}
          aria-label="Zoom in"
          className="h-9 w-9 rounded-xl border-border bg-card text-foreground hover:bg-row-hover shadow-sm"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={zoomOut}
          disabled={!isReady}
          aria-label="Zoom out"
          className="h-9 w-9 rounded-xl border-border bg-card text-foreground hover:bg-row-hover shadow-sm"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading overlay while requesting token */}
      {isPending && !token && !tokenError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-xs">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">
              Connecting to ArcGIS...
            </span>
          </div>
        </div>
      )}

      {/* Error state if token request fails */}
      {tokenError && (
        <div className="absolute bottom-4 right-4 z-20 flex max-w-sm items-center gap-3 rounded-xl border border-destructive/40 bg-card p-3 shadow-lg">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-foreground">Map connection error</p>
            <p className="text-muted-foreground">{tokenError}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchToken}
            className="text-xs border-border bg-card hover:bg-row-hover"
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
