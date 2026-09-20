'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap, MapOptions } from 'leaflet';

export interface UseLeafletMapOptions extends Omit<MapOptions, 'center'> {
  center?: [number, number];
  zoom?: number;
}

export function useLeafletMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseLeafletMapOptions = {}
) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [isReady, setIsReady] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let isMounted = true;

    async function initMap() {
      // Dynamically import Leaflet on client to prevent SSR window reference errors
      const L = (await import('leaflet')).default;
      if (!isMounted || !containerRef.current) return;

      // Clean up previous Leaflet DOM marker if remounting in strict mode
      const container = containerRef.current as HTMLElement & { _leaflet_id?: number | null };
      if (container._leaflet_id) {
        delete container._leaflet_id;
      }

      const {
        center = [7.0531, 125.67006],
        zoom = 12,
        scrollWheelZoom = true,
        zoomControl = false,
        fadeAnimation = false,
        ...rest
      } = optionsRef.current;

      const map = L.map(container, {
        center,
        zoom,
        scrollWheelZoom,
        zoomControl,
        fadeAnimation,
        wheelPxPerZoomLevel: 120,
        ...rest,
      });

      mapRef.current = map;
      setMapInstance(map);
      setIsReady(true);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapInstance(null);
        setIsReady(false);
      }
    };
  }, [containerRef]);

  const zoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  return {
    map: mapInstance,
    isReady,
    zoomIn,
    zoomOut,
  };
}
