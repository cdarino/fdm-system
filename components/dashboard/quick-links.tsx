'use client';

import { useState } from 'react';
import { ComingSoonModal } from './coming-soon-modal';

interface QuickLinksProps {
  labels?: {
    viewProperties?: string;
    viewReports?: string;
    settings?: string;
    helpAndSupport?: string;
  };
}

export function QuickLinks({ 
  labels = {
    viewProperties: 'View Properties',
    viewReports: 'View Reports',
    settings: 'Settings',
    helpAndSupport: 'Help & Support'
  }
}: QuickLinksProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
  }>({
    isOpen: false,
    title: 'Coming Soon!'
  });

  const handleComingSoon = (title: string) => {
    setModalState({ isOpen: true, title });
  };

  return (
    <>
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">Quick Links</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleComingSoon(labels.viewProperties || 'View Properties')}
            className="p-4 bg-sidebar-accent hover:bg-[color-mix(in_srgb,var(--primary)_20%,white)] rounded-lg text-accent-blue-foreground font-medium transition-colors"
          >
            {labels.viewProperties}
          </button>
          <button
            onClick={() => handleComingSoon(labels.viewReports || 'View Reports')}
            className="p-4 bg-chart-4 hover:bg-[color-mix(in_srgb,var(--secondary)_20%,white)] rounded-lg text-accent-gold-foreground font-medium transition-colors"
          >
            {labels.viewReports}
          </button>
          <button
            onClick={() => handleComingSoon(labels.settings || 'Settings')}
            className="p-4 bg-muted hover:bg-border rounded-lg text-muted-foreground font-medium transition-colors"
          >
            {labels.settings}
          </button>
          <button
            onClick={() => handleComingSoon(labels.helpAndSupport || 'Help & Support')}
            className="p-4 bg-muted hover:bg-border rounded-lg text-muted-foreground font-medium transition-colors"
          >
            {labels.helpAndSupport}
          </button>
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