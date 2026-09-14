'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, TriangleAlert, X } from 'lucide-react';
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
import type { SiteWithLots, PropertyLotWithClient, PropertyStatus } from '@/lib/types/property';
import { STATUSES, STATUS_SVG } from '@/lib/status-colors';

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
 * coordinates never need converting. It also keeps hit-testing exact: the
 * browser tests the pointer against the real polygon path, which a transformed
 * bitmap would not.
 */
export function SiteMap({ site }: { site: SiteWithLots }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Which lot a release lands on is resolved by hit-testing the cursor, not by
   * the event target and not by hover state.
   *
   * The <svg> calls setPointerCapture on pointerdown so a drag keeps panning
   * outside the element. Capture has two consequences that between them rule
   * out both of the obvious approaches:
   *
   *   1. pointerup is RETARGETED to the <svg>, so a lot's own handler never
   *      runs and e.target is always the svg.
   *   2. Setting capture fires pointerout/pointerleave at whatever was hovered
   *      — so the hovered lot is cleared the instant the button goes down, and
   *      is already null by the time the pointer is released.
   *
   * document.elementFromPoint is a plain hit test against the rendered tree and
   * is unaffected by capture, so it answers the actual question: what is under
   * the cursor right now.
   */
  const lotIdAt = useCallback((clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest('[data-lot-id]')?.getAttribute('data-lot-id') ?? null;
  }, []);
  /**
   * Live container size. Drives both the popup's position and the on-screen
   * size of strokes and labels, so it must never be left at zero.
   *
   * Measured from a CALLBACK REF rather than an effect. An effect with `[]`
   * deps runs once, and this component returns early when the site outline is
   * unusable — so if the container was not mounted on that single run, the
   * observer was never attached and the size stayed {0,0} permanently. A
   * callback ref runs whenever the node attaches, and measures synchronously
   * so the first paint already has a real size.
   */
  const [box, setBox] = useState({ w: 0, h: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);
  /**
   * Measured height of the detail card, so it can be flipped below its lot when
   * there is not room above. Seeded with a typical height so the very first
   * placement is already sensible rather than visibly correcting itself.
   */
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

  // Escape closes the popup, matching every other dismissible surface here.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

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

  const statusCounts = useMemo(() => {
    const counts = { Open: 0, Reserved: 0, Sold: 0, Forfeited: 0 } as Record<PropertyStatus, number>;
    for (const { lot } of drawable) counts[lot.status] += 1;
    return counts;
  }, [drawable]);

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
    // Extra headroom at the top so the first click on a top-row lot has room
    // for its card without the view needing to be panned first.
    () => (extent ? fitViewBox(extent, 0.04, 0.16) : '0 0 100 100'),
    [extent],
  );

  const [viewBox, setViewBox] = useState(initialViewBox);
  // Only the extent is needed here; the origin is read where panning uses it.
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);

  // Scale-independent sizing: a hairline should stay a hairline at any zoom, so
  // widths are a fraction of the CURRENT viewBox rather than a fixed px value.
  const unit = Math.max(vbW, vbH);

  /**
   * Converts a screen-pixel size into viewBox units.
   *
   * Strokes and labels were previously a fraction of the viewBox extent, i.e.
   * fixed in WORLD units — so their on-screen size rode on whatever fit scale
   * the container happened to produce, and they shrank as soon as the map was
   * sized correctly. Dividing by the live scale pins them to real pixels, which
   * also keeps labels readable at any zoom level.
   *
   * `unit`-based fallback covers the first render, before the ResizeObserver
   * has reported a size.
   */
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

  /**
   * Wheel-to-zoom must also stop the page scrolling behind the map.
   *
   * React registers wheel handlers on its own root as PASSIVE, so calling
   * preventDefault() from an `onWheel` prop is ignored (the browser logs
   * "Unable to preventDefault inside passive event listener"). A native
   * listener registered with `{ passive: false }` is the only way to cancel it.
   *
   * The handler is held in a ref and the listener attached once: `toLocal`
   * changes on every viewBox update, so binding the effect to it directly would
   * detach and reattach the listener on every frame of a drag.
   */
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
  /** Set once a pointer travels past the slop threshold, so releasing after a
      drag does not also select or deselect a lot. */
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
    // Releasing without dragging selects the lot under the pointer, or
    // dismisses the popup when released over bare canvas.
    if (draggedRef.current) return;

    const lotUnderPointer = lotIdAt(e.clientX, e.clientY);
    setSelectedId((current) =>
      lotUnderPointer && current !== lotUnderPointer ? lotUnderPointer : null,
    );
  }, [lotIdAt]);

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

  /** Paint order within the outline pass: plain < hovered < selected. */
  const emphasis = (id: string) => (id === selectedId ? 2 : id === hoveredId ? 1 : 0);

  const hovered = drawable.find((d) => d.lot.property_id === hoveredId) ?? null;
  const selected = drawable.find((d) => d.lot.property_id === selectedId) ?? null;

  /**
   * Where the popup sits, in container pixels.
   *
   * Recomputed from the viewBox, so the card stays pinned to its lot while the
   * plan is panned or zoomed. `xMidYMid meet` scales uniformly to fit and
   * splits the leftover space evenly, so the same transform has to be applied
   * here — a plain linear stretch would drift on any non-matching aspect ratio.
   */
  const anchor = (() => {
    if (!selected || box.w === 0 || box.h === 0) return null;
    const [x, y, w, h] = viewBox.split(' ').map(Number);
    const scale = Math.min(box.w / w, box.h / h);
    const left = (box.w - w * scale) / 2 + (selected.centroid[0] - x) * scale;
    const top = (box.h - h * scale) / 2 + (selected.centroid[1] - y) * scale;
    // Keep the card on screen when its lot is near an edge or scrolled off.
    // `below` flips it under the lot when the space above cannot hold it —
    // headroom in the initial view is not enough on its own, since panning can
    // put any lot against the top edge.
    const GAP = 14;
    return {
      left: Math.min(Math.max(left, 130), Math.max(box.w - 130, 130)),
      top: Math.min(Math.max(top, 8), Math.max(box.h - 8, 8)),
      below: top - cardHeight - GAP < 8,
    };
  })();

  return (
    // min-h-0 is essential: a flex item defaults to min-height:auto and so
    // refuses to shrink below its content, which let the SVG push this box past
    // the card — the card's overflow-hidden then clipped the lower half of the
    // plan on first load. The SVG is absolutely positioned so it matches this
    // box exactly rather than depending on percentage-height resolution.
    <div ref={attachContainer} className="relative min-h-0 flex-1 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        // Square units in both axes, so a lot's real proportions survive
        // whatever aspect ratio the container happens to have.
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Site layout plan for ${site.name}`}
        // overscroll-contain stops a scroll that reaches the map's edge from
        // chaining out to the page; the native wheel listener above cancels the
        // rest. touch-none keeps two-finger panning from scrolling on mobile.
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none overscroll-contain bg-row-hover active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {/*
          Drawn in passes — every fill first, then every stroke — rather than
          one self-contained <polygon> per lot.

          SVG centres a stroke on its path, so half of it falls outside the
          shape. With one element per lot painted in order, each lot's fill
          covered the outer half of its left-hand neighbour's stroke, so every
          shared edge rendered at half width while the last lot in each row kept
          a full-width edge. Separating the passes means no fill is ever painted
          over a stroke.
        */}

        {/* Pass 1 — land area, then lot fills. These carry the hit-testing. */}
        <polygon points={toSvgPoints(siteRing)} fill="var(--card)" stroke="none" />

        {drawable.map(({ lot, ring }) => (
          <polygon
            key={lot.property_id}
            points={toSvgPoints(ring)}
            fill={STATUS_SVG[lot.status].fill}
            stroke="none"
            data-lot-id={lot.property_id}
            className="cursor-pointer"
            onPointerEnter={() => setHoveredId(lot.property_id)}
            onPointerLeave={() => setHoveredId((id) => (id === lot.property_id ? null : id))}
          />
        ))}

        {/* Pass 2 — lot outlines. Sorted so the hovered lot draws last and its
            thicker outline is not crossed by a neighbour's hairline. */}
        <g className="pointer-events-none">
          {[...drawable]
            .sort((a, b) => emphasis(a.lot.property_id) - emphasis(b.lot.property_id))
            .map(({ lot, ring, areaWarning }) => {
              const isSelected = lot.property_id === selectedId;
              const isHovered = lot.property_id === hoveredId;
              const emphasised = isSelected || isHovered;
              return (
                <Fragment key={lot.property_id}>
                  <polygon
                    points={toSvgPoints(ring)}
                    fill="none"
                    // Hover raises the outline to the status' own strong colour
                    // rather than swapping the fill, so the status stays
                    // readable while the lot is highlighted.
                    stroke={emphasised ? STATUS_SVG[lot.status].stroke : 'var(--border)'}
                    strokeWidth={isSelected ? lotStroke * 4 : isHovered ? lotStroke * 2.5 : lotStroke}
                    strokeLinejoin="round"
                    className="transition-[stroke] duration-100"
                  />
                  {/* An area mismatch is a dashed overlay rather than a coloured
                      stroke: a red outline would be indistinguishable from a
                      Forfeited lot's own colour. */}
                  {areaWarning !== null && (
                    <polygon
                      points={toSvgPoints(ring)}
                      fill="none"
                      stroke="var(--destructive)"
                      strokeWidth={lotStroke * 2}
                      strokeDasharray={`${lotStroke * 6} ${lotStroke * 4}`}
                      strokeLinejoin="round"
                    />
                  )}
                </Fragment>
              );
            })}
        </g>

        {/* Pass 3 — the parcel outline last, so a lot drawn flush with the
            boundary cannot clip it. */}
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
          {drawable.map(({ lot, label, centroid }) => (
            <text
              key={lot.property_id}
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

      {/* Lot details, anchored to the selected lot and following it on pan/zoom.
          The tail below the card points at the lot it describes. */}
      {selected && (
        <div
          role="dialog"
          aria-label={`Details for Block ${selected.lot.block_number} Lot ${selected.lot.lot_number}`}
          // Falls back to a corner if the container has not been measured, so a
          // selection always produces a visible card.
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
                  Block {selected.lot.block_number} Lot {selected.lot.lot_number}
                </p>
                <p className="text-xs text-muted-foreground">{selected.lot.location}</p>
              </div>
              <button
                aria-label="Close lot details"
                onClick={() => setSelectedId(null)}
                className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-row-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

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

            {selected.areaWarning !== null && (
              <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-xs text-destructive">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  Drawn shape is {Math.round(selected.areaWarning * 100)}% off the recorded area.
                </span>
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

      {/* Legend. Counts come from the drawn lots only, so the numbers match
          what is actually visible on the plan. */}
      <div className="absolute left-3 top-3 rounded-lg border border-border bg-card p-2 shadow-sm">
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

      {/* Hovered lot readout. The full detail popup is r30. */}
      {hovered && !selected && (
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
