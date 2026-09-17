'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import {
  parseRing,
  toSvgPoints,
  ringBounds,
  mergeBounds,
  ringCentroid,
  fitViewBox,
  type Ring,
} from '@/lib/geometry';
import type { SiteWithLots, PropertyLotWithClient, PropertyStatus } from '@/lib/types/property';
import { STATUSES, STATUS_SVG } from '@/lib/status-colors';

/**
 * A subdivision that has a parsed boundary ring, plus the property lot that
 * claims it (if any). The lot is null for empty/available slots.
 */
interface DrawableSubdivision {
  subdivisionId: string;
  ring: Ring;
  label: string;
  centroid: readonly [number, number];
  lot: PropertyLotWithClient | null;
}

/** Fill/stroke for a subdivision slot that has no registered property. */
const EMPTY_SVG = {
  fill: 'var(--row-hover)',
  stroke: 'var(--muted-foreground)',
} as const;

const ZOOM_STEP = 1.4;
const MIN_SCALE = 0.2;
const MAX_SCALE = 40;

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const AREA = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-xs font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Pan/zoom is done by moving the SVG `viewBox`, not by CSS transforms.
 *
 * The viewBox stays in the site's own metre space, so stroke widths and label
 * sizes can be expressed relative to the site's real extent and a lot's
 * coordinates never need converting.
 */
export function SiteMap({ site }: { site: SiteWithLots }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Hit-testing via elementFromPoint rather than event target, because
   * setPointerCapture retargets pointerup to the svg and clears hover state
   * before the pointer is released. See the original site-map notes.
   */
  const subdivisionIdAt = useCallback((clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest('[data-subdivision-id]')?.getAttribute('data-subdivision-id') ?? null;
  }, []);

  const [box, setBox] = useState({ w: 0, h: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  const [cardHeight, setCardHeight] = useState(210);
  const measureCard = useCallback((node: HTMLDivElement | null) => {
    if (node) setCardHeight(node.getBoundingClientRect().height);
  }, []);

  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setBox({ w: rect.width, h: rect.height });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const siteRing = useMemo(() => parseRing(site.boundary), [site.boundary]);

  /** Build a lookup of registered lots keyed by "block-lot" for O(1) matching. */
  const lotByKey = useMemo(() => {
    const map = new Map<string, PropertyLotWithClient>();
    for (const lot of site.lots) {
      map.set(`${lot.block_number}-${lot.lot_number}`, lot);
    }
    return map;
  }, [site.lots]);

  const drawable = useMemo<DrawableSubdivision[]>(() => {
    const out: DrawableSubdivision[] = [];
    for (const sub of site.subdivisions) {
      const ring = parseRing(sub.boundary);
      if (!ring) continue;
      const lot = lotByKey.get(`${sub.block_number}-${sub.lot_number}`) ?? null;
      out.push({
        subdivisionId: sub.subdivision_id,
        ring,
        label: `${sub.block_number}-${sub.lot_number}`,
        centroid: ringCentroid(ring),
        lot,
      });
    }
    return out;
  }, [site.subdivisions, lotByKey]);

  const statusCounts = useMemo(() => {
    const counts = { Open: 0, Reserved: 0, Sold: 0, Forfeited: 0 } as Record<PropertyStatus, number>;
    for (const { lot } of drawable) {
      if (lot) counts[lot.status] += 1;
    }
    return counts;
  }, [drawable]);

  const emptyCount = drawable.filter((d) => !d.lot).length;
  const drawnLotsCount = drawable.filter((d) => d.lot !== null).length;
  const undrawnLotsCount = site.lots.length - drawnLotsCount;

  const extent = useMemo(() => {
    const all = [
      ...(siteRing ? [ringBounds(siteRing)] : []),
      ...drawable.map((d) => ringBounds(d.ring)),
    ];
    return mergeBounds(all);
  }, [siteRing, drawable]);

  const initialViewBox = useMemo(
    () => (extent ? fitViewBox(extent, 0.04, 0.16) : '0 0 100 100'),
    [extent],
  );

  const [viewBox, setViewBox] = useState(initialViewBox);
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);

  const unit = Math.max(vbW, vbH);
  const fitScale = box.w > 0 && box.h > 0 ? Math.min(box.w / vbW, box.h / vbH) : 0;
  const px = (n: number) => (fitScale > 0 ? n / fitScale : (unit * n) / 700);

  const lotStroke = px(1);
  const siteStroke = px(2);
  const labelSize = px(14);

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
        const fx = originX ?? x + w / 2;
        const fy = originY ?? y + h / 2;
        const nx = fx - (fx - x) / factor;
        const ny = fy - (fy - y) / factor;
        return `${nx} ${ny} ${nextW} ${nextH}`;
      });
    },
    [extent],
  );

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

  const onWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    onWheelRef.current = (e: WheelEvent) => {
      e.preventDefault();
      const local = toLocal(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, local?.x, local?.y);
    };
  }, [toLocal, zoomBy]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const listener = (e: WheelEvent) => onWheelRef.current(e);
    svg.addEventListener('wheel', listener, { passive: false });
    return () => svg.removeEventListener('wheel', listener);
  }, []);

  const panState = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);
  const draggedRef = useRef(false);
  const DRAG_SLOP = 4;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const [x, y] = viewBox.split(' ').map(Number);
      panState.current = { x: e.clientX, y: e.clientY, vbX: x, vbY: y };
      draggedRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [viewBox],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const start = panState.current;
    if (!start) return;
    const svg = svgRef.current;
    if (!svg) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_SLOP) {
      draggedRef.current = true;
    }
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
    if (draggedRef.current) return;
    const id = subdivisionIdAt(e.clientX, e.clientY);
    setSelectedId((current) => (id && current !== id ? id : null));
  }, [subdivisionIdAt]);

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

  const emphasis = (id: string) => (id === selectedId ? 2 : id === hoveredId ? 1 : 0);

  const hovered = drawable.find((d) => d.subdivisionId === hoveredId) ?? null;
  const selected = drawable.find((d) => d.subdivisionId === selectedId) ?? null;

  const anchor = (() => {
    if (!selected || box.w === 0 || box.h === 0) return null;
    const [x, y, w, h] = viewBox.split(' ').map(Number);
    const scale = Math.min(box.w / w, box.h / h);
    const left = (box.w - w * scale) / 2 + (selected.centroid[0] - x) * scale;
    const top = (box.h - h * scale) / 2 + (selected.centroid[1] - y) * scale;
    const GAP = 14;
    return {
      left: Math.min(Math.max(left, 130), Math.max(box.w - 130, 130)),
      top: Math.min(Math.max(top, 8), Math.max(box.h - 8, 8)),
      below: top - cardHeight - GAP < 8,
    };
  })();

  return (
    <div ref={attachContainer} className="relative h-full w-full min-h-0 flex-1 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Site layout plan for ${site.name}`}
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none overscroll-contain bg-row-hover active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {/* Pass 1 — land area fill, then subdivision fills (carry hit-testing). */}
        <polygon points={toSvgPoints(siteRing)} fill="var(--card)" stroke="none" />

        {drawable.map(({ subdivisionId, ring, lot }) => (
          <polygon
            key={subdivisionId}
            points={toSvgPoints(ring)}
            fill={lot ? STATUS_SVG[lot.status].fill : EMPTY_SVG.fill}
            stroke="none"
            data-subdivision-id={subdivisionId}
            className="cursor-pointer"
            onPointerEnter={() => setHoveredId(subdivisionId)}
            onPointerLeave={() => setHoveredId((id) => (id === subdivisionId ? null : id))}
          />
        ))}

        {/* Pass 2 — subdivision outlines; hovered/selected draws last. */}
        <g className="pointer-events-none">
          {[...drawable]
            .sort((a, b) => emphasis(a.subdivisionId) - emphasis(b.subdivisionId))
            .map(({ subdivisionId, ring, lot }) => {
              const isSelected = subdivisionId === selectedId;
              const isHovered = subdivisionId === hoveredId;
              const emphasised = isSelected || isHovered;
              const strokeColor = emphasised
                ? (lot ? STATUS_SVG[lot.status].stroke : 'var(--foreground)')
                : 'var(--border)';
              return (
                <polygon
                  key={subdivisionId}
                  points={toSvgPoints(ring)}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? lotStroke * 4 : isHovered ? lotStroke * 2.5 : lotStroke}
                  strokeLinejoin="round"
                  className="transition-[stroke] duration-100"
                />
              );
            })}
        </g>

        {/* Pass 3 — site outline on top so a subdivision flush with the boundary cannot clip it. */}
        <polygon
          points={toSvgPoints(siteRing)}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={siteStroke}
          strokeLinejoin="round"
          className="pointer-events-none"
        />

        {/* Pass 4 — labels. */}
        <g className="pointer-events-none select-none">
          {drawable.map(({ subdivisionId, label, centroid }) => (
            <text
              key={subdivisionId}
              x={centroid[0]}
              y={centroid[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={labelSize}
              fill="var(--muted-foreground)"
            >
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* Detail card — shown for both claimed and empty subdivisions. */}
      {selected && (
        <div
          role="dialog"
          aria-label={`Details for Block ${selected.label.split('-')[0]} Lot ${selected.label.split('-')[1]}`}
          ref={measureCard}
          className={
            !anchor
              ? 'absolute bottom-3 left-3 z-10 w-[260px] animate-in fade-in-0 zoom-in-95 duration-100'
              : anchor.below
                ? 'absolute z-10 w-[260px] -translate-x-1/2 translate-y-[14px] animate-in fade-in-0 zoom-in-95 duration-100'
                : 'absolute z-10 w-[260px] -translate-x-1/2 -translate-y-[calc(100%+14px)] animate-in fade-in-0 zoom-in-95 duration-100'
          }
          style={anchor ? { left: anchor.left, top: anchor.top } : undefined}
        >
          {anchor?.below && (
            <div
              aria-hidden="true"
              className="mx-auto h-3 w-3 translate-y-1.5 rotate-45 border-l border-t border-border bg-card"
            />
          )}
          <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Block {selected.label.split('-')[0]} Lot {selected.label.split('-')[1]}
                </p>
                {selected.lot && (
                  <p className="text-xs text-muted-foreground">{selected.lot.location}</p>
                )}
              </div>
              <button
                aria-label="Close details"
                onClick={() => setSelectedId(null)}
                className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-row-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {selected.lot ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm border"
                    style={{
                      backgroundColor: STATUS_SVG[selected.lot.status].fill,
                      borderColor: STATUS_SVG[selected.lot.status].stroke,
                    }}
                  />
                  <span className="text-xs font-medium text-foreground">{selected.lot.status}</span>
                </div>

                <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <DetailRow label="Area">{AREA.format(selected.lot.area_size)} sqm</DetailRow>
                  <DetailRow label="Price / sqm">{PESO.format(selected.lot.price_per_sqm)}</DetailRow>
                  <DetailRow label="Contract price">
                    {PESO.format(selected.lot.area_size * selected.lot.price_per_sqm)}
                  </DetailRow>
                  <DetailRow label="Client">
                    {selected.lot.client
                      ? selected.lot.client.full_name
                      : <span className="font-normal text-muted-foreground">Unassigned</span>}
                  </DetailRow>
                </dl>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No property registered for this slot.
              </p>
            )}
          </div>
          {anchor && !anchor.below && (
            <div
              aria-hidden="true"
              className="mx-auto h-3 w-3 -translate-y-1.5 rotate-45 border-b border-r border-border bg-card"
            />
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute left-4 top-16 rounded-lg border border-border bg-card p-2 shadow-sm">
        <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </p>
        <ul className="space-y-0.5">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-2 px-1 py-0.5">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-sm border"
                style={{
                  backgroundColor: STATUS_SVG[status].fill,
                  borderColor: STATUS_SVG[status].stroke,
                }}
              />
              <span className="text-xs text-foreground">{status}</span>
              <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground">
                {statusCounts[status]}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-2 px-1 py-0.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-sm border border-border bg-row-hover"
            />
            <span className="text-xs text-foreground">Available</span>
            <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground">
              {emptyCount}
            </span>
          </li>
        </ul>
      </div>

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

      {/* Hovered slot readout (shown only when nothing is selected). */}
      {hovered && !selected && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <p className="text-sm font-medium text-foreground">
            Block {hovered.label.split('-')[0]} Lot {hovered.label.split('-')[1]}
          </p>
          <p className="text-xs text-muted-foreground">
            {hovered.lot
              ? `${hovered.lot.area_size.toLocaleString('en-PH')} sqm · ${hovered.lot.status}`
              : 'Available'}
          </p>
        </div>
      )}

      {/* Undrawn lots notice for registered properties on this site without matching subdivision */}
      {undrawnLotsCount > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 space-y-1 text-right">
          <p className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
            {undrawnLotsCount} lot{undrawnLotsCount === 1 ? '' : 's'} not yet drawn
          </p>
        </div>
      )}
    </div>
  );
}
