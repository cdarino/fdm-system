'use client';

import { useEffect, useRef, useState, useTransition, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { getArcGISToken } from '@/lib/actions/arcgis';
import { useMapLibreMap } from '@/lib/hooks/use-maplibre-map';
import { parseRing, ringBounds, ringCentroid } from '@/lib/geometry';
import type { PropertyLotWithClient, PropertyStatus, Site, SiteWithLots } from '@/lib/types/property';
import type { ErrorEvent as MapLibreErrorEvent, GeoJSONSource } from 'maplibre-gl';
import { cn } from '@/lib/utils';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface SiteMapProps {
  site?: SiteWithLots;
  sites?: (SiteWithLots | Site)[];
  selectedLotId?: string | null;
  onSelectLot?: (lotId: string | null) => void;
  hoveredLotKey?: string | null;
  onSelectLotProperty?: (lot: PropertyLotWithClient) => void;
  onSelectUnregistered?: (data: { siteId: string; block: number; lot: number }) => void;
  isSidebarOpen?: boolean;
  className?: string;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  isEditorMode?: boolean;
  isPlotting?: boolean;
  draftPoints?: [number, number][];
  onAddDraftPoint?: (point: [number, number]) => void;
  onDeletePlot?: (plot: { subdivisionId?: string; siteId: string; siteName: string; block: number; lot: number; status: string }) => void;
  focusedSiteId?: string | null;
}

const SIDEBAR_WIDTH = 460;
const REGIONAL_CENTER: [number, number] = [125.5844925, 7.0447193];
const REGIONAL_ZOOM = 11.8;

const STATUS_COLOR_MAP: Record<string, string> = {
  Open: '#22C55E',
  Reserved: '#5BC4E7',
  Sold: '#F5CE42',
  Forfeited: '#ef4444',
  Available: '#6C7E8E',
  Unregistered: '#6C7E8E',
};

const STATUS_PILL_MAP: Record<string, string> = {
  Open: 'bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success',
  Reserved: 'bg-sidebar-accent text-accent-blue-foreground',
  Sold: 'bg-row-active text-accent-gold-foreground',
  Forfeited: 'bg-[color-mix(in_srgb,var(--destructive)_10%,white)] text-destructive',
  Available: 'bg-muted text-muted-foreground',
  Unregistered: 'bg-muted text-muted-foreground',
};


export function SiteMap({
  site,
  sites = [],
  selectedLotId,
  onSelectLot,
  hoveredLotKey,
  onSelectLotProperty,
  onSelectUnregistered,
  isSidebarOpen = true,
  className,
  initialCenter = REGIONAL_CENTER,
  initialZoom = REGIONAL_ZOOM,
  isEditorMode = false,
  isPlotting = false,
  draftPoints = [],
  onAddDraftPoint,
  onDeletePlot,
  focusedSiteId,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoveredLotKeyRef = useRef<string | null>(hoveredLotKey ?? null);
  hoveredLotKeyRef.current = hoveredLotKey ?? null;
  const onSelectLotPropertyRef = useRef(onSelectLotProperty);
  onSelectLotPropertyRef.current = onSelectLotProperty;
  const onSelectUnregisteredRef = useRef(onSelectUnregistered);
  onSelectUnregisteredRef.current = onSelectUnregistered;
  const isPlottingRef = useRef(isPlotting);
  isPlottingRef.current = isPlotting;
  const onAddDraftPointRef = useRef(onAddDraftPoint);
  onAddDraftPointRef.current = onAddDraftPoint;
  const onDeletePlotRef = useRef(onDeletePlot);
  onDeletePlotRef.current = onDeletePlot;
  const isEditorModeRef = useRef(isEditorMode);
  isEditorModeRef.current = isEditorMode;
  const [token, setToken] = useState<string | null>(null);
  const [useOsmFallback, setUseOsmFallback] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const [activeLotId, setActiveLotId] = useState<string | null>(selectedLotId ?? null);
  const activeLotIdRef = useRef<string | null>(activeLotId);
  activeLotIdRef.current = activeLotId;

  const [isPending, startTransition] = useTransition();

  const { map, isReady, zoomIn, zoomOut } = useMapLibreMap(containerRef, {
    center: initialCenter,
    zoom: initialZoom,
    padding: { top: 0, bottom: 0, left: isSidebarOpen ? SIDEBAR_WIDTH : 0, right: 0 },
  });

  // Sync selected lot state from props
  useEffect(() => {
    if (selectedLotId !== undefined) {
      setActiveLotId(selectedLotId);
    }
  }, [selectedLotId]);

  // Request ArcGIS token with fallback on error
  const fetchToken = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await getArcGISToken();
        setToken(result.accessToken);
        setUseOsmFallback(false);
      } catch {
        setUseOsmFallback(true);
      }
    });
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Animate map padding when sidebar opens or closes
  useEffect(() => {
    if (!map) return;
    const paddingLeft = isSidebarOpen && !isEditorMode ? SIDEBAR_WIDTH : 0;
    map.easeTo({
      padding: { top: 0, bottom: 0, left: paddingLeft, right: 0 },
      duration: 350,
    });
  }, [map, isSidebarOpen, isEditorMode]);

  // Track zoom level changes
  useEffect(() => {
    if (!map) return;
    const handleZoom = () => setCurrentZoom(map.getZoom());
    map.on('zoom', handleZoom);
    return () => {
      map.off('zoom', handleZoom);
    };
  }, [map]);

  // Combined site collection
  const allSites = useMemo(() => {
    if (sites.length > 0) return sites;
    if (site) return [site];
    return [];
  }, [sites, site]);

  // Map of registered property lots indexed by id and block-lot key
  const registeredLotsMap = useMemo(() => {
    const map = new Map<string, PropertyLotWithClient>();
    allSites.forEach((s) => {
      if ('lots' in s && Array.isArray(s.lots)) {
        s.lots.forEach((l) => {
          if (l.property_id) map.set(l.property_id, l);
          map.set(`${s.site_id}:${l.block_number}-${l.lot_number}`, l);
          map.set(`${l.block_number}-${l.lot_number}`, l);
        });
      }
    });
    return map;
  }, [allSites]);
  const registeredLotsMapRef = useRef(registeredLotsMap);
  registeredLotsMapRef.current = registeredLotsMap;

  // Focus view on an individual site boundary
  const focusSite = useCallback(
    (targetSite: Site) => {
      if (!map) return;
      const ring = parseRing(targetSite.boundary);
      if (!ring) return;
      const b = ringBounds(ring);
      map.fitBounds(
        [
          [b.minX, b.minY],
          [b.maxX, b.maxY],
        ],
        {
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 17.5,
          duration: 900,
        }
      );
    },
    [map]
  );

  // Focus view when focusedSiteId prop changes
  useEffect(() => {
    if (!map || !focusedSiteId) return;
    const targetSite = allSites.find((s) => s.site_id === focusedSiteId);
    if (targetSite) focusSite(targetSite);
  }, [map, focusedSiteId, allSites, focusSite]);

  // Dynamic GeoJSON for plotted draft points, connecting lines, and polygon fill
  const draftGeoJson = useMemo(() => {
    const pts = draftPoints ?? [];
    const features: GeoJSON.Feature[] = [];

    pts.forEach((p, idx) => {
      features.push({
        type: 'Feature',
        properties: { isFirst: idx === 0, index: idx + 1 },
        geometry: { type: 'Point', coordinates: p },
      });
    });

    if (pts.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { type: 'line' },
        geometry: { type: 'LineString', coordinates: pts },
      });
    }

    if (pts.length >= 3) {
      features.push({
        type: 'Feature',
        properties: { type: 'polygon' },
        geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] },
      });
    }

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [draftPoints]);

  // Set map crosshair cursor when plotting
  useEffect(() => {
    if (!map) return;
    map.getCanvas().style.cursor = isPlotting ? 'crosshair' : '';
  }, [map, isPlotting]);

  // GeoJSON features for all site boundaries
  const sitesGeoJson = useMemo(() => {
    const features = allSites
      .map((s) => {
        const ring = parseRing(s.boundary);
        if (!ring) return null;
        return {
          type: 'Feature' as const,
          properties: {
            siteId: s.site_id,
            name: s.name,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[...ring, ring[0]] as [number, number][]],
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [allSites]);

  // GeoJSON features for all subdivisions across all sites
  const lotsGeoJson = useMemo(() => {
    const features = allSites
      .flatMap((s) => {
        const siteLots = 'lots' in s && Array.isArray(s.lots) ? s.lots : [];
        const siteSubs = 'subdivisions' in s && Array.isArray(s.subdivisions) ? s.subdivisions : [];
        const lotMap = new Map(siteLots.map((l) => [`${l.block_number}-${l.lot_number}`, l]));

        return siteSubs.map((sub) => {
          const ring = parseRing(sub.boundary);
          if (!ring) return null;
          const b = ringBounds(ring);
          const centerLng = (b.minX + b.maxX) / 2;
          const centerLat = (b.minY + b.maxY) / 2;
          const topLat = b.maxY;
          const lotKey = `${sub.block_number}-${sub.lot_number}`;
          const siteLotKey = `${s.site_id}:${sub.block_number}-${sub.lot_number}`;
          const lot = lotMap.get(lotKey);
          const isRegistered = Boolean(lot);
          const status = lot?.status ?? 'Available';
          const areaSize = lot?.area_size ?? 252;
          const pricePerSqm = lot?.price_per_sqm ?? 6500;

          return {
            type: 'Feature' as const,
            properties: {
              id: sub.subdivision_id,
              lotKey,
              siteLotKey,
              propertyId: lot?.property_id ?? '',
              siteId: s.site_id,
              siteName: s.name,
              block: sub.block_number,
              lot: sub.lot_number,
              name: `Block ${sub.block_number} Lot ${sub.lot_number}`,
              status,
              isRegistered,
              areaSize,
              pricePerSqm,
              totalPrice: areaSize * pricePerSqm,
              clientName: lot?.client?.full_name ?? '',
              centerLng,
              centerLat,
              topLat,
            },
            geometry: {
              type: 'Polygon' as const,
              coordinates: [[...ring, ring[0]] as [number, number][]],
            },
          };
        });
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [allSites]);

  // Focus and fly to the selected property on map viewport
  const prevSelectedLotIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !isReady || !selectedLotId || selectedLotId === prevSelectedLotIdRef.current) {
      prevSelectedLotIdRef.current = selectedLotId ?? null;
      return;
    }
    prevSelectedLotIdRef.current = selectedLotId;

    const feat = lotsGeoJson.features.find(
      (f) => f.properties.propertyId === selectedLotId || f.properties.id === selectedLotId
    );
    if (!feat) return;

    const { centerLng, centerLat } = feat.properties;
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 17.5);

    map.flyTo({
      center: [centerLng, centerLat],
      zoom: targetZoom,
      duration: currentZoom < 14 ? 1200 : 600,
      essential: true,
    });
  }, [map, isReady, selectedLotId, lotsGeoJson]);

  // Mount site boundaries and house lot vector layers
  useEffect(() => {
    if (!map || !isReady) return;

    // Site boundary sources and layers
    if (!map.getSource('sites-data')) {
      map.addSource('sites-data', {
        type: 'geojson',
        data: sitesGeoJson,
      });

      map.addLayer({
        id: 'sites-boundary-fill',
        type: 'fill',
        source: 'sites-data',
        minzoom: 14,
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'sites-boundary-stroke',
        type: 'line',
        source: 'sites-data',
        minzoom: 14,
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-dasharray': [4, 2],
        },
      });
    } else {
      (map.getSource('sites-data') as GeoJSONSource).setData(sitesGeoJson);
    }

    // House subdivisions sources and layers
    if (!map.getSource('lots-data')) {
      map.addSource('lots-data', {
        type: 'geojson',
        data: lotsGeoJson,
      });

      map.addLayer({
        id: 'lots-fill',
        type: 'fill',
        source: 'lots-data',
        minzoom: 13.5,
        paint: {
          'fill-color': [
            'match',
            ['get', 'status'],
            'Open',
            STATUS_COLOR_MAP.Open,
            'Reserved',
            STATUS_COLOR_MAP.Reserved,
            'Sold',
            STATUS_COLOR_MAP.Sold,
            'Forfeited',
            STATUS_COLOR_MAP.Forfeited,
            STATUS_COLOR_MAP.Available,
          ],
          'fill-opacity': [
            'case',
            [
              'any',
              ['==', ['get', 'id'], activeLotIdRef.current || '__NONE__'],
              ['==', ['get', 'propertyId'], activeLotIdRef.current || '__NONE__'],
            ],
            0.85,
            ['any', ['==', ['get', 'status'], 'Available'], ['==', ['get', 'status'], 'Unregistered']],
            0.35,
            0.75,
          ],
        },
      });

      map.addLayer({
        id: 'lots-stroke',
        type: 'line',
        source: 'lots-data',
        minzoom: 13.5,
        paint: {
          'line-color': [
            'case',
            [
              'any',
              ['==', ['get', 'id'], activeLotIdRef.current || '__NONE__'],
              ['==', ['get', 'propertyId'], activeLotIdRef.current || '__NONE__'],
            ],
            '#ef4444',
            '#ffffff',
          ],
          'line-width': [
            'case',
            [
              'any',
              ['==', ['get', 'id'], activeLotIdRef.current || '__NONE__'],
              ['==', ['get', 'propertyId'], activeLotIdRef.current || '__NONE__'],
            ],
            3.5,
            1.5,
          ],
        },
      });

      map.addLayer({
        id: 'lots-hover-stroke',
        type: 'line',
        source: 'lots-data',
        minzoom: 13.5,
        filter: [
          'any',
          ['==', ['get', 'lotKey'], hoveredLotKeyRef.current ?? ''],
          ['==', ['get', 'siteLotKey'], hoveredLotKeyRef.current ?? ''],
        ],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 4.5,
        },
      });

      map.addLayer({
        id: 'lots-labels',
        type: 'symbol',
        source: 'lots-data',
        minzoom: 16.8,
        layout: {
          'text-field': ['concat', 'B', ['to-string', ['get', 'block']], '\nL', ['to-string', ['get', 'lot']]],
          'text-size': 11,
          'text-line-height': 1.15,
          'text-justify': 'center',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });
    } else {
      (map.getSource('lots-data') as GeoJSONSource).setData(lotsGeoJson);
    }

    // Draft plotting source and layers
    if (!map.getSource('draft-plot-data')) {
      map.addSource('draft-plot-data', {
        type: 'geojson',
        data: draftGeoJson,
      });

      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: 'draft-plot-data',
        filter: ['==', ['get', 'type'], 'polygon'],
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft-plot-data',
        filter: ['==', ['get', 'type'], 'line'],
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });

      map.addLayer({
        id: 'draft-vertices',
        type: 'circle',
        source: 'draft-plot-data',
        filter: ['has', 'index'],
        paint: {
          'circle-radius': ['case', ['get', 'isFirst'], 7, 5],
          'circle-color': ['case', ['get', 'isFirst'], '#22c55e', '#38bdf8'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    } else {
      (map.getSource('draft-plot-data') as GeoJSONSource).setData(draftGeoJson);
    }
  }, [map, isReady, sitesGeoJson, lotsGeoJson, draftGeoJson]);

  // Update dynamic lot styles on selection change
  useEffect(() => {
    if (!map || !map.getLayer('lots-fill') || !map.getLayer('lots-stroke')) return;

    map.setPaintProperty('lots-fill', 'fill-color', [
      'match',
      ['get', 'status'],
      'Open',
      STATUS_COLOR_MAP.Open,
      'Reserved',
      STATUS_COLOR_MAP.Reserved,
      'Sold',
      STATUS_COLOR_MAP.Sold,
      'Forfeited',
      STATUS_COLOR_MAP.Forfeited,
      STATUS_COLOR_MAP.Available,
    ]);

    map.setPaintProperty('lots-fill', 'fill-opacity', [
      'case',
      [
        'any',
        ['==', ['get', 'id'], activeLotId || '__NONE__'],
        ['==', ['get', 'propertyId'], activeLotId || '__NONE__'],
      ],
      0.85,
      ['any', ['==', ['get', 'status'], 'Available'], ['==', ['get', 'status'], 'Unregistered']],
      0.35,
      0.75,
    ]);

    map.setPaintProperty('lots-stroke', 'line-color', [
      'case',
      [
        'any',
        ['==', ['get', 'id'], activeLotId || '__NONE__'],
        ['==', ['get', 'propertyId'], activeLotId || '__NONE__'],
      ],
      '#ef4444',
      '#ffffff',
    ]);

    map.setPaintProperty('lots-stroke', 'line-width', [
      'case',
      [
        'any',
        ['==', ['get', 'id'], activeLotId || '__NONE__'],
        ['==', ['get', 'propertyId'], activeLotId || '__NONE__'],
      ],
      3.5,
      1.5,
    ]);
  }, [map, activeLotId]);

  // Update hover outline filter
  useEffect(() => {
    if (!map || !map.getLayer('lots-hover-stroke')) return;
    map.setFilter('lots-hover-stroke', [
      'any',
      ['==', ['get', 'lotKey'], hoveredLotKey ?? ''],
      ['==', ['get', 'siteLotKey'], hoveredLotKey ?? ''],
    ]);
  }, [map, hoveredLotKey]);

  // Click & hover interactions for house lots
  useEffect(() => {
    if (!map || !isReady) return;

    let popupInstance: import('maplibre-gl').Popup | null = null;
    let cleanupFn: (() => void) | null = null;

    async function setupLotInteractions() {
      if (!map) return;
      const { Popup } = await import('maplibre-gl');

      popupInstance = new Popup({
        closeButton: true,
        closeOnClick: false,
        anchor: 'bottom',
        offset: [0, -6],
        className: 'maplibre-property-popup',
        maxWidth: '280px',
      });

      const handleMouseEnter = () => {
        if (isPlottingRef.current) return;
        map.getCanvas().style.cursor = 'pointer';
      };

      const handleMouseLeave = () => {
        if (isPlottingRef.current) return;
        map.getCanvas().style.cursor = '';
      };

      const handleClick = (e: import('maplibre-gl').MapLayerMouseEvent) => {
        if (isPlottingRef.current) {
          onAddDraftPointRef.current?.([e.lngLat.lng, e.lngLat.lat]);
          return;
        }

        const feature = e.features?.[0];
        if (!feature) return;

        const p = feature.properties as {
          id: string;
          lotKey: string;
          siteLotKey: string;
          propertyId: string;
          siteId: string;
          siteName: string;
          block: number;
          lot: number;
          name: string;
          status: string;
          isRegistered: boolean;
          areaSize: number;
          pricePerSqm: number;
          totalPrice: number;
          clientName: string;
          centerLng: number;
          centerLat: number;
          topLat: number;
        };

        const lotId = p.id;
        const nextId = activeLotIdRef.current === lotId ? null : lotId;
        setActiveLotId(nextId);
        onSelectLot?.(nextId);

        if (!nextId) {
          popupInstance?.remove();
          return;
        }

        // Center map viewport on the selected lot
        map.easeTo({
          center: [p.centerLng, p.centerLat],
          duration: 450,
        });

        const isRegistered = p.isRegistered;
        const pillClass = STATUS_PILL_MAP[p.status] ?? STATUS_PILL_MAP.Unregistered;
        const deleteButtonHtml = isEditorModeRef.current
          ? `<button type="button" class="btn-delete-plot mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--destructive)_40%,white)] bg-[color-mix(in_srgb,var(--destructive)_10%,white)] px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_18%,white)] cursor-pointer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
              <span>Delete Plot</span>
            </button>`
          : '';

        const popupHtml = isRegistered
          ? `<div class="p-3 font-sans min-w-[220px] cursor-pointer">
              <div class="flex items-start justify-between gap-2 border-b border-border pb-2">
                <div>
                  <p class="font-bold text-sm text-foreground">${p.name}</p>
                  <p class="text-xs text-muted-foreground">${p.siteName}</p>
                </div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${pillClass}">
                  ${p.status}
                </span>
              </div>
              <dl class="mt-2.5 space-y-1 text-xs border-t border-border pt-2">
                <div class="flex justify-between"><dt class="text-muted-foreground">Area:</dt><dd class="font-medium text-foreground">${p.areaSize} sqm</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Price/sqm:</dt><dd class="font-medium text-foreground">₱${Number(p.pricePerSqm).toLocaleString()}</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Total Price:</dt><dd class="font-semibold text-primary">₱${Number(p.totalPrice).toLocaleString()}</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Client:</dt><dd class="font-medium text-foreground">${p.clientName || 'Unassigned'}</dd></div>
              </dl>
              <button type="button" class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 cursor-pointer">
                <span>View Details</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              ${deleteButtonHtml}
            </div>`
          : `<div class="p-3 font-sans min-w-[220px] cursor-pointer">
              <div class="flex items-start justify-between gap-2 border-b border-border pb-2">
                <div>
                  <p class="font-bold text-sm text-foreground">${p.name}</p>
                  <p class="text-xs text-muted-foreground">${p.siteName}</p>
                </div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
                  Available
                </span>
              </div>
              <dl class="mt-2.5 space-y-1 text-xs border-t border-border pt-2">
                <div class="flex justify-between"><dt class="text-muted-foreground">Area:</dt><dd class="font-medium text-foreground">${p.areaSize} sqm</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Est. Price/sqm:</dt><dd class="font-medium text-foreground">₱${Number(p.pricePerSqm).toLocaleString()}</dd></div>
                <div class="flex justify-between"><dt class="text-muted-foreground">Status:</dt><dd class="font-medium text-foreground">Available</dd></div>
              </dl>
              <button type="button" class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 cursor-pointer">
                <span>+ Register Lot</span>
              </button>
              ${deleteButtonHtml}
            </div>`;

        popupInstance
          ?.setLngLat([p.centerLng, p.topLat])
          .setHTML(popupHtml)
          .addTo(map);

        // Attach single navigation listener to popup container
        const popupEl = popupInstance?.getElement();
        if (popupEl) {
          const contentEl = popupEl.querySelector('.maplibregl-popup-content') as HTMLElement | null;
          if (contentEl) {
            contentEl.onclick = (ev: MouseEvent) => {
              const target = ev.target as HTMLElement | null;
              if (target?.closest('.maplibregl-popup-close-button')) {
                return;
              }

              if (target?.closest('.btn-delete-plot')) {
                popupInstance?.remove();
                setActiveLotId(null);
                onDeletePlotRef.current?.({
                  subdivisionId: p.id,
                  siteId: p.siteId,
                  siteName: p.siteName,
                  block: p.block,
                  lot: p.lot,
                  status: p.status,
                });
                return;
              }

              // Close the popup after it is clicked
              popupInstance?.remove();
              setActiveLotId(null);

              if (isRegistered) {
                const lotObj =
                  registeredLotsMapRef.current.get(p.propertyId) ??
                  registeredLotsMapRef.current.get(`${p.siteId}:${p.block}-${p.lot}`) ??
                  registeredLotsMapRef.current.get(`${p.block}-${p.lot}`) ??
                  ({
                    property_id: p.propertyId,
                    site_id: p.siteId,
                    block_number: p.block,
                    lot_number: p.lot,
                    location: p.siteName,
                    area_size: p.areaSize,
                    price_per_sqm: p.pricePerSqm,
                    status: p.status as PropertyStatus,
                    boundary: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    client: p.clientName ? { client_id: '', full_name: p.clientName, status: 'Active' } : null,
                  } as PropertyLotWithClient);
                onSelectLotPropertyRef.current?.(lotObj);
              } else {
                onSelectUnregisteredRef.current?.({
                  siteId: p.siteId,
                  block: p.block,
                  lot: p.lot,
                });
              }
            };
          }
        }
      };

      // Close popup when clicking anywhere on the map outside lots
      const handleMapClick = (e: import('maplibre-gl').MapMouseEvent) => {
        if (isPlottingRef.current) {
          onAddDraftPointRef.current?.([e.lngLat.lng, e.lngLat.lat]);
          return;
        }

        const features = map.queryRenderedFeatures(e.point, { layers: ['lots-fill'] });
        if (features.length === 0) {
          popupInstance?.remove();
          setActiveLotId(null);
        }
      };

      map.on('mouseenter', 'lots-fill', handleMouseEnter);
      map.on('mouseleave', 'lots-fill', handleMouseLeave);
      map.on('click', 'lots-fill', handleClick);
      map.on('click', handleMapClick);

      cleanupFn = () => {
        popupInstance?.remove();
        map.off('mouseenter', 'lots-fill', handleMouseEnter);
        map.off('mouseleave', 'lots-fill', handleMouseLeave);
        map.off('click', 'lots-fill', handleClick);
        map.off('click', handleMapClick);
      };
    }

    setupLotInteractions();

    return () => {
      cleanupFn?.();
      popupInstance?.remove();
    };
  }, [map, isReady, onSelectLot, onSelectLotProperty, onSelectUnregistered]);

  // Mount site pin icons and labels at low zoom levels
  useEffect(() => {
    if (!map || !isReady) return;

    const markers: import('maplibre-gl').Marker[] = [];

    async function mountSitePins() {
      if (!map) return;
      const { Marker } = await import('maplibre-gl');

      allSites.forEach((targetSite) => {
        const ring = parseRing(targetSite.boundary);
        if (!ring) return;
        const center = ringCentroid(ring);

        // Marker element with SVG pin icon and title
        const el = document.createElement('div');
        el.className = 'group flex flex-col items-center cursor-pointer transition-transform hover:scale-110';
        el.innerHTML = `
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-2 ring-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div class="mt-1 rounded-md bg-card px-2 py-0.5 text-[11px] font-bold text-foreground shadow-md border border-border whitespace-nowrap">
            ${targetSite.name}
          </div>
        `;

        el.addEventListener('click', () => {
          focusSite(targetSite);
        });

        const marker = new Marker({ element: el }).setLngLat([center[0], center[1]]).addTo(map);
        markers.push(marker);
      });
    }

    mountSitePins();

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, isReady, allSites, focusSite]);

  // Toggle marker pin visibility based on zoom threshold
  useEffect(() => {
    if (!map) return;
    const updatePinVisibility = () => {
      const isVisible = map.getZoom() < 14;
      document.querySelectorAll('.group.flex.flex-col.items-center.cursor-pointer').forEach((el) => {
        (el as HTMLElement).style.display = isVisible ? 'flex' : 'none';
      });
    };

    map.on('zoom', updatePinVisibility);
    updatePinVisibility();

    return () => {
      map.off('zoom', updatePinVisibility);
    };
  }, [map]);

  // Base imagery layers
  useEffect(() => {
    if (!map || !isReady) return;

    // Use OpenStreetMap tiles if fallback active or token missing
    if (useOsmFallback || !token) {
      if (!map.getSource('osm-tiles')) {
        map.addSource('osm-tiles', {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        });

        map.addLayer(
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
          },
          'sites-boundary-fill'
        );
      }
      return;
    }

    // Mount official ArcGIS World Imagery and hybrid labels
    if (token && !useOsmFallback) {
      const beforeId = map.getLayer('sites-boundary-fill') ? 'sites-boundary-fill' : undefined;

      if (!map.getSource('arcgis-imagery')) {
        map.addSource('arcgis-imagery', {
          type: 'raster',
          tiles: [
            `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${token}`,
          ],
          tileSize: 256,
          maxzoom: 19,
        });

        map.addLayer(
          {
            id: 'arcgis-imagery-layer',
            type: 'raster',
            source: 'arcgis-imagery',
          },
          beforeId
        );
      }

      if (!map.getSource('arcgis-labels')) {
        map.addSource('arcgis-labels', {
          type: 'raster',
          tiles: [
            `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/open/hybrid/detail/static/tile/{z}/{y}/{x}?token=${token}`,
          ],
          tileSize: 256,
          maxzoom: 19,
        });

        map.addLayer(
          {
            id: 'arcgis-labels-layer',
            type: 'raster',
            source: 'arcgis-labels',
          },
          beforeId
        );
      }

      // Handle raster tile loading errors and trigger fallback
      const handleTileError = (ev: MapLibreErrorEvent) => {
        const payload = ev as unknown as { sourceId?: string };
        if (payload.sourceId === 'arcgis-imagery' || payload.sourceId === 'arcgis-labels') {
          setUseOsmFallback(true);
        }
      };

      map.on('error', handleTileError);
      return () => {
        map.off('error', handleTileError);
      };
    }
  }, [map, isReady, token, useOsmFallback]);

  return (
    <div
      className={cn('relative flex flex-1 h-full min-h-0 w-full flex-col overflow-hidden bg-background', className)}
      data-engine="maplibre"
    >
      {/* MapLibre WebGL canvas */}
      <div ref={containerRef} className="h-full w-full z-0" />

      {/* Floating map controls (top-right) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 shadow-md">
        <Button
          variant="outline"
          size="icon"
          onClick={zoomIn}
          className="h-8 w-8 bg-card text-foreground shadow-sm hover:bg-row-hover"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={zoomOut}
          className="h-8 w-8 bg-card text-foreground shadow-sm hover:bg-row-hover"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Map status indicators (bottom-right) */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {useOsmFallback && (
          <div className="flex items-center gap-1.5 rounded-full border border-warning bg-card px-2.5 py-1 text-xs text-warning shadow-md">
            <AlertTriangle className="h-3 w-3" />
            <span>OSM Raster Fallback</span>
            <button
              onClick={fetchToken}
              className="ml-1 text-[11px] underline hover:opacity-80 flex items-center gap-0.5"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Retry ArcGIS
            </button>
          </div>
        )}

        <div className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-mono text-muted-foreground shadow-md">
          Zoom: {currentZoom.toFixed(1)}x
        </div>
      </div>

      {/* Loading overlay while requesting ArcGIS token */}
      {isPending && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-lg">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span>Connecting ArcGIS Satellite Imagery...</span>
        </div>
      )}
    </div>
  );
}
