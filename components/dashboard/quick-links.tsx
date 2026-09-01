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
      <div className="bg-white rounded-2xl p-6 border border-[#E2E7EC] shadow-sm">
        <h3 className="text-lg font-bold text-[#1A1D20] mb-4">Quick Links</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => handleComingSoon(labels.viewProperties || 'View Properties')}
            className="p-4 bg-[#E2F4FA] hover:bg-[#D0ECFA] rounded-lg text-[#5BC4E7] font-medium transition-colors"
          >
            {labels.viewProperties}
          </button>
          <button 
            onClick={() => handleComingSoon(labels.viewReports || 'View Reports')}
            className="p-4 bg-[#FFF9E5] hover:bg-[#FFEFCC] rounded-lg text-[#F5CE42] font-medium transition-colors"
          >
            {labels.viewReports}
          </button>
          <button 
            onClick={() => handleComingSoon(labels.settings || 'Settings')}
            className="p-4 bg-[#F0F5F9] hover:bg-[#E0EBF3] rounded-lg text-[#6C7E8E] font-medium transition-colors"
          >
            {labels.settings}
          </button>
          <button 
            onClick={() => handleComingSoon(labels.helpAndSupport || 'Help & Support')}
            className="p-4 bg-[#F0F5F9] hover:bg-[#E0EBF3] rounded-lg text-[#6C7E8E] font-medium transition-colors"
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