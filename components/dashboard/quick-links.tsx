'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ComingSoonModal } from './coming-soon-modal';

interface QuickLinksProps {
  /**
   * Whether the signed-in user holds `properties.read`.
   *
   * Without it the Property Lots page redirects straight back to the dashboard,
   * so the tile is hidden rather than offered and then refused — matching how
   * the sidebar hides role sections and the overview hides stats.
   */
  canViewProperties?: boolean;
  labels?: {
    viewProperties?: string;
    viewReports?: string;
    settings?: string;
    helpAndSupport?: string;
  };
}

interface QuickLink {
  key: string;
  label: string;
  className: string;
  /** Omitted while the destination does not exist; the tile then explains itself. */
  href?: string;
  hidden?: boolean;
}

const ACCENT_TILE =
  'bg-sidebar-accent hover:bg-[color-mix(in_srgb,var(--primary)_20%,white)] text-accent-blue-foreground';
const GOLD_TILE =
  'bg-chart-4 hover:bg-[color-mix(in_srgb,var(--secondary)_20%,white)] text-accent-gold-foreground';
const MUTED_TILE = 'bg-muted hover:bg-border text-muted-foreground';

export function QuickLinks({
  canViewProperties = false,
  labels = {
    viewProperties: 'View Properties',
    viewReports: 'View Reports',
    settings: 'Settings',
    helpAndSupport: 'Help & Support',
  },
}: QuickLinksProps) {
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string }>({
    isOpen: false,
    title: 'Coming Soon!',
  });

  const handleComingSoon = (title: string) => {
    setModalState({ isOpen: true, title });
  };

  const links: QuickLink[] = [
    {
      key: 'viewProperties',
      label: labels.viewProperties ?? 'View Properties',
      className: ACCENT_TILE,
      href: '/dashboard/properties',
      hidden: !canViewProperties,
    },
    {
      key: 'viewReports',
      label: labels.viewReports ?? 'View Reports',
      className: GOLD_TILE,
    },
    {
      key: 'settings',
      label: labels.settings ?? 'Settings',
      className: MUTED_TILE,
      href: '/dashboard/settings',
    },
    {
      key: 'helpAndSupport',
      label: labels.helpAndSupport ?? 'Help & Support',
      className: MUTED_TILE,
    },
  ];

  const visible = links.filter((link) => !link.hidden);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-foreground">Quick Links</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {visible.map((link) => {
            const tile = `flex items-center justify-center rounded-lg p-4 text-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${link.className}`;

            return link.href ? (
              <Link key={link.key} href={link.href} className={tile}>
                {link.label}
              </Link>
            ) : (
              <button key={link.key} onClick={() => handleComingSoon(link.label)} className={tile}>
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      <ComingSoonModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
      />
    </>
  );
}
