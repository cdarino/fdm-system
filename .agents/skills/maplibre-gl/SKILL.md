---
name: maplibre-gl
description: Implementation guidelines, SSR handling, WebGL worker assets, and layer management for MapLibre GL in Next.js. Use this skill when implementing, updating, or debugging maps, subdivision plat plans, site polygons, popups, or geospatial components.
---

# MapLibre GL & Geospatial Mapping

This skill provides architectural invariants, lifecycle recipes, and technical guidelines for implementing interactive subdivision plat plans, vector maps, and CAD-style geospatial views using MapLibre GL in Next.js App Router.

## Architecture Overview

Geospatial mapping in the dashboard is structured across domain components, hooks, server actions, and geometry utilities:

- **Primary Map Component**: `components/dashboard-properties/map-site.tsx` — Handles basemap switching, layer management, vector plat plans, selection states, and fallbacks.
- **Interactive Popup Component**: `components/dashboard-properties/map-site-popup.tsx` — Rich React-rendered parcel details and action controls rendered via `createPortal`.
- **Subdivision Plat Editor**: `components/dashboard-properties/map-site-editor.tsx` — Polygon plotting, vertex snapping, and draft lot boundary editing.
- **Map Instance Hook**: `lib/hooks/use-maplibre-map.ts` — Encapsulates MapLibre GL instantiation, canvas resizing, WebGL cleanup, and navigation controls.
- **Server Action Bridge**: `lib/actions/arcgis.ts` — Authenticates and proxies ArcGIS Basemap Styles v2 JSON with trusted HTTP headers.
- **Geometry & Geodesics**: `lib/geometry.ts` — WGS84 geodesic polygon projection, shoelace metric area calculation, bounding boxes, and ring parsing.
- **Global Styles**: `app/globals.css` — Custom popup container styling, arrow tips, and MapLibre canvas controls.

---

## Next.js & SSR Safeguards

MapLibre GL references browser-only globals (`window`, `document`, WebGL context, `navigator`) during instantiation. Static module-level imports of MapLibre classes will crash Next.js during SSR and server build passes.

### Safe Dynamic Loading
- Dynamically import MapLibre classes inside client components (`'use client'`) within `useEffect` or hook callbacks:
  ```ts
  const { Map, setWorkerUrl, Popup, Marker } = await import('maplibre-gl');
  ```
- **Type-Only Imports**: Direct static imports from `'maplibre-gl'` are permitted **strictly** when using TypeScript's `type` keyword:
  ```ts
  import type { Map as MapLibreMap, ErrorEvent as MapLibreErrorEvent, GeoJSONSource } from 'maplibre-gl';
  ```

---

## Worker & Static Assets Pipeline

MapLibre relies on a dedicated web worker to parse vector tiles, geometry, and glyphs off the main thread. In Next.js, worker bundle paths must be served statically.

1. **Asset Sync Script**: A `postinstall` script in `package.json` copies assets from `node_modules/maplibre-gl/dist/` into `/public/maplibre/`:
   - `maplibre-gl-worker.mjs`
   - `maplibre-gl-shared.mjs`
   - `maplibre-gl.css`
2. **Worker Configuration**: Always register the static worker URL before initializing any map instance:
   ```ts
   setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
   ```

---

## MapLibre Style Swapping Lifecycle & The `styleRevision` Pattern

Calling `map.setStyle()` drops **all** user-added sources (`sites-data`, `lots-data`, `draft-plot-data`) and custom layers (`lots-fill`, `lots-stroke`, `lots-labels`, etc.).

### Invariant: Never Mount Layers Immediately After `setStyle`
`map.setStyle()` is asynchronous. Calling `map.addSource()` or `map.addLayer()` synchronously after `map.setStyle()` will fail or have the layers wiped as soon as the style finishes loading.

### The `styleRevision` Synchronization Pattern
1. Listen for the `style.load` event to track when the new basemap has fully loaded:
   ```ts
   const [styleRevision, setStyleRevision] = useState(0);

   useEffect(() => {
     if (!map) return;
     const handleStyleLoad = () => {
       isSettingStyleRef.current = false;
       setStyleRevision((prev) => prev + 1);
     };
     map.on('style.load', handleStyleLoad);
     return () => {
       map.off('style.load', handleStyleLoad);
     };
   }, [map]);
   ```

2. Add `styleRevision` to the dependency array of all `useEffect` hooks responsible for mounting sources, layers, paint properties, and layer event listeners:
   ```ts
   useEffect(() => {
     if (!map || !isReady) return;

     // Re-create sources and layers wiped by map.setStyle
     if (!map.getSource('lots-data')) {
       map.addSource('lots-data', { type: 'geojson', data: lotsGeoJson });
       map.addLayer({ id: 'lots-fill', type: 'fill', source: 'lots-data', ... });
     }
   }, [map, isReady, styleRevision, lotsGeoJson]);
   ```

3. **Concurrency & Re-entrancy Guards**: Prevent overlapping `map.setStyle()` calls during fast mode toggles by utilizing ref flags (`isSettingStyleRef` and `pendingTargetStyleKeyRef`).

---

## ArcGIS Basemap Styles v2 Auth & HTTP Referer Guard

ArcGIS Basemap Styles v2 (`https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/open/hybrid`) enforces strict API key / OAuth token validation tied to the registered HTTP Referer header.

### The Browser Referrer Stripping Trap
- Default browser referrer policies (`strict-origin-when-cross-origin`) strip the HTTP `Referer` header when an unencrypted `http://localhost:3000` page requests an HTTPS ArcGIS endpoint.
- Without a matching `Referer` header, ArcGIS rejects tile and style requests with `401 Unauthorized (498 Token Invalid)`.

### Architecture: Server-Side Style Proxying
1. Download the style JSON through a Next.js Server Action (`getArcGISHybridStyle` in `lib/actions/arcgis.ts`) instead of having the browser fetch it directly:
   ```ts
   // lib/actions/arcgis.ts
   export async function getArcGISHybridStyle() {
     const token = await getArcGISToken();
     const styleUrl = `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/open/hybrid?token=${token}`;
     const res = await fetch(styleUrl, {
       headers: {
         Referer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/',
       },
     });
     const style = await res.json();
     return { style, token };
   }
   ```
2. The underlying tile URLs (`pbf` vectors and raster imagery) embedded within the returned style JSON already carry the access token in their query string and do not require the Referer check.
3. Configure `referrer: "origin-when-cross-origin"` in `app/layout.tsx` metadata as an additional safeguard.

---

## VersaTiles Basemaps & Fallback Engine

When ArcGIS tokens expire, rate limits are exceeded (HTTP 429), or network errors occur, the map automatically falls back to self-contained VersaTiles alternatives.

### Basemap Endpoints
- **Normal Mode (Vector + OSM)**: `https://tiles.versatiles.org/assets/styles/colorful/style.json` (includes OSM vectors and embedded hillshade).
- **Satellite Fallback Mode (Raster)**: `https://tiles.versatiles.org/tiles/satellite/{z}/{x}/{y}`.

### Automatic Error Fallback Handling
Listen to MapLibre error events and trigger fallback switching:
```ts
useEffect(() => {
  if (!map) return;
  const handleMapError = (ev: MapLibreErrorEvent) => {
    const err = ev as any;
    const status = err.status ?? err.error?.status;
    const msg = err.error?.message?.toLowerCase() ?? '';

    if (
      mapMode === 'satellite' &&
      !isFallbackActive &&
      (status === 401 || status === 403 || status === 429 || msg.includes('401') || msg.includes('429'))
    ) {
      setIsFallbackActive(true);
    }
  };

  map.on('error', handleMapError);
  return () => {
    map.off('error', handleMapError);
  };
}, [map, mapMode, isFallbackActive]);
```

### Invariant: VersaTiles Fontstack / Glyphs Limitations
- VersaTiles glyph servers (`https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf`) only support two font stacks: `noto_sans_regular` and `noto_sans_bold`.
- MapLibre concatenates array elements in `text-font: ['Arial Bold', 'Noto Sans Bold']` into a single URL string (`Arial Bold,Noto Sans Bold`). VersaTiles cannot parse composite stacks and responds with HTTP 404.
- **Rule**: When adding custom symbol layers (such as cadastral lot labels) on top of VersaTiles basemaps, strictly specify `layout: { 'text-font': ['noto_sans_bold'] }`.

---

## Basemap Symbol Text Scaling vs. Cadastral Labels

Standard vector basemap text (street names, villages, topographic points) is often too small for high-resolution cadastral surveying views.

### Dynamic AST Transformation (`scaleBasemapSymbolText`)
To increase readability without hardcoding custom vector styles, recursively transform the style JSON before feeding it to `map.setStyle()`:

```ts
// Scale numeric, step, and interpolate expressions
function scaleTextSize(expr: unknown, factor: number = 1.28): unknown {
  if (typeof expr === 'number') {
    return expr > 0 ? Math.round(expr * factor * 10) / 10 : expr;
  }
  if (Array.isArray(expr)) {
    if (expr[0] === 'interpolate') {
      const res = [...expr];
      for (let i = 4; i < res.length; i += 2) {
        if (typeof res[i] === 'number' && res[i] > 0) {
          res[i] = Math.round(res[i] * factor * 10) / 10;
        }
      }
      return res;
    }
    if (expr[0] === 'step') {
      const res = [...expr];
      if (typeof res[2] === 'number' && res[2] > 0) res[2] = Math.round(res[2] * factor * 10) / 10;
      for (let i = 4; i < res.length; i += 2) {
        if (typeof res[i] === 'number' && res[i] > 0) res[i] = Math.round(res[i] * factor * 10) / 10;
      }
      return res;
    }
  }
  return expr;
}

export function scaleBasemapSymbolText(style: any, factor: number = 1.28): any {
  if (!style || !Array.isArray(style.layers)) return style;
  const layers = style.layers.map((layer: any) => {
    if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
      const currentSize = layer.layout['text-size'] ?? 12;
      return {
        ...layer,
        layout: {
          ...layer.layout,
          'text-size': scaleTextSize(currentSize, factor),
        },
      };
    }
    return layer;
  });
  return { ...style, layers };
}
```

### Invariant: Isolate Cadastral Labels
Do **not** apply `scaleBasemapSymbolText` to the application's own cadastral layers (`lots-labels`). Lot numbers must remain at fixed pixel sizes (e.g. `11px`) to prevent visual collisions across parcel boundaries.

---

## React-Rendered Popups & HTML Markers DOM Lifecycle

Avoid passing raw HTML template strings to `popup.setHTML()`. Raw HTML bypasses React event handling, theme tokens, and dynamic state updates.

### React Portal Popup Recipe
1. Create a detached DOM container during component initialization:
   ```ts
   const popupContainerRef = useRef<HTMLDivElement | null>(null);
   if (!popupContainerRef.current && typeof document !== 'undefined') {
     popupContainerRef.current = document.createElement('div');
   }
   ```
2. Attach the container to the MapLibre popup instance:
   ```ts
   popupInstance.setDOMContent(popupContainerRef.current);
   popupInstance.addTo(map);
   ```
3. Render the interactive React popup component into the container with `createPortal`:
   ```tsx
   {popupContainerRef.current && selectedPlot && createPortal(
     <MapSitePopup
       plot={selectedPlot}
       onViewDetails={() => handleViewDetails(selectedPlot)}
       onRegisterLot={() => handleRegisterLot(selectedPlot)}
       onDeletePlot={() => handleDeletePlot(selectedPlot)}
     />,
     popupContainerRef.current
   )}
   ```

### DOM Marker & Popup Cleanup Invariants
- Unlike WebGL layers, `Popup` and `Marker` instances attach directly to the DOM tree outside of MapLibre style layers.
- They **persist** across `map.setStyle()` calls.
- Always clean up markers and active popups on unmount or site change:
  ```ts
  return () => {
    markers.forEach((m) => m.remove());
    popupRef.current?.remove();
  };
  ```

---

## Plat Plan GeoJSON Conventions & Geodesic Geometry

- **Coordinate System**: All coordinates are stored in standard `[longitude, latitude]` WGS84 order.
- **Unique Parcel Key**: A lot is uniquely identified by the tuple `(site_id, block_number, lot_number)`.
- **Geodesic Metric Area**:
  - Never compute parcel area using planar Pythagorean math on raw degrees.
  - Use `calculatePolygonAreaSqm` from `lib/geometry.ts` to project coordinates to a local tangent metric plane around the primary vertex:
    ```ts
    const [lng0, lat0] = points[0];
    const metersPerLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const metersPerLat = 110574;
    ```
- **Layer Stacking Order**:
  1. Base Map Layer (ArcGIS Hybrid vector/imagery or VersaTiles OSM vector)
  2. `sites-boundary-fill` & `sites-boundary-stroke` (Site perimeter)
  3. `lots-fill` (Parcel polygon fills with status color mapping)
  4. `lots-stroke` (Parcel boundaries; white for default, red for selected)
  5. `lots-hover-stroke` (Fast highlight outline controlled via `map.setFilter`)
  6. `lots-labels` (Cadastral Block-Lot labels with fixed font stack)
  7. HTML `Marker` site pins (Visible only below `DETAILS_ZOOM = 14`).
