'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, TriangleAlert } from 'lucide-react';
import {
  parseRing,
  toSvgPoints,
  ringBounds,
  mergeBounds,
  ringCentroid,
  areaDiscrepancy,
  fitViewBox,
  AREA_TOLERANCE,
  type Ring,
} from '@/lib/geometry';
import type { SiteWithLots, PropertyLotWithClient } from '@/lib/types/property';

/** A lot that actually has drawable geometry, resolved once up front. */
interface DrawableLot {
  lot: PropertyLotWithClient;
  ring: Ring;
  label: string;
  centroid: readonly [number, number];
  /** Set when the drawn shape disagrees with `area_size` beyond tolerance. */
  areaWarning: number | null;
}

const ZOOM_STEP = 1.4;
const MIN_SCALE = 0.2;
const MAX_SCALE = 40;

/**
 * Pan/zoom is done by moving the SVG `viewBox`, not by CSS transforms.
 *
 * The viewBox stays in the site's own metre space, so stroke widths and label
 * sizes can be expressed relative to the site's real extent and a lot's
 * coordinates never need converting. It also keeps hit-testing exact: the
 * browser tests the pointer against the real polygon path, which a transformed
 * bitmap would not.
 */
export function SiteMap({ site }: { site: SiteWithLots }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const siteRing = useMemo(() => parseRing(site.boundary), [site.boundary]);

  const drawable = useMemo<DrawableLot[]>(() => {
    const out: DrawableLot[] = [];
    for (const lot of site.lots) {
      const ring = parseRing(lot.boundary);
      if (!ring) continue; // undrawn lots simply do not appear on the plan
      const discrepancy = areaDiscrepancy(ring, lot.area_size);
      out.push({
        lot,
        ring,
        label: `${lot.block_number}-${lot.lot_number}`,
        centroid: ringCentroid(ring),
        areaWarning: discrepancy !== null && discrepancy > AREA_TOLERANCE ? discrepancy : null,
      });
    }
    return out;
  }, [site.lots]);

  const undrawnCount = site.lots.length - drawable.length;
  const warningCount = drawable.filter((d) => d.areaWarning !== null).length;

  /** Extent of everything, so "fit" frames the site even if a lot pokes outside it. */
  const extent = useMemo(() => {
    const all = [
      ...(siteRing ? [ringBounds(siteRing)] : []),
      ...drawable.map((d) => ringBounds(d.ring)),
    ];
    return mergeBounds(all);
  }, [siteRing, drawable]);

  const initialViewBox = useMemo(
    () => (extent ? fitViewBox(extent) : '0 0 100 100'),
    [extent],
  );

  const [viewBox, setViewBox] = useState(initialViewBox);
  // Only the extent is needed here; the origin is read where panning uses it.
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);

  // Scale-independent sizing: a hairline should stay a hairline at any zoom, so
  // widths are a fraction of the CURRENT viewBox rather than a fixed px value.
  const unit = Math.max(vbW, vbH);
  const lotStroke = unit * 0.0016;
  const siteStroke = unit * 0.0035;
  const labelSize = unit * 0.014;

  const resetView = useCallback(() => setViewBox(initialViewBox), [initialViewBox]);

  const zoomBy = useCallback(
    (factor: number, originX?: number, originY?: number) => {
      setViewBox((current) => {
        const [x, y, w, h] = current.split(' ').map(Number);
        if (!extent) return current;

        const baseW = Math.max(extent.maxX - extent.minX, 1);
        const nextW = w / factor;
        const scale = baseW / nextW;
        if (scale < MIN_SCALE || scale > MAX_SCALE) return current;

        const nextH = h / factor;
        // Zoom about the pointer when given one, otherwise about the centre.
        const fx = originX ?? x + w / 2;
        const fy = originY ?? y + h / 2;
        const nx = fx - (fx - x) / factor;
        const ny = fy - (fy - y) / factor;
        return `${nx} ${ny} ${nextW} ${nextH}`;
      });
    },
    [extent],
  );

  /** Converts a client-space pointer position into site-space coordinates. */
  const toLocal = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const [x, y, w, h] = viewBox.split(' ').map(Number);
      return {
        x: x + ((clientX - rect.left) / rect.width) * w,
        y: y + ((clientY - rect.top) / rect.height) * h,
      };
    },
    [viewBox],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      const local = toLocal(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, local?.x, local?.y);
    },
    [toLocal, zoomBy],
  );

  const panState = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const [x, y] = viewBox.split(' ').map(Number);
      panState.current = { x: e.clientX, y: e.clientY, vbX: x, vbY: y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [viewBox],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const start = panState.current;
    if (!start) return;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    setViewBox((current) => {
      const [, , w, h] = current.split(' ').map(Number);
      const dx = ((e.clientX - start.x) / rect.width) * w;
      const dy = ((e.clientY - start.y) / rect.height) * h;
      return `${start.vbX - dx} ${start.vbY - dy} ${w} ${h}`;
    });
  }, []);

  const endPan = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    panState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  if (!siteRing) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
        <p className="text-sm font-medium text-destructive">Site outline is not drawable</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{site.name}</strong> has a boundary that
          is not a list of at least three <code className="text-xs">[x, y]</code> vertex pairs.
        </p>
      </div>
    );
  }

  const hovered = drawable.find((d) => d.lot.property_id === hoveredId) ?? null;

  return (
    <div className="relative flex-1 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        // Square units in both axes, so a lot's real proportions survive
        // whatever aspect ratio the container happens to have.
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Site layout plan for ${site.name}`}
        className="h-full w-full cursor-grab touch-none select-none bg-row-hover active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {/* Overall land area */}
        <polygon
          points={toSvgPoints(siteRing)}
          fill="var(--card)"
          stroke="var(--foreground)"
          strokeWidth={siteStroke}
          strokeLinejoin="round"
        />

        {/* Individual lot cuts */}
        {drawable.map(({ lot, ring, label, centroid, areaWarning }) => {
          const isHovered = lot.property_id === hoveredId;
          return (
            <g
              key={lot.property_id}
              onPointerEnter={() => setHoveredId(lot.property_id)}
              onPointerLeave={() => setHoveredId((id) => (id === lot.property_id ? null : id))}
            >
              <polygon
                points={toSvgPoints(ring)}
                // Status colouring is r29; the base plan stays neutral so the
                // shapes and their divisions are what read.
                fill={isHovered ? 'var(--row-active)' : 'var(--muted)'}
                stroke={areaWarning !== null ? 'var(--destructive)' : 'var(--border)'}
                strokeWidth={isHovered ? lotStroke * 2 : lotStroke}
                strokeLinejoin="round"
                className="transition-[fill] duration-100"
              />
              <text
                x={centroid[0]}
                y={centroid[1]}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={labelSize}
                fill="var(--muted-foreground)"
                className="pointer-events-none select-none"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        <Button variant="ghost" size="icon" aria-label="Zoom in" className="h-8 w-8 hover:bg-row-hover" onClick={() => zoomBy(ZOOM_STEP)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Zoom out" className="h-8 w-8 hover:bg-row-hover" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Fit site to view" className="h-8 w-8 hover:bg-row-hover" onClick={resetView}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Hovered lot readout. The full detail popup is r30. */}
      {hovered && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <p className="text-sm font-medium text-foreground">
            Block {hovered.lot.block_number} Lot {hovered.lot.lot_number}
          </p>
          <p className="text-xs text-muted-foreground">
            {hovered.lot.area_size.toLocaleString('en-PH')} sqm · {hovered.lot.status}
          </p>
        </div>
      )}

      {/* Data-quality notices: geometry problems are invisible otherwise. */}
      {(undrawnCount > 0 || warningCount > 0) && (
        <div className="absolute bottom-3 right-3 space-y-1 text-right">
          {warningCount > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-destructive shadow-sm">
              <TriangleAlert className="h-3.5 w-3.5" />
              {warningCount} lot{warningCount === 1 ? '' : 's'} drawn more than{' '}
              {Math.round(AREA_TOLERANCE * 100)}% off their recorded area
            </p>
          )}
          {undrawnCount > 0 && (
            <p className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
              {undrawnCount} lot{undrawnCount === 1 ? '' : 's'} not yet drawn
            </p>
          )}
        </div>
      )}
    </div>
  );
}
