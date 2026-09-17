import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether the container handles vertical scrolling.
   * Defaults to `true` (`overflow-y-auto`). Set to `false` (`overflow-hidden`)
   * for full-height views like maps, editors, or dashboards that manage their own dimensions.
   */
  scrollable?: boolean;
  /**
   * Whether to apply standard page padding (`p-8`).
   * Defaults to `true`. Set to `false` for full-bleed edge-to-edge layouts.
   */
  padding?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Standard container for dashboard pages.
 *
 * Provides consistent padding and scroll container behavior across dashboard views,
 * while allowing full-bleed and full-height layouts (such as the Site Map) to opt out
 * of padding or page-level scrolling.
 */
export function PageContainer({
  scrollable = true,
  padding = true,
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0 h-full flex flex-col',
        scrollable ? 'overflow-y-auto' : 'overflow-hidden',
        padding && 'p-8 min-h-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

